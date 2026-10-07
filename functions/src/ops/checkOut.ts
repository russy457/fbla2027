/**
 * checkOut.ts
 * kiosk.checkOut (SPEC#fn-checkout, SPEC 5.4). Moves a checked-in signup to
 * completed and writes hoursLogs/{signupId} with source "kiosk" and status
 * "approved": a typed kiosk code is the verification, so kiosk hours need no
 * coordinator review. The log id equals the signup id, which makes a retried
 * check-out land on the same log (one HoursLog per signup, never two).
 *
 * Check order differs slightly from SPEC 5.4's general list on purpose: the
 * check-out window is measured from checkInAt, so NOT_CHECKED_IN must be
 * decided before the window (there is no window without a check-in). Then
 * window, then code, as in checkIn.
 */
import {
  AppError,
  COLLECTIONS,
  assertTransition,
  checkOutWindow,
  creditedMinutes,
  formatClockTime,
  signupIdFor,
  totalApprovedHours,
  type HoursLogDoc,
  type InstanceDoc,
  type SignupDoc
} from "@fbla/shared";
import type { Firestore } from "firebase-admin/firestore";
import { loadOrNotFound, profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";
import { CHECKIN_RATE_LIMIT } from "../lib/rateLimit";
import { instanceKey, verifyKioskCode } from "../kiosk/kioskCode";
import { newShiftHoursLog } from "../shifts/hoursRecords";
import { withHistory } from "../shifts/signupRecords";

/** Sum of the volunteer's approved minutes as hours (equality-only query, so no composite index). */
export const approvedHoursFor = async (db: Firestore, uid: string): Promise<number> => {
  const logs = await db.collection(COLLECTIONS.hoursLogs).where("uid", "==", uid).where("status", "==", "approved").get();
  return totalApprovedHours(logs.docs.map((doc) => (doc.data() as HoursLogDoc).minutes));
};

export const checkOut = defineCallable({
  endpoint: "kiosk",
  op: "checkOut",
  auth: profileComplete(),
  rateLimit: CHECKIN_RATE_LIMIT,
  handler: async ({ input, caller, clock, deps }) => {
    const { db, env } = deps;
    const config = env.config;
    const nowMs = clock.nowMs();
    await loadOrNotFound<InstanceDoc>(db, COLLECTIONS.instances, input.instanceId);
    const key = await instanceKey(db, env.kioskMasterSecret, input.instanceId, nowMs);
    const signupId = signupIdFor(input.instanceId, caller.uid);
    const instanceRef = db.collection(COLLECTIONS.instances).doc(input.instanceId);
    const signupRef = db.collection(COLLECTIONS.signups).doc(signupId);
    const logRef = db.collection(COLLECTIONS.hoursLogs).doc(signupId);

    const result = await runTx(db, async (tx) => {
      const instance = readDoc<InstanceDoc>(await tx.get(instanceRef));
      const signup = readDoc<SignupDoc>(await tx.get(signupRef));
      const existingLog = readDoc<HoursLogDoc>(await tx.get(logRef));
      if (instance === null) throw new AppError("NOT_FOUND");
      if (instance.status === "cancelled") throw new AppError("SHIFT_CANCELLED");

      // Idempotent retry: already completed returns the existing log.
      if (signup?.status === "completed" && existingLog !== null) {
        return { minutes: existingLog.minutes, orgName: instance.orgName };
      }
      if (signup === null || signup.status !== "checked-in" || signup.checkInAt === null) throw new AppError("NOT_CHECKED_IN");

      const window = checkOutWindow(msOf(signup.checkInAt), msOf(instance.end), config);
      if (nowMs < window.fromMs) {
        throw new AppError("CHECKOUT_NOT_OPEN", {
          opensAt: new Date(window.fromMs).toISOString(),
          opensAtLabel: formatClockTime(new Date(window.fromMs), instance.timeZone)
        });
      }
      if (nowMs > window.toMs) throw new AppError("CHECKOUT_CLOSED");
      if (!verifyKioskCode(key, input.code, nowMs, config.kioskRotationSec)) throw new AppError("KIOSK_CODE_INVALID");
      assertTransition("checked-in", "completed", "checkOut");

      const minutes = creditedMinutes({
        startMs: msOf(instance.start),
        endMs: msOf(instance.end),
        checkInMs: msOf(signup.checkInAt),
        checkOutMs: nowMs
      });
      tx.update(signupRef, {
        status: "completed",
        checkOutAt: ts(nowMs),
        history: withHistory(signup.history, "checked-in", "completed", caller.uid, "checkOut", nowMs),
        updatedAt: ts(nowMs)
      });
      tx.set(logRef, newShiftHoursLog({ signupId, signup, instance, minutes, source: "kiosk", nowMs }));
      return { minutes, orgName: instance.orgName };
    });

    return {
      status: "completed" as const,
      minutes: result.minutes,
      orgName: result.orgName,
      totalApprovedHours: await approvedHoursFor(db, caller.uid)
    };
  }
});
