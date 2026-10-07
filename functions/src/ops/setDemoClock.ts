/**
 * setDemoClock.ts
 * admin.setDemoClock (SPEC#clock, X12): "Advance clock 15 min" and "Reset
 * clock" on the admin page. Writes demoClock/global; every Function adds the
 * offset to "now" while demo mode is on for a demo- project. Refused with
 * DEMO_MODE_REQUIRED anywhere else, so a real deployment cannot shift time.
 */
import { AppError, MINUTE_MS, PATHS } from "@fbla/shared";
import { admin } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { ts } from "../lib/firestore";
import { forgetDemoOffset, readDemoOffsetMs } from "../lib/requestClock";

export const setDemoClock = defineCallable({
  endpoint: "admin",
  op: "setDemoClock",
  auth: admin(),
  handler: async ({ input, caller, deps }) => {
    if (!deps.env.demoClockAllowed) throw new AppError("DEMO_MODE_REQUIRED");
    forgetDemoOffset(deps.db);
    const current = await readDemoOffsetMs(deps);
    // offsetMs sets an absolute offset (0 resets); advanceMinutes moves relative to the current one.
    const offsetMs = input.offsetMs ?? current + (input.advanceMinutes ?? 0) * MINUTE_MS;
    const realNowMs = deps.nowMs();
    await deps.db.doc(PATHS.demoClock()).set({ offsetMs, setBy: caller.uid, setAt: ts(realNowMs) });
    forgetDemoOffset(deps.db);
    return { offsetMs, now: new Date(realNowMs + offsetMs).toISOString() };
  }
});
