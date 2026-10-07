/**
 * ai.ts
 * The "ai" callable endpoint (SPEC 2.3, G4). Ping only in Tier 0;
 * askAssistant (Tier 1) and shiftPlannerParse (Tier 2) arrive later with the
 * per-user limits from shared config. 30 s timeout per SPEC.
 */
import { defineEndpoint, type RegisteredOp } from "../lib/defineCallable";
import { pingOp } from "../ops/ping";

export const aiOps: readonly RegisteredOp[] = [pingOp("ai")];

export const ai = defineEndpoint("ai", aiOps, { timeoutSeconds: 30 });
