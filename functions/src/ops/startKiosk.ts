/**
 * startKiosk.ts
 * coordinator.startKiosk (SPEC#fn-startkiosk, SPEC 5.10, G15). Mints a
 * custom token scoped to one instance. The tablet signs the coordinator out
 * and signs in with this token, so the coordinator's own session is never
 * left on a shared device. The token's claims let it call issueKioskCode for
 * this instance and read this instance's roster, nothing else.
 */
import { randomBytes } from "node:crypto";
import { AppError, HOUR_MS, isWithin, kioskStartWindow } from "@fbla/shared";
import { coordinatorOf, instanceResource } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { msOf } from "../lib/firestore";

/** Firebase Auth uids are at most 128 characters. */
const MAX_UID_LENGTH = 128;

export const startKiosk = defineCallable({
  endpoint: "coordinator",
  op: "startKiosk",
  auth: coordinatorOf(instanceResource((input: { instanceId: string }) => input.instanceId)),
  handler: async ({ input, caller, clock, deps, resource, requestId }) => {
    const instance = resource.data;
    const config = deps.env.config;
    const nowMs = clock.nowMs();
    if (instance.status === "cancelled") throw new AppError("SHIFT_CANCELLED");
    if (instance.status === "finalized" || !isWithin(nowMs, kioskStartWindow(msOf(instance.start), msOf(instance.end), config))) {
      throw new AppError("KIOSK_NOT_OPEN");
    }

    const expiresAtMs = nowMs + config.kioskTokenHours * HOUR_MS;
    const kioskUid = `kiosk_${input.instanceId}_${randomBytes(4).toString("hex")}`.slice(0, MAX_UID_LENGTH);
    const customToken = await deps.auth.createCustomToken(kioskUid, {
      kioskInstanceId: input.instanceId,
      kioskOrgId: instance.orgId,
      kioskExp: expiresAtMs
    });
    // Audit line (SPEC: "log (kioskStartedBy)"); the token itself is never logged.
    deps.log.info("coordinator.startKiosk kiosk started", {
      kioskStartedBy: caller.uid,
      instanceId: input.instanceId,
      orgId: instance.orgId,
      requestId
    });
    return { customToken, expiresAt: new Date(expiresAtMs).toISOString() };
  }
});
