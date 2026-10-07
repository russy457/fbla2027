/**
 * runDueJobs.ts
 * The only scheduler (SPEC#fn-runduejobs-detail, G8). Every 5 minutes (and
 * whenever an admin presses "Run due jobs now") it:
 *   1. takes the lease jobLeases/runDueJobs for 4 minutes, or records a
 *      "skipped-lease" run and stops when another run holds it,
 *   2. pages instances whose nextActionAt <= now (oldest first, 200 per run),
 *   3. runs the waitlist cutoff and then finalizeShift when each is due,
 *   4. writes jobRuns/{runId} with counts, per-instance errors, and `more`
 *      when the page was full, then releases the lease.
 * Overlapping runs cannot double-process: the lease serializes them, and the
 * cutoffDoneAt / finalizedAt markers make every step a no-op on repeat.
 * Per-instance failures are logged and retried on the next tick.
 */
import { randomUUID } from "node:crypto";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  COLLECTIONS,
  PATHS,
  isAppError,
  type Clock,
  type InstanceDoc,
  type JobLeaseDoc,
  type JobOutcome,
  type JobProcessed,
  type JobRunDoc
} from "@fbla/shared";
import { defaultDeps, type ServerDeps } from "../lib/deps";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";
import { requestClock } from "../lib/requestClock";
import { runCutoff } from "../shifts/cutoff";
import { SYSTEM_ACTOR, finalizeInstance } from "../shifts/finalize";

export type JobTrigger = JobRunDoc["trigger"];

export interface RunDueJobsResult {
  readonly runId: string;
  readonly outcome: JobOutcome;
  readonly processed: JobProcessed;
  readonly more: boolean;
}

const NOTHING_PROCESSED: JobProcessed = { cutoffs: 0, finalized: 0, seriesExtended: 0 };

const isContention = (error: unknown): boolean => isAppError(error) && error.code === "CONTENTION";

/**
 * Takes the lease unless another run holds an unexpired one. Losing a
 * contention race on the lease document means another run is taking it
 * right now, so that also counts as "someone else holds the lease".
 */
const acquireLease = async (deps: ServerDeps, runId: string, nowMs: number): Promise<boolean> => {
  const ref = deps.db.doc(PATHS.runDueJobsLease());
  try {
    return await runTx(deps.db, async (tx) => {
      const lease = readDoc<JobLeaseDoc>(await tx.get(ref));
      if (lease !== null && lease.holder !== runId && msOf(lease.expiresAt) > nowMs) return false;
      tx.set(ref, { holder: runId, expiresAt: ts(nowMs + deps.env.config.jobLeaseSec * 1000) });
      return true;
    });
  } catch (error) {
    if (isContention(error)) return false;
    throw error;
  }
};

/**
 * Releases the lease only if this run still holds it (an expired lease may
 * have passed to another run). A failed release is logged, not thrown: the
 * lease expires on its own after jobLeaseSec.
 */
const releaseLease = async (deps: ServerDeps, runId: string): Promise<void> => {
  const ref = deps.db.doc(PATHS.runDueJobsLease());
  try {
    await runTx(deps.db, async (tx) => {
      const lease = readDoc<JobLeaseDoc>(await tx.get(ref));
      if (lease?.holder === runId) tx.delete(ref);
    });
  } catch (error) {
    deps.log.warn("runDueJobs could not release its lease; it will expire", { runId, error: error instanceof Error ? error.message : String(error) });
  }
};

interface InstanceWork {
  readonly cutoffs: number;
  readonly finalized: number;
}

/** Runs whatever is due for one instance. */
const processInstance = async (deps: ServerDeps, clock: Clock, id: string, instance: InstanceDoc): Promise<InstanceWork> => {
  const nowMs = clock.nowMs();
  if (instance.status === "cancelled") return { cutoffs: 0, finalized: 0 };
  const cutoffDue = instance.cutoffDoneAt === null && nowMs >= msOf(instance.cutoffAt);
  if (cutoffDue) await runCutoff(deps.db, id, nowMs);
  const cutoffs = cutoffDue ? 1 : 0;
  if (instance.finalizedAt !== null || nowMs < msOf(instance.finalizeAt)) return { cutoffs, finalized: 0 };
  const result = await finalizeInstance(deps.db, clock, deps.env.config, id, { actor: SYSTEM_ACTOR });
  return { cutoffs, finalized: result.alreadyFinalized ? 0 : 1 };
};

const writeRun = async (deps: ServerDeps, runId: string, run: JobRunDoc): Promise<void> => {
  await deps.db.collection(COLLECTIONS.jobRuns).doc(runId).set(run);
};

export const runDueJobs = async (deps: ServerDeps, clock: Clock, trigger: JobTrigger): Promise<RunDueJobsResult> => {
  const runId = randomUUID();
  const startedAt = ts(clock.nowMs());
  if (!(await acquireLease(deps, runId, clock.nowMs()))) {
    await writeRun(deps, runId, { trigger, startedAt, finishedAt: ts(clock.nowMs()), processed: NOTHING_PROCESSED, more: false, errors: [], outcome: "skipped-lease" });
    return { runId, outcome: "skipped-lease", processed: NOTHING_PROCESSED, more: false };
  }

  try {
    const pageSize = deps.env.config.jobPageSize;
    const due = await deps.db
      .collection(COLLECTIONS.instances)
      .where("nextActionAt", "<=", ts(clock.nowMs()))
      .orderBy("nextActionAt")
      .limit(pageSize)
      .get();

    // One instance at a time so a failure is isolated and logged, never aborting the page.
    const results: Array<InstanceWork | { id: string; code: string }> = [];
    for (const doc of due.docs) {
      try {
        results.push(await processInstance(deps, clock, doc.id, doc.data() as InstanceDoc));
      } catch (error) {
        const code = isAppError(error) ? error.code : "INTERNAL";
        results.push({ id: doc.id, code });
        deps.log.error("runDueJobs instance failed", { instanceId: doc.id, code, error: error instanceof Error ? error.message : String(error) });
      }
    }
    const errors = results.filter((result): result is { id: string; code: string } => "code" in result);
    const work = results.filter((result): result is InstanceWork => "finalized" in result);

    const processed: JobProcessed = {
      cutoffs: work.reduce((sum, item) => sum + item.cutoffs, 0),
      finalized: work.reduce((sum, item) => sum + item.finalized, 0),
      seriesExtended: 0
    };
    const outcome: JobOutcome = errors.length === 0 ? "ok" : errors.length < due.size ? "partial" : "error";
    const more = due.size === pageSize;
    await writeRun(deps, runId, { trigger, startedAt, finishedAt: ts(clock.nowMs()), processed, more, errors, outcome });
    deps.log.info("runDueJobs finished", { runId, trigger, outcome, ...processed, more, errorCount: errors.length });
    return { runId, outcome, processed, more };
  } finally {
    await releaseLease(deps, runId);
  }
};

/** Scheduled export. Scheduled functions do not fire on the emulator; use admin.runDueJobs there. */
export const scheduledRunDueJobs = onSchedule({ schedule: "every 5 minutes", timeZone: "America/Chicago" }, async () => {
  const deps = defaultDeps();
  await runDueJobs(deps, await requestClock(deps), "schedule");
});
