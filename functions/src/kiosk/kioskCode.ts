/**
 * kioskCode.ts
 * Server-side kiosk code math (SPEC 5.10, G21). Codes are never stored or
 * logged; each one is recomputed from the instance key and the time window.
 *
 *   key  = HKDF-SHA256(KIOSK_MASTER_SECRET, salt, "kiosk:{instanceId}:v{keyVersion}", 32 bytes)
 *   code = HOTP(key, windowIndex): HMAC-SHA256 over the 8-byte big-endian
 *          window index, RFC 4226 dynamic truncation, mod 10^6, zero-padded.
 *
 * Verification accepts the current and previous window and compares with
 * crypto.timingSafeEqual, so response time does not reveal how many digits
 * of a guess were right.
 */
import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { AppError, COLLECTIONS, acceptedKioskWindows, type InstanceSecretDoc } from "@fbla/shared";
import { readDoc, runTx, ts } from "../lib/firestore";

const KEY_BYTES = 32;
const SALT_BYTES = 32;
const CODE_DIGITS = 6;
const CODE_MODULUS = 10 ** CODE_DIGITS;

export const deriveInstanceKey = (masterSecret: string, saltBase64: string, instanceId: string, keyVersion: number): Buffer =>
  Buffer.from(hkdfSync("sha256", masterSecret, Buffer.from(saltBase64, "base64"), `kiosk:${instanceId}:v${keyVersion}`, KEY_BYTES));

/** RFC 4226 HOTP with SHA-256 and 6 digits for one window index. */
export const codeForWindow = (key: Buffer, windowIndex: number): string => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(windowIndex));
  const digest = createHmac("sha256", key).update(counter).digest();
  // Dynamic truncation: the low 4 bits of the last byte pick a 4-byte slice.
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % CODE_MODULUS).padStart(CODE_DIGITS, "0");
};

/**
 * True when `code` matches the current or previous window. Both windows are
 * always compared (no early exit) so timing is the same for every guess.
 */
export const verifyKioskCode = (key: Buffer, code: string, nowMs: number, rotationSec: number): boolean => {
  const given = Buffer.from(code.padEnd(CODE_DIGITS, " ").slice(0, CODE_DIGITS));
  return acceptedKioskWindows(nowMs, rotationSec)
    .map((window) => timingSafeEqual(Buffer.from(codeForWindow(key, window)), given))
    .reduce((matched, result) => matched || result, false);
};

/**
 * Reads instanceSecrets/{instanceId}, creating it on first use. The seed and
 * (Tier 1) createInstance write it up front; creating lazily keeps an
 * instance made by other means usable.
 */
export const loadInstanceSecret = async (db: Firestore, instanceId: string, nowMs: number): Promise<InstanceSecretDoc> => {
  const ref = db.collection(COLLECTIONS.instanceSecrets).doc(instanceId);
  const existing = readDoc<InstanceSecretDoc>(await ref.get());
  if (existing) return existing;
  return runTx(db, async (tx) => {
    const raced = readDoc<InstanceSecretDoc>(await tx.get(ref));
    if (raced) return raced;
    const created: InstanceSecretDoc = {
      salt: randomBytes(SALT_BYTES).toString("base64"),
      keyVersion: 1,
      createdAt: ts(nowMs),
      updatedAt: ts(nowMs)
    };
    tx.create(ref, created);
    return created;
  });
};

/** The per-instance key, or INTERNAL when the master secret is not configured (deployed without the secret). */
export const instanceKey = async (db: Firestore, masterSecret: string | null, instanceId: string, nowMs: number): Promise<Buffer> => {
  if (masterSecret === null) throw new AppError("INTERNAL");
  const secret = await loadInstanceSecret(db, instanceId, nowMs);
  return deriveInstanceKey(masterSecret, secret.salt, instanceId, secret.keyVersion);
};
