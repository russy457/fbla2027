/**
 * promoteFromWaitlist.ts
 * Hook for waitlist promotion after seats open up (SPEC#state-machine row 3,
 * SPEC 5.3 step 4). updateInstance calls it after a capacity increase made
 * before the cutoff; cancelSignup is expected to use the same entry point.
 *
 * TODO(lane A waitlist): Lane A owns the waitlist. Replace this no-op with
 * the real transaction: while signupCount < capacity and now < cutoffAt,
 * move the lowest-seq waitlisted signup to confirmed (promotedAt = now,
 * signupCount += 1, waitlist entry removed, history appended, notification
 * "waitlist-promoted") and return the promoted signup ids. Keep the
 * signature so updateInstance needs no change.
 */
import type { Firestore } from "firebase-admin/firestore";
import type { AppConfig } from "@fbla/shared";

export interface PromotionContext {
  readonly db: Firestore;
  readonly instanceId: string;
  readonly nowMs: number;
  readonly config: AppConfig;
}

/** Promotes waitlisted signups into free seats; returns the promoted signup ids (none until Lane A lands). */
export const promoteFromWaitlist = async (context: PromotionContext): Promise<string[]> => {
  void context;
  return [];
};
