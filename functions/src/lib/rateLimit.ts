/**
 * rateLimit.ts
 * Fixed-window rate limits stored in rateLimits/{uid}_{bucket} (SPEC 3.21).
 * Check-in and check-out share the "checkin" bucket: 10 attempts per user
 * per 10 minutes (SPEC 5.4). Invite codes have their own buckets so the
 * 50-bit codes cannot be guessed at speed and an owner cannot mint codes in
 * bulk. The counter is read and bumped in one
 * transaction so two parallel attempts cannot both slip under the limit.
 */
import type { Firestore } from "firebase-admin/firestore";
import { AppError, PATHS, type AppConfig, type RateLimitDoc } from "@fbla/shared";
import { msOf, readDoc, runTx, ts } from "./firestore";

export interface RateLimitRule {
  readonly bucket: string;
  readonly max: (config: AppConfig) => number;
  readonly windowSec: (config: AppConfig) => number;
}

export const CHECKIN_RATE_LIMIT: RateLimitRule = {
  bucket: "checkin",
  max: (config) => config.checkinRateMax,
  windowSec: (config) => config.checkinRateWindowSec
};

/** redeemInvite: 10 attempts per user per 10 minutes, wrong codes included (guessing defense). */
export const REDEEM_INVITE_RATE_LIMIT: RateLimitRule = {
  bucket: "redeemInvite",
  max: () => 10,
  windowSec: () => 600
};

/** createInvite: 20 new codes per user per hour. */
export const CREATE_INVITE_RATE_LIMIT: RateLimitRule = {
  bucket: "createInvite",
  max: () => 20,
  windowSec: () => 3600
};

/** Counts one attempt; throws RATE_LIMITED with retryAfterSec once the window is full. */
export const consumeRateLimit = async (
  db: Firestore,
  uid: string,
  rule: RateLimitRule,
  config: AppConfig,
  nowMs: number
): Promise<void> => {
  const ref = db.doc(PATHS.rateLimit(uid, rule.bucket));
  const windowMs = rule.windowSec(config) * 1000;
  await runTx(db, async (tx) => {
    const current = readDoc<RateLimitDoc>(await tx.get(ref));
    const windowOpen = current !== null && nowMs - msOf(current.windowStart) < windowMs;
    if (!windowOpen) {
      tx.set(ref, { windowStart: ts(nowMs), count: 1 });
      return;
    }
    if (current.count >= rule.max(config)) {
      const retryAfterSec = Math.max(1, Math.ceil((msOf(current.windowStart) + windowMs - nowMs) / 1000));
      throw new AppError("RATE_LIMITED", { retryAfterSec });
    }
    tx.update(ref, { count: current.count + 1 });
  });
};
