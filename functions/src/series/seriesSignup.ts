/**
 * seriesSignup.ts
 * Whole-series signup (Tier 2, SPEC 5.2 signupSeries / extendSeriesSignup,
 * SPEC 9.4). Signs the volunteer up for every upcoming shift of a series that
 * exists today, one transaction per date through the same signupForInstance
 * the single signup uses, so capacity, waitlist, cutoff, minimum age, and
 * minor rules apply to each date exactly as they would one at a time.
 *
 * A refused date is reported, not thrown: { outcome: "skipped", reason:
 * "SHIFT_FULL" }. A date already signed up reports its current status, so a
 * retry is harmless. Dates run one after another because every transaction
 * touches the same organization document (hasActivity).
 *
 * The series is not followed automatically (SPEC A.2 "Series signup no
 * auto-extend"): seriesSignups/{seriesId}_{uid}.coversThrough records the
 * last date tried, and extendSeriesSignup later adds only the dates after it.
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  AppError,
  COLLECTIONS,
  addDaysYmd,
  isAppError,
  lastMaterializedDate,
  localDateIn,
  ruleDatesBetween,
  seriesInstanceIdFor,
  seriesSignupIdFor,
  type InstanceDoc,
  type PrivateProfileDoc,
  type SeriesDoc,
  type SeriesSignupDoc,
  type SeriesSignupOutput,
  type SeriesSignupResult
} from "@fbla/shared";
import { msOf, readDoc, ts } from "../lib/firestore";
import { signupForInstance } from "../shifts/signupCore";

export interface SeriesSignupRequest {
  readonly seriesId: string;
  readonly uid: string;
  readonly profile: PrivateProfileDoc;
  readonly nowMs: number;
  /** extendSeriesSignup: start after the stored coversThrough instead of today. */
  readonly onlyAfterCoverage: boolean;
}

const signupOne = async (db: Firestore, id: string, date: string, request: SeriesSignupRequest): Promise<SeriesSignupResult> => {
  try {
    const outcome = await signupForInstance(db, { instanceId: id, uid: request.uid, profile: request.profile, nowMs: request.nowMs });
    // A date already completed or checked in still holds a seat: report it as confirmed.
    return { instanceId: id, date, outcome: outcome.status === "waitlisted" ? "waitlisted" : "confirmed" };
  } catch (error) {
    if (!isAppError(error)) throw error;
    return { instanceId: id, date, outcome: "skipped", reason: error.code };
  }
};

export const signupWholeSeries = async (db: Firestore, request: SeriesSignupRequest): Promise<SeriesSignupOutput> => {
  const series = readDoc<SeriesDoc>(await db.collection(COLLECTIONS.series).doc(request.seriesId).get());
  if (series === null) throw new AppError("NOT_FOUND");
  const recordRef = db.collection(COLLECTIONS.seriesSignups).doc(seriesSignupIdFor(request.seriesId, request.uid));
  const record = readDoc<SeriesSignupDoc>(await recordRef.get());

  const today = localDateIn(new Date(request.nowMs), series.timeZone);
  const covered = request.onlyAfterCoverage ? (record?.coversThrough ?? null) : null;
  const from = covered !== null && covered >= today ? addDaysYmd(covered, 1) : today;
  const through = lastMaterializedDate(msOf(series.materializedThrough), series.timeZone);
  const dates = from <= through ? ruleDatesBetween(series, from, through) : [];

  // Only dates that have a shift that has not started (a removed or past date is not "skipped").
  const candidates = dates.map((date) => ({ date, ref: db.collection(COLLECTIONS.instances).doc(seriesInstanceIdFor(request.seriesId, date)) }));
  const snapshots = candidates.length > 0 ? await db.getAll(...candidates.map((item) => item.ref)) : [];
  const upcoming = candidates.filter((_item, index) => {
    const snapshot = snapshots[index];
    return snapshot?.exists === true && msOf((snapshot.data() as InstanceDoc).start) > request.nowMs;
  });

  const results: SeriesSignupResult[] = [];
  for (const item of upcoming) results.push(await signupOne(db, item.ref.id, item.date, request));

  // Coverage only moves forward, and only once the series has dates at all.
  const reached = through >= series.startsOn ? through : null;
  const coversThrough = covered !== null && (reached === null || covered > reached) ? covered : reached;
  await recordRef.set({
    seriesId: request.seriesId,
    orgId: series.orgId,
    uid: request.uid,
    coversThrough,
    createdAt: record?.createdAt ?? ts(request.nowMs),
    updatedAt: ts(request.nowMs)
  } satisfies SeriesSignupDoc);
  return { results, coversThrough };
};
