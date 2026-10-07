/**
 * admin.ts
 * The "admin" callable endpoint (plan G4). Admin operations (verify organizations, run due jobs, demo controls). Requires the admin custom claim later.
 * Register each new operation in the ops map below, one handler file per
 * operation under functions/src/ops/.
 */
import { defineCallable } from "../lib/defineCallable";
import { pingOp } from "../ops/ping";

export const adminOps = {
  ping: pingOp
};

export const admin = defineCallable({ name: "admin", ops: adminOps });
