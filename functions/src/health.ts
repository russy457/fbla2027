/**
 * health.ts
 * Plain HTTP health check (SPEC 2.3; used by the DEMO.md pre-flight check).
 * Returns {ok, version, demoMode, lastJobRunAt} plus the project and the
 * request clock's time, so a demo clock offset and a stalled scheduler are
 * both visible from one URL.
 */
import { onRequest } from "firebase-functions/v2/https";
import { COLLECTIONS, type JobRunDoc } from "@fbla/shared";
import { defaultDeps, type ServerDeps } from "./lib/deps";
import { isoOf } from "./lib/firestore";
import { requestClock } from "./lib/requestClock";

export interface HealthPayload {
  readonly ok: true;
  readonly version: string;
  readonly demoMode: boolean;
  readonly project: string;
  readonly time: string;
  readonly lastJobRunAt: string | null;
}

/** Start time of the newest jobRuns doc, or null when none exists or the read fails. */
const lastJobRunAt = async (deps: ServerDeps): Promise<string | null> => {
  try {
    const latest = await deps.db.collection(COLLECTIONS.jobRuns).orderBy("startedAt", "desc").limit(1).get();
    const run = latest.docs[0]?.data() as JobRunDoc | undefined;
    return run ? isoOf(run.startedAt) : null;
  } catch (error) {
    deps.log.warn("health could not read jobRuns", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
};

export const healthPayload = async (deps: ServerDeps): Promise<HealthPayload> => {
  const clock = await requestClock(deps);
  return {
    ok: true,
    version: deps.env.version,
    demoMode: deps.env.demoMode,
    project: deps.env.projectId,
    time: clock.now().toISOString(),
    lastJobRunAt: await lastJobRunAt(deps)
  };
};

export const health = onRequest(async (_request, response) => {
  response.set("Cache-Control", "no-store");
  response.json(await healthPayload(defaultDeps()));
});
