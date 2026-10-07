/**
 * kiosk.ts
 * The "kiosk" callable endpoint (plan G4). Kiosk operations (rotating code, check-in, check-out). Gets minInstances 1 on competition day only (G4).
 * Register each new operation in the ops map below, one handler file per
 * operation under functions/src/ops/.
 */
import { defineCallable } from "../lib/defineCallable";
import { pingOp } from "../ops/ping";

export const kioskOps = {
  ping: pingOp
};

export const kiosk = defineCallable({ name: "kiosk", ops: kioskOps });
