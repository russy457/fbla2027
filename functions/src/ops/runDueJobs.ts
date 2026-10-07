/**
 * runDueJobs.ts
 * admin.runDueJobs (SPEC#fn-runduejobs): runs the scheduler now. This is the
 * "Run due jobs now" button, and the only way jobs run on the emulator,
 * where scheduled functions do not fire. The lease in jobs/runDueJobs.ts
 * keeps it from overlapping a scheduled run.
 */
import { admin } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { runDueJobs } from "../jobs/runDueJobs";

export const runDueJobsOp = defineCallable({
  endpoint: "admin",
  op: "runDueJobs",
  auth: admin(),
  handler: async ({ clock, deps }) => runDueJobs(deps, clock, "admin")
});
