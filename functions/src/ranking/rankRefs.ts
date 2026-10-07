/**
 * rankRefs.ts
 * The opaque `ref` a ranked candidate carries (SPEC 8.4: "HMAC-signed uid,
 * 1 h expiry"). The coordinator's browser never sees a uid: the ref is the
 * payload {uid, orgId, expiry} sealed with AES-256-GCM, which both hides the
 * uid and authenticates it (a GCM tag is a MAC; any edit fails to open).
 *
 *   key  = HKDF-SHA256(KIOSK_MASTER_SECRET, salt "rank-ref", info "rank-ref:v1")
 *          (domain-separated from the kiosk keys, so no extra secret to manage)
 *   ref  = base64url(iv[12] | ciphertext | tag[16])
 *
 * openRankRef refuses an expired, edited, or garbled ref with REF_EXPIRED
 * ("This list is out of date. Rank again."), and a ref minted for another
 * organization with PERMISSION_DENIED.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { z } from "zod";
import { AppError } from "@fbla/shared";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_SALT = "rank-ref";
const KEY_INFO = "rank-ref:v1";

const payloadSchema = z.object({ u: z.string().min(1), o: z.string().min(1), e: z.number().int() }).strict();

export interface RankRefPayload {
  readonly uid: string;
  readonly orgId: string;
  readonly expMs: number;
}

const keyFor = (masterSecret: string | null): Buffer => {
  // Deployed without the secret: a configuration error, never a client error.
  if (masterSecret === null) throw new AppError("INTERNAL");
  return Buffer.from(hkdfSync("sha256", masterSecret, KEY_SALT, KEY_INFO, KEY_BYTES));
};

export const sealRankRef = (masterSecret: string | null, payload: RankRefPayload): string => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFor(masterSecret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ u: payload.uid, o: payload.orgId, e: payload.expMs }), "utf8"), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url");
};

const decrypt = (key: Buffer, ref: string): unknown => {
  const raw = Buffer.from(ref, "base64url");
  if (raw.length <= IV_BYTES + TAG_BYTES) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
    const plain = Buffer.concat([decipher.update(raw.subarray(IV_BYTES, raw.length - TAG_BYTES)), decipher.final()]);
    return JSON.parse(plain.toString("utf8"));
  } catch {
    // Wrong tag (edited or forged) or not JSON: the same answer as expired, by design.
    return null;
  }
};

/** The uid inside a ref minted for `orgId` that has not expired. */
export const openRankRef = (masterSecret: string | null, ref: string, orgId: string, nowMs: number): string => {
  const parsed = payloadSchema.safeParse(decrypt(keyFor(masterSecret), ref));
  if (!parsed.success || parsed.data.e <= nowMs) throw new AppError("REF_EXPIRED");
  if (parsed.data.o !== orgId) throw new AppError("PERMISSION_DENIED");
  return parsed.data.u;
};
