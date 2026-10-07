/**
 * setDemoClock.ts
 * admin.setDemoClock (SPEC#clock, X12): "Advance clock 15 min" and "Reset
 * clock" on the admin page. Writes demoClock/global; every Function reads the
 * offset fresh per request (lib/requestClock.ts) while demo mode is on for a
 * demo- project. Refused with DEMO_MODE_REQUIRED anywhere else, so a real
 * deployment cannot shift time.
 */
import { AppError, MINUTE_MS, PATHS } from "@fbla/shared";
import { admin } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { ts } from "../lib/firestore";
import { offsetFromSnapshot } from "../lib/requestClock";

export const setDemoClock = defineCallable({
  endpoint: "admin",
  op: "setDemoClock",
  auth: admin(),
  handler: async ({ input, caller, deps }) => {
    if (!deps.env.demoClockAllowed) throw new AppError("DEMO_MODE_REQUIRED");
    const ref = deps.db.doc(PATHS.demoClock());
    const realNowMs = deps.nowMs();
    // A transaction so two quick "Advance" clicks served by different instances both count.
    const offsetMs = await deps.db.runTransaction(async (tx) => {
      const current = offsetFromSnapshot(await tx.get(ref));
      // offsetMs sets an absolute offset (0 resets); advanceMinutes moves relative to the current one.
      const next = input.offsetMs ?? current + (input.advanceMinutes ?? 0) * MINUTE_MS;
      tx.set(ref, { offsetMs: next, setBy: caller.uid, setAt: ts(realNowMs) });
      return next;
    });
    return { offsetMs, now: new Date(realNowMs + offsetMs).toISOString() };
  }
});
