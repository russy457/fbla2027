/**
 * issueKioskCode.ts
 * kiosk.issueKioskCode (SPEC#fn-issuekioskcode, SPEC 5.10). Returns the code
 * for the current 30-second window. It is a pure function of the window, so
 * the kiosk can call it on every tick, on visibilitychange, and on reconnect
 * without side effects. Allowed from start - 30 min to end + 30 min, for the
 * kiosk token scoped to this instance or a coordinator of its org.
 */
import { AppError, isWithin, kioskCodeWindow, kioskWindowAt } from "@fbla/shared";
import { kioskOrCoordinatorOfInstance } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { msOf } from "../lib/firestore";
import { codeForWindow, instanceKey } from "../kiosk/kioskCode";

export const issueKioskCode = defineCallable({
  endpoint: "kiosk",
  op: "issueKioskCode",
  auth: kioskOrCoordinatorOfInstance((input: { instanceId: string }) => input.instanceId),
  handler: async ({ input, clock, deps, resource }) => {
    const instance = resource.data;
    const config = deps.env.config;
    const nowMs = clock.nowMs();
    if (instance.status === "cancelled") throw new AppError("SHIFT_CANCELLED");
    if (!isWithin(nowMs, kioskCodeWindow(msOf(instance.start), msOf(instance.end), config))) {
      throw new AppError("KIOSK_NOT_OPEN");
    }

    const key = await instanceKey(deps.db, deps.env.kioskMasterSecret, input.instanceId, nowMs);
    const window = kioskWindowAt(nowMs, config.kioskRotationSec);
    const code = codeForWindow(key, window.index);
    const query = new URLSearchParams({ i: input.instanceId, c: code });
    return {
      code,
      windowEndsAt: new Date(window.endsAtMs).toISOString(),
      secondsRemaining: window.secondsRemaining,
      qrPayload: `${deps.env.appBaseUrl}/checkin?${query.toString()}`
    };
  }
});
