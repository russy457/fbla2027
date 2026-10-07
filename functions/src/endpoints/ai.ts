/**
 * ai.ts
 * The "ai" callable endpoint (SPEC 2.3, G4): ping and askAssistant (Tier 1);
 * shiftPlannerParse (Tier 2 lane B). 30 s timeout per SPEC.
 *
 * The provider key is bound as a secret only when AI_ENABLED is true at
 * deploy time, so a deploy with AI off never needs the secret to exist.
 * AI_PROVIDER picks which key (ANTHROPIC_API_KEY by default).
 */
import { readAiSettings, secretNameFor } from "../ai/aiSettings";
import { defineEndpoint, type RegisteredOp } from "../lib/defineCallable";
import { deploySecrets } from "../lib/secrets";
import { askAssistant } from "../ops/askAssistant";
import { pingOp } from "../ops/ping";
// Tier 2 lane B
import { shiftPlannerParse } from "../ops/shiftPlannerParse";
// End Tier 2 lane B

export const aiOps: readonly RegisteredOp[] = [
  pingOp("ai"),
  askAssistant,
  // Tier 2 lane B
  shiftPlannerParse
  // End Tier 2 lane B
];

const aiSecrets = () =>
  process.env.AI_ENABLED === "true" ? deploySecrets(secretNameFor(readAiSettings(process.env).provider)) : [];

export const ai = defineEndpoint("ai", aiOps, { timeoutSeconds: 30, secrets: aiSecrets() });
