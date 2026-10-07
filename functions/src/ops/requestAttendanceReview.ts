/**
 * requestAttendanceReview.ts
 * volunteer.requestAttendanceReview (SPEC 5.2, T3, Appendix B item 30). A
 * volunteer marked no-show asks the org to review it, with a note, within
 * 30 days of the shift (DISPUTE_WINDOW_CLOSED after). It only opens the
 * dispute; the coordinator resolves it with setAttendance. An already open
 * dispute is returned unchanged.
 */
import { AppError, COLLECTIONS, DAY_MS, type SignupDoc } from "@fbla/shared";
import { volunteerOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";

/** SPEC 7.3 DISPUTE_WINDOW_DAYS. */
export const DISPUTE_WINDOW_DAYS = 30;

export const requestAttendanceReview = defineCallable({
  endpoint: "volunteer",
  op: "requestAttendanceReview",
  auth: volunteerOf((input: { signupId: string }) => input.signupId),
  handler: async ({ input, clock, deps }) => {
    const { db } = deps;
    const nowMs = clock.nowMs();
    const ref = db.collection(COLLECTIONS.signups).doc(input.signupId);
    return runTx(db, async (tx) => {
      const signup = readDoc<SignupDoc>(await tx.get(ref));
      if (signup === null) throw new AppError("NOT_FOUND");
      if (signup.disputeOpen) return { disputeOpen: true as const };
      if (signup.status !== "no-show") throw new AppError("INVALID_TRANSITION", { from: signup.status, to: "review" });
      if (nowMs > msOf(signup.instanceEnd) + DISPUTE_WINDOW_DAYS * DAY_MS) throw new AppError("DISPUTE_WINDOW_CLOSED");
      tx.update(ref, {
        disputeOpen: true,
        dispute: { note: input.note, openedAt: ts(nowMs), resolvedAt: null, resolvedBy: null },
        updatedAt: ts(nowMs)
      });
      // TODO(lane A notify): "dispute-opened" notification to the org's coordinators.
      return { disputeOpen: true as const };
    });
  }
});
