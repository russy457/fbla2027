/**
 * promotion.ts
 * Waitlist promotion inside a caller's transaction (SPEC 5.3 step 4,
 * SPEC 6.1 row 3). Used by cancelSignup when a confirmed seat frees up, and
 * meant for coordinator.updateInstance when capacity grows (lane B calls
 * readPromotion + applyPromotion the same way).
 *
 * Firestore transactions need every read before the first write, so it is
 * two steps:
 *   1. readPromotion(tx, ...)   reads the waitlisted signups that would fill
 *                               the free seats, lowest seq first, skipping
 *                               stale entries whose signup is no longer waitlisted;
 *   2. applyPromotion(tx, ...)  moves each to confirmed with promotedAt = now,
 *                               queues a waitlist-promoted notification, and
 *                               returns the remaining waitlist and seats used,
 *                               for the caller's single instance update.
 * No promotion happens at or after the cutoff (start - 2 h); those seats go
 * to walk-ups.
 */
import type { DocumentReference, Firestore, Transaction } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  assertTransition,
  promotableSeats,
  waitlistPromotedNotification,
  type InstanceDoc,
  type SignupActor,
  type SignupDoc,
  type WaitlistEntry
} from "@fbla/shared";
import { msOf, readDoc, ts } from "../lib/firestore";
import { queueNotification } from "../notifications/notify";
import { withHistory } from "./signupRecords";

interface Candidate {
  readonly entry: WaitlistEntry;
  readonly ref: DocumentReference;
  readonly signup: SignupDoc | null;
}

export interface PromotionPlan {
  /** Entries that become confirmed, in order. */
  readonly promote: readonly Candidate[];
  /** Entries dropped because their signup is no longer waitlisted (already cancelled, for example). */
  readonly stale: readonly WaitlistEntry[];
}

/**
 * Step 1 (reads only). `signupCount` is the seat count after the caller's own
 * change (for cancelSignup, one less than before).
 */
export const readPromotion = async (
  tx: Transaction,
  db: Firestore,
  instance: InstanceDoc,
  signupCount: number,
  nowMs: number
): Promise<PromotionPlan> => {
  const seats = promotableSeats(instance.capacity, signupCount, nowMs, msOf(instance.cutoffAt));
  const ordered = [...instance.waitlist].sort((a, b) => a.seq - b.seq);
  const promote: Candidate[] = [];
  const stale: WaitlistEntry[] = [];
  for (const entry of ordered) {
    if (promote.length >= seats) break;
    const ref = db.collection(COLLECTIONS.signups).doc(entry.signupId);
    const signup = readDoc<SignupDoc>(await tx.get(ref));
    if (signup?.status === "waitlisted") promote.push({ entry, ref, signup });
    else stale.push(entry);
  }
  return { promote, stale };
};

export interface PromotionResult {
  readonly promotedSignupIds: readonly string[];
  /** The instance's waitlist after removing promoted and stale entries. */
  readonly waitlist: WaitlistEntry[];
  /** Seats the promotions took; add to signupCount. */
  readonly seatsTaken: number;
}

/** Step 2 (writes only). The caller writes the instance with the returned waitlist and count. */
export const applyPromotion = (
  tx: Transaction,
  db: Firestore,
  instanceId: string,
  instance: InstanceDoc,
  plan: PromotionPlan,
  actor: string,
  op: Extract<SignupActor, "cancelSignup" | "updateInstance">,
  nowMs: number
): PromotionResult => {
  const removed = new Set([...plan.promote.map((candidate) => candidate.entry.signupId), ...plan.stale.map((entry) => entry.signupId)]);
  plan.promote.forEach(({ ref, signup, entry }) => {
    const current = signup as SignupDoc;
    assertTransition("waitlisted", "confirmed", op);
    tx.update(ref, {
      status: "confirmed",
      promotedAt: ts(nowMs),
      waitlistSeq: null,
      history: withHistory(current.history, "waitlisted", "confirmed", actor, op, nowMs),
      updatedAt: ts(nowMs)
    });
    const content = waitlistPromotedNotification({
      instanceId,
      signupId: entry.signupId,
      title: instance.title,
      orgName: instance.orgName,
      startMs: msOf(instance.start),
      timeZone: instance.timeZone
    });
    queueNotification(tx, db, entry.uid, content, entry.signupId, nowMs);
  });
  return {
    promotedSignupIds: plan.promote.map((candidate) => candidate.entry.signupId),
    waitlist: instance.waitlist.filter((entry) => !removed.has(entry.signupId)),
    seatsTaken: plan.promote.length
  };
};
