/**
 * extendSeries.ts
 * coordinator.extendSeries (Tier 2, SPEC 5.2), coordinator of the series'
 * org. Creates any missing shifts through today + 8 weeks; runDueJobs runs
 * the same materializer for every series whose nextExtendAt has come
 * (series/extendDueSeries.ts). Deterministic ids make repeats a no-op.
 */
import { coordinatorOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { seriesResource } from "../lib/seriesAuth";
import { materializeSeries } from "../series/materialize";

export const extendSeries = defineCallable({
  endpoint: "coordinator",
  op: "extendSeries",
  auth: coordinatorOf(seriesResource((input: { seriesId: string }) => input.seriesId)),
  handler: async ({ input, clock, deps }) => {
    const result = await materializeSeries(deps.db, deps.env.config, input.seriesId, clock.nowMs());
    return { created: result.created, materializedThrough: new Date(result.materializedThroughMs).toISOString() };
  }
});
