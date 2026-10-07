/**
 * upsertSeries.ts
 * coordinator.upsertSeries (Tier 2, SPEC 5.2, 3.7), coordinator of the
 * opportunity's org. Creates or edits the one series of an opportunity and
 * materializes its shifts 8 weeks ahead.
 *
 *   id          hash("series", opportunityId): one series per opportunity
 *               (opportunities.seriesId is single), so a retried create lands
 *               on the same document without a request nonce
 *   rule        weekdays + local start/end time in the org zone; weekly,
 *               biweekly, or monthly (seriesRuleProblem -> SERIES_RULE_INVALID)
 *   shifts      `{seriesId}_{YYYYMMDD}`, created by materializeSeries
 *   edits       future shifts without volunteers follow the new rule; shifts
 *               with volunteers are kept as they are (series/reconcile.ts)
 */
import {
  AppError,
  COLLECTIONS,
  DEFAULT_TIME_ZONE,
  localDateIn,
  seriesRuleProblem,
  type OrganizationDoc,
  type SeriesDoc
} from "@fbla/shared";
import { coordinatorOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { readDoc, runTx, ts } from "../lib/firestore";
import { opportunityResource } from "../lib/orgAuth";
import { hashId } from "../lib/requestIds";
import { materializeSeries } from "../series/materialize";
import { reconcileSeriesShifts, type ReconcileResult } from "../series/reconcile";

const NOTHING_RECONCILED: ReconcileResult = { rescheduled: 0, removed: 0, keptWithVolunteers: 0 };

/** The deterministic series id of an opportunity. */
export const seriesIdForOpportunity = (opportunityId: string): string => hashId(["series", opportunityId], 20);

export const upsertSeries = defineCallable({
  endpoint: "coordinator",
  op: "upsertSeries",
  auth: coordinatorOf(opportunityResource((input: { opportunityId: string }) => input.opportunityId)),
  handler: async ({ input, caller, clock, deps, resource }) => {
    const { db, env } = deps;
    const nowMs = clock.nowMs();
    const endsOn = input.endsOn ?? null;
    if (seriesRuleProblem(input.rule, input.startsOn, endsOn) !== null) throw new AppError("SERIES_RULE_INVALID");
    if (resource.data.status !== "active") throw new AppError("INVALID_INPUT", { fields: "opportunityId" });
    const org = readDoc<OrganizationDoc>(await db.collection(COLLECTIONS.organizations).doc(resource.data.orgId).get());
    if (org === null) throw new AppError("NOT_FOUND");
    const timeZone = org.timeZone || DEFAULT_TIME_ZONE;
    // A series whose last date has already passed would never make a shift.
    if (endsOn !== null && endsOn < localDateIn(new Date(nowMs), timeZone)) throw new AppError("SERIES_RULE_INVALID");

    const seriesId = seriesIdForOpportunity(resource.id);
    const seriesRef = db.collection(COLLECTIONS.series).doc(seriesId);
    const opportunityRef = db.collection(COLLECTIONS.opportunities).doc(resource.id);
    const fields = { rule: input.rule, capacity: input.capacity, startsOn: input.startsOn, endsOn, timeZone };

    const { created, series } = await runTx(db, async (tx) => {
      const existing = readDoc<SeriesDoc>(await tx.get(seriesRef));
      const next: SeriesDoc =
        existing === null
          ? {
              orgId: resource.data.orgId,
              opportunityId: resource.id,
              ...fields,
              // materializeSeries sets the real window right after this write.
              materializedThrough: ts(nowMs),
              nextExtendAt: ts(nowMs),
              status: "active",
              createdBy: caller.uid,
              createdAt: ts(nowMs),
              updatedAt: ts(nowMs)
            }
          : { ...existing, ...fields, status: "active", updatedAt: ts(nowMs) };
      tx.set(seriesRef, next);
      if (resource.data.seriesId !== seriesId) tx.update(opportunityRef, { seriesId, updatedAt: ts(nowMs) });
      return { created: existing === null, series: next };
    });

    const reconciled = created ? NOTHING_RECONCILED : await reconcileSeriesShifts(db, env.config, seriesId, series, nowMs);
    const { created: materialized } = await materializeSeries(db, env.config, seriesId, nowMs);
    return { seriesId, created, materialized, ...reconciled };
  }
});
