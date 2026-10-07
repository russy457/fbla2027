/**
 * verifyTurnstile.ts
 * Server-side Cloudflare Turnstile check (SPEC 5.9, G13), ported from the old
 * app's verifyTurnstileToken (fblaslc2026 functions/src/index.ts). Two
 * changes from the old version: the result is bound to completeProfile
 * instead of a bypassable sessionStorage flag, and each token is consumed
 * once through turnstileTokens/{sha256(token)} so a captured token cannot be
 * replayed.
 *
 * On the emulator (or TURNSTILE_ENABLED=false) verification is skipped and
 * one warning line is logged per process, matching the Cloudflare test keys
 * in .env.example.
 */
import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { AppError, COLLECTIONS, MINUTE_MS } from "@fbla/shared";
import type { FunctionsEnv } from "../lib/env";
import type { Logger } from "../lib/deps";
import { runTx, ts } from "../lib/firestore";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TOKEN_TTL_MS = 10 * MINUTE_MS;
const REQUEST_TIMEOUT_MS = 8_000;

interface SiteverifyResponse {
  readonly success: boolean;
  readonly "error-codes"?: readonly string[];
}

/** Injected in tests; defaults to global fetch. */
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

let warnedDisabled = false;

const askCloudflare = async (secret: string, token: string, fetchImpl: FetchLike): Promise<boolean> => {
  const response = await fetchImpl(SITEVERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) return false;
  const body = (await response.json()) as SiteverifyResponse;
  return body.success === true;
};

/** Records the token as used; an existing record means a replay. */
const consumeToken = async (db: Firestore, token: string, nowMs: number): Promise<void> => {
  const id = createHash("sha256").update(token).digest("hex");
  const ref = db.collection(COLLECTIONS.turnstileTokens).doc(id);
  await runTx(db, async (tx) => {
    if ((await tx.get(ref)).exists) throw new AppError("TURNSTILE_FAILED");
    tx.create(ref, { consumedAt: ts(nowMs), expiresAt: ts(nowMs + TOKEN_TTL_MS) });
  });
};

/**
 * Throws TURNSTILE_FAILED for a missing, rejected, or replayed token. Returns
 * true when a real verification happened (stored as turnstileVerifiedAt).
 */
export const verifyTurnstile = async (
  db: Firestore,
  env: FunctionsEnv,
  log: Logger,
  token: string | undefined,
  nowMs: number,
  fetchImpl: FetchLike = fetch as unknown as FetchLike
): Promise<boolean> => {
  if (!env.turnstileEnabled) {
    if (!warnedDisabled) log.warn("Turnstile verification is disabled (emulator or TURNSTILE_ENABLED=false)");
    warnedDisabled = true;
    return false;
  }
  if (!token || env.turnstileSecret === null) throw new AppError("TURNSTILE_FAILED");
  const accepted = await askCloudflare(env.turnstileSecret, token, fetchImpl).catch((error: unknown) => {
    log.error("Turnstile siteverify failed", { error: error instanceof Error ? error.message : String(error) });
    return false;
  });
  if (!accepted) throw new AppError("TURNSTILE_FAILED");
  await consumeToken(db, token, nowMs);
  return true;
};
