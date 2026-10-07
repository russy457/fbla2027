/**
 * coordinator.ts
 * The "coordinator" callable endpoint (plan G4). Coordinator operations (shifts, roster, attendance, hours approval) for one organization.
 * Register each new operation in the ops map below, one handler file per
 * operation under functions/src/ops/.
 */
import { defineCallable } from "../lib/defineCallable";
import { pingOp } from "../ops/ping";

export const coordinatorOps = {
  ping: pingOp
};

export const coordinator = defineCallable({ name: "coordinator", ops: coordinatorOps });
