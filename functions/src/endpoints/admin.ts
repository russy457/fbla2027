/**
 * admin.ts
 * The "admin" callable endpoint (SPEC 2.3, G4): run due jobs and the demo
 * clock. Every op requires the admin custom claim.
 */
import { defineEndpoint, type RegisteredOp } from "../lib/defineCallable";
import { pingOp } from "../ops/ping";
import { runDueJobsOp } from "../ops/runDueJobs";
import { setDemoClock } from "../ops/setDemoClock";

export const adminOps: readonly RegisteredOp[] = [pingOp("admin"), runDueJobsOp, setDemoClock];

export const admin = defineEndpoint("admin", adminOps);
