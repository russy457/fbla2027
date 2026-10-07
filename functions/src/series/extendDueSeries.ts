/**
 * extendDueSeries.ts
 * The runDueJobs series step (SPEC#fn-runduejobs-detail step 5, query Q5):
 * `series where nextExtendAt <= now limit 50`, each materialized in turn.
 * A failure is recorded for that series only and retried on the next tick;
 * a series that reached its endsOn gets nextExtendAt = null and drops out.
 */
import { COLLECTIONS, isAppError } from "@fbla/shared";
import type { ServerDeps } from "../lib/deps";
import { ts } from "../lib/firestore";
import { materializeSeries } from "./materialize";

/** SPEC 5.11: at most 50 series per run. */
export const SERIES_PAGE_SIZE = 50;

export interface SeriesJobResult {
  /** Series examined this run (a full page means `more`). */
  readonly due: number;
  readonly extended: number;
  readonly errors: ReadonlyArray<{ id: string; code: string }>;
}

export const extendDueSeries = async (deps: ServerDeps, nowMs: number): Promise<SeriesJobResult> => {
  const due = await deps.db.collection(COLLECTIONS.series).where("nextExtendAt", "<=", ts(nowMs)).limit(SERIES_PAGE_SIZE).get();
  const errors: Array<{ id: string; code: string }> = [];
  let extended = 0;
  for (const doc of due.docs) {
    try {
      await materializeSeries(deps.db, deps.env.config, doc.id, nowMs);
      extended += 1;
    } catch (error) {
      const code = isAppError(error) ? error.code : "INTERNAL";
      errors.push({ id: doc.id, code });
      deps.log.error("runDueJobs series extension failed", { seriesId: doc.id, code, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { due: due.size, extended, errors };
};
