/**
 * requestAttendanceReview.ts
 * volunteer.requestAttendanceReview (SPEC 5.2, T3, Appendix B item 30). A
 * volunteer marked no-show asks the org to review it, with a note, within
 * 30 days of the shift (DISPUTE_WINDOW_CLOSED after). It only opens the
 * dispute; the coordinator resolves it with setAttendance. Every coordinator
 * of the org gets a "dispute-opened" notification (SPEC 8.3) in the same
 * transaction, keyed by signupId. An already open dispute is returned
 * unchanged (and alerts no one again).
 */
import { AppError, COLLECTIONS, disputeOpenedNotification, isDisputeWindowOpen, type InstanceDoc, type MemberDoc, type SignupDoc } from "@fbla/shared";
import { volunteerOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";
import { queueNotification } from "../notifications/notify";

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
      if (!isDisputeWindowOpen(msOf(signup.instanceEnd), nowMs)) throw new AppError("DISPUTE_WINDOW_CLOSED");
      const instance = readDoc<InstanceDoc>(await tx.get(db.collection(COLLECTIONS.instances).doc(signup.instanceId)));
      if (instance === null) throw new AppError("NOT_FOUND");
      const members = await tx.get(db.collection(COLLECTIONS.organizations).doc(signup.orgId).collection(COLLECTIONS.members));
      tx.update(ref, {
        disputeOpen: true,
        dispute: { note: input.note, openedAt: ts(nowMs), resolvedAt: null, resolvedBy: null },
        updatedAt: ts(nowMs)
      });
      const content = disputeOpenedNotification(
        signup.displayName,
        {
          instanceId: signup.instanceId,
          signupId: input.signupId,
          title: instance.title,
          orgName: instance.orgName,
          startMs: msOf(instance.start),
          timeZone: instance.timeZone
        },
        signup.orgId
      );
      // Members docs exist only for owners and coordinators (SPEC 3.3).
      members.docs.forEach((doc) => queueNotification(tx, db, (doc.data() as MemberDoc).uid, content, input.signupId, nowMs));
      return { disputeOpen: true as const };
    });
  }
});
