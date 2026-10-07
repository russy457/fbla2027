/**
 * checkIn.ts
 * kiosk.checkIn (SPEC#fn-checkin, SPEC 5.4). The volunteer types the code the
 * kiosk shows. Checks run in the SPEC order: rate limit (defineCallable),
 * instance status, time window, code, signup status. One exception: a signup
 * that is already checked in returns its existing check-in before the window
 * and code checks, so a retry after a dropped response succeeds even once the
 * code it used has rotated away.
 */
import {
  AppError,
  COLLECTIONS,
  assertTransition,
  checkInWindow,
  checkOutWindow,
  formatClockTime,
  isWithin,
  signupIdFor,
  type InstanceDoc,
  type SignupDoc
} from "@fbla/shared";
import { loadOrNotFound, profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { isoOf, msOf, readDoc, runTx, ts } from "../lib/firestore";
import { CHECKIN_RATE_LIMIT } from "../lib/rateLimit";
import { instanceKey, verifyKioskCode } from "../kiosk/kioskCode";
import { withHistory } from "../shifts/signupRecords";

export const checkIn = defineCallable({
  endpoint: "kiosk",
  op: "checkIn",
  auth: profileComplete(),
  rateLimit: CHECKIN_RATE_LIMIT,
  handler: async ({ input, caller, clock, deps }) => {
    const { db, env } = deps;
    const config = env.config;
    const nowMs = clock.nowMs();
    // Existence check before deriving a key, so no secret is ever created for a missing instance.
    await loadOrNotFound<InstanceDoc>(db, COLLECTIONS.instances, input.instanceId);
    const key = await instanceKey(db, env.kioskMasterSecret, input.instanceId, nowMs);
    const instanceRef = db.collection(COLLECTIONS.instances).doc(input.instanceId);
    const signupRef = db.collection(COLLECTIONS.signups).doc(signupIdFor(input.instanceId, caller.uid));

    const checkOutOpensAt = (instance: InstanceDoc, checkInMs: number) =>
      new Date(checkOutWindow(checkInMs, msOf(instance.end), config).fromMs).toISOString();

    return runTx(db, async (tx) => {
      const instance = readDoc<InstanceDoc>(await tx.get(instanceRef));
      const signup = readDoc<SignupDoc>(await tx.get(signupRef));
      if (instance === null) throw new AppError("NOT_FOUND");
      if (instance.status === "cancelled") throw new AppError("SHIFT_CANCELLED");

      if (signup?.status === "checked-in" && signup.checkInAt !== null) {
        return { status: "checked-in" as const, checkInAt: isoOf(signup.checkInAt), checkOutOpensAt: checkOutOpensAt(instance, msOf(signup.checkInAt)) };
      }

      const window = checkInWindow(msOf(instance.start), msOf(instance.end), config);
      if (instance.status === "finalized" || !isWithin(nowMs, window)) {
        throw new AppError("CHECKIN_NOT_OPEN", {
          opensAt: new Date(window.fromMs).toISOString(),
          opensAtLabel: formatClockTime(new Date(window.fromMs), instance.timeZone)
        });
      }
      if (!verifyKioskCode(key, input.code, nowMs, config.kioskRotationSec)) throw new AppError("KIOSK_CODE_INVALID");
      if (signup === null || signup.status !== "confirmed") throw new AppError("NOT_SIGNED_UP");
      assertTransition("confirmed", "checked-in", "checkIn");

      tx.update(signupRef, {
        status: "checked-in",
        checkInAt: ts(nowMs),
        history: withHistory(signup.history, "confirmed", "checked-in", caller.uid, "checkIn", nowMs),
        updatedAt: ts(nowMs)
      });
      tx.update(instanceRef, { checkedInCount: instance.checkedInCount + 1, updatedAt: ts(nowMs) });
      return { status: "checked-in" as const, checkInAt: new Date(nowMs).toISOString(), checkOutOpensAt: checkOutOpensAt(instance, nowMs) };
    });
  }
});
