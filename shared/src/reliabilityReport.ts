/**
 * reliabilityReport.ts
 * Reliability charts for the two reports (SPEC 8.6 "reliability distribution
 * (Tier 2 charts)", SPEC 7.2). Both use computeReliability, the same formula
 * as the stored track record, on signups whose shift started inside the
 * report range, evaluated at the end of the range, so a report is a pure
 * function of its range (preview, PDF, and CSV agree no matter when each is
 * made).
 *
 *   reliabilityDistribution(signups, range)  org report: how many of the
 *       org's volunteers fall in each attendance band. Counts only, never
 *       names (T3: reliability is not shown on any public surface, and a
 *       coordinator report is not the place to single people out).
 *   trackRecordFor(signups, range)           volunteer report: the person's
 *       own attended / no-show / late-cancel counts and the neutral sentence
 *       "Attended 8 of 10 recent shifts" (D12, never a colored score).
 *
 * Only volunteers with at least one finished signup in the range appear in
 * the distribution; someone who only signed up for future shifts has no
 * record to describe yet.
 */
import { computeReliability, reliabilitySummary, type ReliabilityResult } from "./reliability";
import type { SignupStatus } from "./schemas/common";

export interface ReliabilityReportSignup {
  readonly uid: string;
  readonly status: SignupStatus;
  readonly lateCancel: boolean;
  /** Shift start, epoch ms. */
  readonly startMs: number;
}

export interface ReliabilityReportRange {
  readonly fromMs: number;
  readonly toExclusiveMs: number;
}

export const RELIABILITY_BUCKETS = ["new", "under-50", "50-79", "80-99", "100"] as const;
export type ReliabilityBucket = (typeof RELIABILITY_BUCKETS)[number];

export const RELIABILITY_BUCKET_LABELS: Readonly<Record<ReliabilityBucket, string>> = {
  new: "New (fewer than 3 shifts)",
  "under-50": "Under 50%",
  "50-79": "50 to 79%",
  "80-99": "80 to 99%",
  "100": "100%"
};

export interface ReliabilityBucketCount {
  readonly bucket: ReliabilityBucket;
  readonly label: string;
  readonly volunteers: number;
}

export interface ReliabilityDistribution {
  /** One row per band, in RELIABILITY_BUCKETS order, zeros included. */
  readonly buckets: ReliabilityBucketCount[];
  /** Volunteers with at least one finished shift in the range. */
  readonly volunteers: number;
}

/** Score thresholds for the bands (score is attended / weighted total, 0..1). */
const FULL = 1;
const HIGH = 0.8;
const MID = 0.5;

/** The band a track record falls in; "new" while there are fewer than 3 finished shifts. */
export const reliabilityBucketOf = (result: Pick<ReliabilityResult, "isNew" | "score">): ReliabilityBucket => {
  if (result.isNew || result.score === null) return "new";
  if (result.score >= FULL) return "100";
  if (result.score >= HIGH) return "80-99";
  if (result.score >= MID) return "50-79";
  return "under-50";
};

const inRange = (signup: ReliabilityReportSignup, range: ReliabilityReportRange): boolean =>
  signup.startMs >= range.fromMs && signup.startMs < range.toExclusiveMs;

const recordOf = (signups: readonly ReliabilityReportSignup[], range: ReliabilityReportRange): ReliabilityResult =>
  computeReliability(
    signups.filter((signup) => inRange(signup, range)).map((signup) => ({ status: signup.status, lateCancel: signup.lateCancel, instanceStartMs: signup.startMs })),
    range.toExclusiveMs
  );

export const reliabilityDistribution = (signups: readonly ReliabilityReportSignup[], range: ReliabilityReportRange): ReliabilityDistribution => {
  const byVolunteer = signups.reduce<Map<string, ReliabilityReportSignup[]>>(
    (map, signup) => new Map(map).set(signup.uid, [...(map.get(signup.uid) ?? []), signup]),
    new Map()
  );
  const records = [...byVolunteer.values()].map((own) => recordOf(own, range)).filter((record) => record.total > 0);
  const counts = records.reduce<Map<ReliabilityBucket, number>>((map, record) => {
    const bucket = reliabilityBucketOf(record);
    return new Map(map).set(bucket, (map.get(bucket) ?? 0) + 1);
  }, new Map());
  return {
    buckets: RELIABILITY_BUCKETS.map((bucket) => ({ bucket, label: RELIABILITY_BUCKET_LABELS[bucket], volunteers: counts.get(bucket) ?? 0 })),
    volunteers: records.length
  };
};

export const TRACK_RECORD_ROWS = ["attended", "noShows", "lateCancels"] as const;
export type TrackRecordRow = (typeof TRACK_RECORD_ROWS)[number];

export const TRACK_RECORD_LABELS: Readonly<Record<TrackRecordRow, string>> = {
  attended: "Attended",
  noShows: "No-shows",
  lateCancels: "Late cancels"
};

export interface TrackRecordReport {
  readonly attended: number;
  readonly noShows: number;
  readonly lateCancels: number;
  readonly total: number;
  readonly isNew: boolean;
  /** "Attended 8 of 10 recent shifts" or "New volunteer" (D12). */
  readonly summary: string;
  /** Chart rows in TRACK_RECORD_ROWS order. */
  readonly rows: ReadonlyArray<{ readonly key: TrackRecordRow; readonly label: string; readonly count: number }>;
}

export const trackRecordFor = (signups: readonly ReliabilityReportSignup[], range: ReliabilityReportRange): TrackRecordReport => {
  const record = recordOf(signups, range);
  return {
    attended: record.attended,
    noShows: record.noShows,
    lateCancels: record.lateCancels,
    total: record.total,
    isNew: record.isNew,
    summary: reliabilitySummary(record),
    rows: TRACK_RECORD_ROWS.map((key) => ({ key, label: TRACK_RECORD_LABELS[key], count: record[key] }))
  };
};
