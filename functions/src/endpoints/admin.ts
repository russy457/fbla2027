/**
 * admin.ts
 * The "admin" callable endpoint (SPEC 2.3, G4): run due jobs, the demo
 * clock, and (Tier 1) reset demo data. Every op requires the admin custom
 * claim. 512 MB and 120 s because resetDemoData reseeds and renders a PDF.
 */
import { defineEndpoint, type RegisteredOp } from "../lib/defineCallable";
import { pingOp } from "../ops/ping";
import { runDueJobsOp } from "../ops/runDueJobs";
import { setDemoClock } from "../ops/setDemoClock";
// Tier 1 lane C
import { deploySecrets } from "../lib/secrets";
import { resetDemoData } from "../ops/resetDemoData";

export const adminOps: readonly RegisteredOp[] = [
  pingOp("admin"),
  runDueJobsOp,
  setDemoClock,
  // Tier 1 lane C
  resetDemoData
];

// Tier 1 lane C: resetDemoData reseeds demo accounts with DEMO_ACCOUNT_PASSWORD when deployed in DEMO_MODE.
const adminSecrets = () => (process.env.DEMO_MODE === "true" ? deploySecrets("DEMO_ACCOUNT_PASSWORD") : []);

export const admin = defineEndpoint("admin", adminOps, { timeoutSeconds: 120, memory: "512MiB", secrets: adminSecrets() });
