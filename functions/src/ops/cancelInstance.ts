/**
 * cancelInstance.ts
 * coordinator.cancelInstance (SPEC#fn-cancelinstance, SPEC#state-machine
 * rows 4, 5, 7). The shift is marked cancelled first (so check-ins stop at
 * once), then each signup is settled in its own small transaction that
 * re-reads its status (safe to repeat, like finalize):
 *   waitlisted, confirmed -> cancelled (cancelReason org-cancelled, never a
 *                            late cancel, not counted against reliability)
 *   checked-in            -> completed mid-shift: hours credited up to the
 *                            cancel time, logged pending + needsReview with
 *                            source org-cancel for a coordinator to confirm
 * Each cancelled signup gets a "shift-cancelled" notification (SPEC 8.3) in
 * the same transaction as its status change, keyed by signupId, so a repeat
 * call never alerts twice. A shift that already ended cannot be cancelled
 * (SHIFT_ENDED). A repeat call returns the totals with alreadyCancelled: true.
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  AppError,
  COLLECTIONS,
  assertTransition,
  creditedMinutes,
  shiftCancelledNotification,
  type HoursLogDoc,
  type InstanceDoc,
  type SignupDoc
} from "@fbla/shared";
import { coordinatorOf, instanceResource } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";
import { queueNotification } from "../notifications/notify";
import { newShiftHoursLog } from "../shifts/hoursRecords";
import { refreshNextInstanceStart } from "../shifts/opportunitySchedule";
import { withHistory } from "../shifts/signupRecords";

/** Marks the shift cancelled; returns the instance and whether it was already cancelled. */
const markCancelled = (db: Firestore, instanceId: string, actor: string, reason: string, nowMs: number) =>
  runTx(db, async (tx) => {
    const ref = db.collection(COLLECTIONS.instances).doc(instanceId);
    const instance = readDoc<InstanceDoc>(await tx.get(ref));
    if (instance === null) throw new AppError("NOT_FOUND");
    if (instance.status === "cancelled") return { instance, already: true };
    if (instance.status === "finalized" || nowMs >= msOf(instance.end)) throw new AppError("SHIFT_ENDED");
    tx.update(ref, {
      status: "cancelled",
      cancelledAt: ts(nowMs),
      cancelledBy: actor,
      cancelReason: reason,
      nextActionAt: null,
      waitlist: [],
      sequence: instance.sequence + 1,
      updatedAt: ts(nowMs)
    });
    return { instance, already: false };
  });

/** Settles one signup; returns its status afterwards. */
const settleSignup = (db: Firestore, signupId: string, instance: InstanceDoc, actor: string, nowMs: number) =>
  runTx(db, async (tx) => {
    const signupRef = db.collection(COLLECTIONS.signups).doc(signupId);
    const logRef = db.collection(COLLECTIONS.hoursLogs).doc(signupId);
    const signup = readDoc<SignupDoc>(await tx.get(signupRef));
    const log = await tx.get(logRef);
    if (signup === null) return null;
    const history = (to: SignupDoc["status"]) => withHistory(signup.history, signup.status, to, actor, "cancelInstance", nowMs);

    if (signup.status === "waitlisted" || signup.status === "confirmed") {
      assertTransition(signup.status, "cancelled", "cancelInstance");
      tx.update(signupRef, { status: "cancelled", cancelReason: "org-cancelled", lateCancel: false, cancelledAt: ts(nowMs), history: history("cancelled"), updatedAt: ts(nowMs) });
      const content = shiftCancelledNotification({
        instanceId: signup.instanceId,
        signupId,
        title: instance.title,
        orgName: instance.orgName,
        startMs: msOf(instance.start),
        timeZone: instance.timeZone
      });
      queueNotification(tx, db, signup.uid, content, signupId, nowMs);
      return "cancelled";
    }
    if (signup.status === "checked-in" && signup.checkInAt !== null) {
      assertTransition("checked-in", "completed", "cancelInstance");
      const minutes = creditedMinutes({ startMs: msOf(instance.start), endMs: msOf(instance.end), checkInMs: msOf(signup.checkInAt), checkOutMs: nowMs });
      tx.update(signupRef, { status: "completed", autoCompleted: true, checkOutAt: ts(nowMs), history: history("completed"), updatedAt: ts(nowMs) });
      if (!log.exists) {
        const pending: HoursLogDoc = { ...newShiftHoursLog({ signupId, signup, instance, minutes, source: "finalize", nowMs }), source: "org-cancel" };
        tx.set(logRef, pending);
      }
      return "completed";
    }
    return signup.status;
  });

export const cancelInstance = defineCallable({
  endpoint: "coordinator",
  op: "cancelInstance",
  auth: coordinatorOf(instanceResource((input: { instanceId: string }) => input.instanceId)),
  handler: async ({ input, caller, clock, deps }) => {
    const { db } = deps;
    const nowMs = clock.nowMs();
    const { instance, already } = await markCancelled(db, input.instanceId, caller.uid, input.reason, nowMs);
    const signups = await db.collection(COLLECTIONS.signups).where("instanceId", "==", input.instanceId).get();
    for (const doc of signups.docs) await settleSignup(db, doc.id, instance, caller.uid, nowMs);

    const settled = (await db.collection(COLLECTIONS.signups).where("instanceId", "==", input.instanceId).get()).docs.map((doc) => doc.data() as SignupDoc);
    const cancelledSignups = settled.filter((signup) => signup.cancelReason === "org-cancelled").length;
    const completedSignups = settled.filter((signup) => signup.status === "completed").length;
    await db.collection(COLLECTIONS.instances).doc(input.instanceId).update({ signupCount: completedSignups, updatedAt: ts(nowMs) });
    if (!already) await refreshNextInstanceStart(db, instance.opportunityId, nowMs);
    return { cancelledSignups, completedSignups, alreadyCancelled: already };
  }
});
