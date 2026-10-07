/**
 * volunteer.ts
 * The "volunteer" callable endpoint (SPEC 2.3, G4): profile, signup, cancel,
 * and letters. 512 MB because issueLetter renders a PDF.
 * Add an op: schema in shared/src/schemas/ops, entry in shared/src/ops.ts,
 * handler in functions/src/ops/<op>.ts, then list it here.
 */
import { defineEndpoint, type RegisteredOp } from "../lib/defineCallable";
import { deploySecrets } from "../lib/secrets";
import { cancelSignup } from "../ops/cancelSignup";
import { completeProfile } from "../ops/completeProfile";
import { issueLetter } from "../ops/issueLetter";
// Tier 1 lane A
import { markNotificationsRead } from "../ops/markNotificationsRead";
// End Tier 1 lane A
import { pingOp } from "../ops/ping";
import { signup } from "../ops/signup";

export const volunteerOps: readonly RegisteredOp[] = [
  pingOp("volunteer"),
  completeProfile,
  signup,
  cancelSignup,
  issueLetter,
  // Tier 1 lane A
  markNotificationsRead
  // End Tier 1 lane A
];

export const volunteer = defineEndpoint("volunteer", volunteerOps, { memory: "512MiB", secrets: deploySecrets("TURNSTILE_SECRET") });
