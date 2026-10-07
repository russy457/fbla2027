/**
 * cancelSignup.ts
 * volunteer.cancelSignup (SPEC#fn-cancelsignup, SPEC 5.3). One transaction
 * over the instance and the signup. A confirmed cancel frees a seat and is a
 * "late cancel" when it happens within 24 hours of the start; a promoted
 * volunteer may instead release the seat without that mark (T2). Before
 * the 2 h cutoff the freed seat goes to the head of the waitlist in the same
 * transaction (lowest seq), who gets a waitlist-promoted notification with
 * Confirm / Can't make it actions; after the cutoff the seat stays open for
 * walk-ups.
 */
import {
  AppError,
  COLLECTIONS,
  assertTransition,
  canReleasePromotion,
  isLateCancel,
  type CancelReason,
  type InstanceDoc,
  type SignupDoc,
  type WindowConfig
} from "@fbla/shared";
import { volunteerOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";
import { SYSTEM_ACTOR } from "../shifts/finalize";
import { applyPromotion, readPromotion } from "../shifts/promotion";
import { withHistory } from "../shifts/signupRecords";

interface CancelDecision {
  readonly cancelReason: CancelReason;
  readonly lateCancel: boolean;
}

/**
 * Why a confirmed or waitlisted signup is being cancelled (SPEC 5.3 steps 2-3).
 * Waitlisted cancels and releases never count as late; a normal confirmed
 * cancel is late inside 24 hours of the start.
 */
const decideCancel = (signup: SignupDoc, release: boolean, nowMs: number, startMs: number, config: WindowConfig): CancelDecision => {
  if (signup.status === "waitlisted") return { cancelReason: "volunteer", lateCancel: false };
  if (!release) return { cancelReason: "volunteer", lateCancel: isLateCancel(nowMs, startMs, config) };
  const promotedAtMs = signup.promotedAt === null ? null : msOf(signup.promotedAt);
  if (promotedAtMs === null || !canReleasePromotion(nowMs, promotedAtMs, startMs, config)) {
    throw new AppError("RELEASE_NOT_ALLOWED");
  }
  return { cancelReason: "promotion-release", lateCancel: false };
};

export const cancelSignup = defineCallable({
  endpoint: "volunteer",
  op: "cancelSignup",
  auth: volunteerOf((input: { signupId: string }) => input.signupId),
  handler: async ({ input, caller, clock, deps, resource }) => {
    const { db } = deps;
    const nowMs = clock.nowMs();
    const signupRef = db.collection(COLLECTIONS.signups).doc(input.signupId);
    const instanceRef = db.collection(COLLECTIONS.instances).doc(resource.data.instanceId);

    return runTx(db, async (tx) => {
      const signup = readDoc<SignupDoc>(await tx.get(signupRef));
      const instance = readDoc<InstanceDoc>(await tx.get(instanceRef));
      if (signup === null || instance === null) throw new AppError("NOT_FOUND");

      // Idempotent: a retry after success returns the stored result.
      if (signup.status === "cancelled") return { status: "cancelled" as const, lateCancel: signup.lateCancel, promotedSignupId: null };

      const startMs = msOf(instance.start);
      if (nowMs >= startMs) throw new AppError("SHIFT_STARTED");
      if (signup.status !== "confirmed" && signup.status !== "waitlisted") throw new AppError("INVALID_TRANSITION");
      assertTransition(signup.status, "cancelled", "cancelSignup");
      const decision = decideCancel(signup, input.release === true, nowMs, startMs, deps.env.config);

      if (signup.status === "waitlisted") {
        tx.update(instanceRef, { waitlist: instance.waitlist.filter((entry) => entry.signupId !== input.signupId), updatedAt: ts(nowMs) });
      }
      // A freed seat goes to the waitlist (reads first, then every write).
      const seatsAfterCancel = Math.max(0, instance.signupCount - 1);
      const plan = signup.status === "confirmed" ? await readPromotion(tx, db, instance, seatsAfterCancel, nowMs) : null;
      const promotion = plan === null ? null : applyPromotion(tx, db, resource.data.instanceId, instance, plan, SYSTEM_ACTOR, "cancelSignup", nowMs);
      if (promotion !== null) {
        tx.update(instanceRef, { signupCount: seatsAfterCancel + promotion.seatsTaken, waitlist: promotion.waitlist, updatedAt: ts(nowMs) });
      }
      tx.update(signupRef, {
        status: "cancelled",
        cancelReason: decision.cancelReason,
        lateCancel: decision.lateCancel,
        cancelledAt: ts(nowMs),
        history: withHistory(signup.history, signup.status, "cancelled", caller.uid, "cancelSignup", nowMs),
        updatedAt: ts(nowMs)
      });
      return { status: "cancelled" as const, lateCancel: decision.lateCancel, promotedSignupId: promotion?.promotedSignupIds[0] ?? null };
    });
  }
});
