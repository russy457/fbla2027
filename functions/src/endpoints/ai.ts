/**
 * ai.ts
 * The "ai" callable endpoint (plan G4). AI assistant operations (askAssistant in Tier 1, shiftPlannerParse in Tier 2), with per-user limits from shared config.
 * Register each new operation in the ops map below, one handler file per
 * operation under functions/src/ops/.
 */
import { defineCallable } from "../lib/defineCallable";
import { pingOp } from "../ops/ping";

export const aiOps = {
  ping: pingOp
};

export const ai = defineCallable({ name: "ai", ops: aiOps });
