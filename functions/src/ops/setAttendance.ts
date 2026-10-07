/**
 * setAttendance.ts
 * coordinator.setAttendance (SPEC#fn-setattendance, SPEC 5.7, state machine
 * rows 10-12). A coordinator of the signup's org corrects attendance with a
 * required note:
 *   no-show   -> excused     excuseReason coordinator; no hours
 *   no-show   -> completed   hoursLogs/{signupId}: source coordinator,
 *                            approved, minutes from input (MINUTES_REQUIRED;
 *                            0 to the scheduled length, 15-minute steps)
 *   completed -> no-show     the log becomes rejected (attendance-changed),
 *                            which fires supersedeLetters for any letter
 *                            counting it (G19)
 *   keep                     no-show with an open dispute: close it, no change
 * Every change closes an open dispute, records attendance {by, at, note},
 * and appends history. Asking for the current status is a no-op.
 */
import type { DocumentReference, Timestamp, Transaction } from "firebase-admin/firestore";
import {
  AppError,
  COLLECTIONS,
  MINUTE_MS,
  assertTransition,
  type AttendanceTarget,
  type HoursLogDoc,
  type InstanceDoc,
  type SignupDoc
} from "@fbla/shared";
import { coordinatorOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";
import { signupResource } from "../lib/orgAuth";
import { withHistory } from "../shifts/signupRecords";

interface AttendanceInput {
  readonly signupId: string;
  readonly to: AttendanceTarget;
  readonly minutes?: number | undefined;
  readonly note: string;
}

const coordinatorLog = (signup: SignupDoc, instance: InstanceDoc, signupId: string, minutes: number, uid: string, at: Timestamp): HoursLogDoc => ({
  uid: signup.uid,
  orgId: signup.orgId,
  instanceId: signup.instanceId,
  signupId,
  source: "coordinator",
  date: instance.start,
  minutes,
  status: "approved",
  needsReview: false,
  description: null,
  reviewedBy: uid,
  reviewedAt: at,
  rejectReason: null,
  displayName: signup.displayName,
  createdAt: at,
  updatedAt: at
});

/** Writes the hours side of the change; returns the log id it touched. */
const writeHours = (tx: Transaction, refs: { log: DocumentReference }, params: {
  input: AttendanceInput; signup: SignupDoc; instance: InstanceDoc; logExists: boolean; uid: string; at: Timestamp;
}): string | null => {
  const { input, signup, instance, at } = params;
  if (input.to === "completed") {
    if (input.minutes === undefined) throw new AppError("MINUTES_REQUIRED");
    const scheduled = Math.floor((msOf(instance.end) - msOf(instance.start)) / MINUTE_MS);
    if (input.minutes > scheduled) throw new AppError("INVALID_INPUT", { fields: "minutes" });
    tx.set(refs.log, coordinatorLog(signup, instance, input.signupId, input.minutes, params.uid, at));
    return input.signupId;
  }
  if (input.to === "no-show" && params.logExists) {
    tx.update(refs.log, { status: "rejected", needsReview: false, rejectReason: "attendance-changed", reviewedBy: params.uid, reviewedAt: at, updatedAt: at });
    return input.signupId;
  }
  return null;
};

export const setAttendance = defineCallable({
  endpoint: "coordinator",
  op: "setAttendance",
  auth: coordinatorOf(signupResource((input: { signupId: string }) => input.signupId)),
  handler: async ({ input, caller, clock, deps }) => {
    const { db } = deps;
    const nowMs = clock.nowMs();
    const at = ts(nowMs);
    const signupRef = db.collection(COLLECTIONS.signups).doc(input.signupId);
    const logRef = db.collection(COLLECTIONS.hoursLogs).doc(input.signupId);

    return runTx(db, async (tx) => {
      const signup = readDoc<SignupDoc>(await tx.get(signupRef));
      if (signup === null) throw new AppError("NOT_FOUND");
      const instance = readDoc<InstanceDoc>(await tx.get(db.collection(COLLECTIONS.instances).doc(signup.instanceId)));
      if (instance === null) throw new AppError("NOT_FOUND");
      const logExists = (await tx.get(logRef)).exists;

      if (input.to === signup.status) return { status: signup.status, logId: null, changed: false };
      const closeDispute = signup.disputeOpen && signup.dispute !== null
        ? { disputeOpen: false, dispute: { ...signup.dispute, resolvedAt: at, resolvedBy: caller.uid } }
        : {};
      const attendance = { attendance: { by: caller.uid, at, note: input.note }, updatedAt: at };

      if (input.to === "keep") {
        if (signup.status !== "no-show" || !signup.disputeOpen) throw new AppError("INVALID_TRANSITION", { from: signup.status, to: "keep" });
        tx.update(signupRef, { ...closeDispute, ...attendance });
        return { status: signup.status, logId: null, changed: true };
      }

      assertTransition(signup.status, input.to, "setAttendance");
      const logId = writeHours(tx, { log: logRef }, { input, signup, instance, logExists, uid: caller.uid, at });
      tx.update(signupRef, {
        status: input.to,
        ...(input.to === "excused" ? { excuseReason: "coordinator" } : {}),
        ...closeDispute,
        ...attendance,
        history: withHistory(signup.history, signup.status, input.to, caller.uid, "setAttendance", nowMs)
      });
      // TODO(lane A notify): "attendance-changed" notification to the volunteer.
      return { status: input.to, logId, changed: true };
    });
  }
});
