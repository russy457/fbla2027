/**
 * volunteer.ts
 * The "volunteer" callable endpoint (plan G4). Volunteer operations (signup, cancel, hours, letters) arrive in Tier 0 and Tier 1.
 * Register each new operation in the ops map below, one handler file per
 * operation under functions/src/ops/.
 */
import { defineCallable } from "../lib/defineCallable";
import { pingOp } from "../ops/ping";

export const volunteerOps = {
  ping: pingOp
};

export const volunteer = defineCallable({ name: "volunteer", ops: volunteerOps });
