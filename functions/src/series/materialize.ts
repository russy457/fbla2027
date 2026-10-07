/**
 * materialize.ts
 * Creates a series' shifts for its window (SPEC 3.7, 7.3: today through
 * today + 8 weeks, or through endsOn) and moves materializedThrough and
 * nextExtendAt forward. Shared by upsertSeries, extendSeries, and the
 * runDueJobs series step.
 *
 * Shift ids are `{seriesId}_{YYYYMMDD}` (SPEC 5.2), and the whole pass runs
 * in one transaction that reads every candidate id first, so a retry, a
 * second coordinator, and the scheduler can all run it at once and each date
 * is created exactly once. A date that already has a shift (even a cancelled
 * one) is left alone; dates whose start has passed are skipped.
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  AppError,
  COLLECTIONS,
  HOUR_MS,
  MAX_SHIFT_HOURS,
  occurrenceTimes,
  ruleDatesBetween,
  seriesInstanceIdFor,
  seriesWindow,
  type AppConfig,
  type OpportunityDoc,
  type OrganizationDoc,
  type SeriesDoc
} from "@fbla/shared";
import { readDoc, runTx, ts } from "../lib/firestore";
import { newInstanceDoc, newInstanceSecret } from "../shifts/instanceRecords";
import { refreshNextInstanceStart } from "../shifts/opportunitySchedule";

export interface MaterializeResult {
  readonly created: number;
  readonly materializedThroughMs: number;
}

interface Occurrence {
  readonly id: string;
  readonly startMs: number;
  readonly endMs: number;
}

/** A date whose local times make a valid future shift (a fall-back day can stretch past 12 hours). */
const isCreatable = ({ startMs, endMs }: Occurrence, nowMs: number): boolean =>
  startMs > nowMs && endMs > startMs && endMs - startMs <= MAX_SHIFT_HOURS * HOUR_MS;

/** The series' rule dates inside the window, as shift ids and instants. */
export const windowOccurrences = (seriesId: string, series: SeriesDoc, fromYmd: string, throughYmd: string): Occurrence[] =>
  ruleDatesBetween(series, fromYmd, throughYmd).map((ymd) => ({ id: seriesInstanceIdFor(seriesId, ymd), ...occurrenceTimes(ymd, series.rule, series.timeZone) }));

export const materializeSeries = async (db: Firestore, config: AppConfig, seriesId: string, nowMs: number): Promise<MaterializeResult> => {
  const seriesRef = db.collection(COLLECTIONS.series).doc(seriesId);
  const result = await runTx(db, async (tx) => {
    const series = readDoc<SeriesDoc>(await tx.get(seriesRef));
    if (series === null) throw new AppError("NOT_FOUND");
    const [opportunity, org] = [
      readDoc<OpportunityDoc>(await tx.get(db.collection(COLLECTIONS.opportunities).doc(series.opportunityId))),
      readDoc<OrganizationDoc>(await tx.get(db.collection(COLLECTIONS.organizations).doc(series.orgId)))
    ];
    const window = seriesWindow({ ...series, nowMs, windowWeeks: config.seriesWindowWeeks });
    // An archived listing or org takes no new dates: the series ends where it is.
    const listing = opportunity !== null && org !== null && opportunity.status === "active" && !org.archived ? { opportunity, org } : null;
    const wanted = listing === null ? [] : windowOccurrences(seriesId, series, window.fromYmd, window.throughYmd).filter((item) => isCreatable(item, nowMs));
    const refs = wanted.map((item) => db.collection(COLLECTIONS.instances).doc(item.id));
    const existing = refs.length > 0 ? await tx.getAll(...refs) : [];
    const missing = wanted.filter((_item, index) => existing[index]?.exists !== true);

    // `missing` is empty when listing is null; the check narrows its type.
    if (listing !== null) for (const item of missing) {
      const instance = newInstanceDoc({
        opportunityId: series.opportunityId,
        ...listing,
        seriesId,
        times: item,
        capacity: series.capacity,
        config,
        nowMs
      });
      tx.create(db.collection(COLLECTIONS.instances).doc(item.id), instance);
      tx.set(db.collection(COLLECTIONS.instanceSecrets).doc(item.id), newInstanceSecret(nowMs));
    }
    const nextExtendAtMs = listing === null ? null : window.nextExtendAtMs;
    tx.update(seriesRef, {
      materializedThrough: ts(window.materializedThroughMs),
      nextExtendAt: nextExtendAtMs === null ? null : ts(nextExtendAtMs),
      status: nextExtendAtMs === null ? "ended" : "active",
      updatedAt: ts(nowMs)
    });
    return { created: missing.length, materializedThroughMs: window.materializedThroughMs, opportunityId: series.opportunityId };
  });
  if (result.created > 0) await refreshNextInstanceStart(db, result.opportunityId, nowMs);
  return { created: result.created, materializedThroughMs: result.materializedThroughMs };
};
