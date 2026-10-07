/**
 * aiUsage.ts
 * Per-user and site-wide AI call limits (SPEC 8.4, SPEC 3.21):
 *   aiUsage/{uid}      at most aiPerHour calls per rolling hour window and
 *                      aiPerDay calls per UTC day,
 *   aiUsage/_global    at most aiGlobalDailyCap calls per UTC day for
 *                      everyone; past it, AI is off until the next UTC day.
 * Both counters are read and bumped in one transaction, so parallel questions
 * cannot slip past a limit. A call is counted only when the model is actually
 * going to be asked; fallback answers are free.
 *
 * Over a limit is not an error (SPEC 10.10): askAssistant returns help
 * articles, with `limited: true` for the personal limit.
 */
import type { Firestore } from "firebase-admin/firestore";
import { AI_GLOBAL_USAGE_ID, COLLECTIONS, HOUR_MS, localDateIn, type AiGlobalUsageDoc, type AiUsageDoc, type AppConfig } from "@fbla/shared";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";

export type UsageVerdict = "ok" | "user-limit" | "global-cap";

const utcDay = (nowMs: number): string => localDateIn(new Date(nowMs), "UTC");

/** Pure decision for one call, given the current counters. Exported for unit tests. */
export const decideUsage = (
  user: AiUsageDoc | null,
  global: AiGlobalUsageDoc | null,
  config: Pick<AppConfig, "aiPerHour" | "aiPerDay" | "aiGlobalDailyCap">,
  nowMs: number
): { verdict: UsageVerdict; user: AiUsageDoc; global: AiGlobalUsageDoc } => {
  const day = utcDay(nowMs);
  const globalCount = global?.day === day ? global.count : 0;
  const hourOpen = user !== null && nowMs - msOf(user.hourWindowStart) < HOUR_MS;
  const hourCount = hourOpen ? user.hourCount : 0;
  const dayCount = user?.day === day ? user.dayCount : 0;
  const current: AiUsageDoc = { hourWindowStart: hourOpen ? user.hourWindowStart : ts(nowMs), hourCount, day, dayCount };
  const currentGlobal: AiGlobalUsageDoc = { day, count: globalCount };

  if (globalCount >= config.aiGlobalDailyCap) return { verdict: "global-cap", user: current, global: currentGlobal };
  if (hourCount >= config.aiPerHour || dayCount >= config.aiPerDay) return { verdict: "user-limit", user: current, global: currentGlobal };
  return {
    verdict: "ok",
    user: { ...current, hourCount: hourCount + 1, dayCount: dayCount + 1 },
    global: { day, count: globalCount + 1 }
  };
};

/** Counts one AI call for `uid` if every limit allows it. */
export const consumeAiUsage = async (db: Firestore, uid: string, config: AppConfig, nowMs: number): Promise<UsageVerdict> => {
  const userRef = db.collection(COLLECTIONS.aiUsage).doc(uid);
  const globalRef = db.collection(COLLECTIONS.aiUsage).doc(AI_GLOBAL_USAGE_ID);
  return runTx(db, async (tx) => {
    const [userSnap, globalSnap] = await Promise.all([tx.get(userRef), tx.get(globalRef)]);
    const decision = decideUsage(readDoc<AiUsageDoc>(userSnap), readDoc<AiGlobalUsageDoc>(globalSnap), config, nowMs);
    if (decision.verdict === "ok") {
      tx.set(userRef, decision.user);
      tx.set(globalRef, decision.global);
    }
    return decision.verdict;
  });
};
