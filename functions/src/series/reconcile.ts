/**
 * reconcile.ts
 * After a coordinator edits a series (upsertSeries), brings its existing
 * future shifts in line with the new rule, capacity, and end date:
 *
 *   no volunteers, date still in the rule   new times and capacity in place
 *                                           (sequence + 1 when the time moves)
 *   no volunteers, date dropped             shift and kiosk secret deleted
 *   volunteers signed up or waitlisted      left exactly as they are; the
 *                                           coordinator edits or cancels them
 *                                           one by one (updateInstance /
 *                                           cancelInstance notify people)
 *
 * Each shift is handled in its own transaction that re-reads it, so a
 * volunteer who signs up while the edit runs is never deleted out from under.
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  cutoffAtMs,
  finalizeAtMs,
  isRuleDate,
  occurrenceTimes,
  type AppConfig,
  type InstanceDoc,
  type SeriesDoc
} from "@fbla/shared";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";

export interface ReconcileResult {
  readonly rescheduled: number;
  readonly removed: number;
  readonly keptWithVolunteers: number;
}

type Action = "none" | "rescheduled" | "removed" | "kept";

const hasVolunteers = (instance: InstanceDoc): boolean => instance.signupCount > 0 || instance.waitlist.length > 0 || instance.checkedInCount > 0;

/** `{seriesId}_{YYYYMMDD}` back to `YYYY-MM-DD`. */
const dateOfId = (seriesId: string, instanceId: string): string => {
  const digits = instanceId.slice(seriesId.length + 1);
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

const inBounds = (series: SeriesDoc, ymd: string): boolean => ymd >= series.startsOn && (series.endsOn === null || ymd <= series.endsOn);

const reconcileOne = async (db: Firestore, config: AppConfig, seriesId: string, series: SeriesDoc, instanceId: string, nowMs: number): Promise<Action> => {
  const ref = db.collection(COLLECTIONS.instances).doc(instanceId);
  return runTx(db, async (tx): Promise<Action> => {
    const instance = readDoc<InstanceDoc>(await tx.get(ref));
    if (instance === null || instance.status !== "scheduled" || msOf(instance.start) <= nowMs) return "none";
    const ymd = dateOfId(seriesId, instanceId);
    const keep = inBounds(series, ymd) && isRuleDate(series.rule, series.startsOn, ymd);
    const times = occurrenceTimes(ymd, series.rule, series.timeZone);
    const unchanged = keep && msOf(instance.start) === times.startMs && msOf(instance.end) === times.endMs && instance.capacity === series.capacity;
    if (unchanged) return "none";
    if (hasVolunteers(instance)) return "kept";
    if (!keep || times.startMs <= nowMs) {
      tx.delete(ref);
      tx.delete(db.collection(COLLECTIONS.instanceSecrets).doc(instanceId));
      return "removed";
    }
    const moved = msOf(instance.start) !== times.startMs || msOf(instance.end) !== times.endMs;
    const cutoffAt = ts(cutoffAtMs(times.startMs, config));
    tx.update(ref, {
      start: ts(times.startMs),
      end: ts(times.endMs),
      cutoffAt,
      finalizeAt: ts(finalizeAtMs(times.endMs, config)),
      nextActionAt: cutoffAt,
      capacity: series.capacity,
      sequence: moved ? instance.sequence + 1 : instance.sequence,
      updatedAt: ts(nowMs)
    });
    return "rescheduled";
  });
};

export const reconcileSeriesShifts = async (db: Firestore, config: AppConfig, seriesId: string, series: SeriesDoc, nowMs: number): Promise<ReconcileResult> => {
  // Equality on seriesId uses the automatic single-field index.
  const snapshot = await db.collection(COLLECTIONS.instances).where("seriesId", "==", seriesId).get();
  const future = snapshot.docs.filter((doc) => {
    const instance = doc.data() as InstanceDoc;
    return instance.status === "scheduled" && msOf(instance.start) > nowMs;
  });
  const actions: Action[] = [];
  // One at a time: each is a small transaction, and the count is bounded by the 8-week window.
  for (const doc of future) actions.push(await reconcileOne(db, config, seriesId, series, doc.id, nowMs));
  const count = (action: Action) => actions.filter((item) => item === action).length;
  return { rescheduled: count("rescheduled"), removed: count("removed"), keptWithVolunteers: count("kept") };
};
