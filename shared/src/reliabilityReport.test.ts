/**
 * reliabilityReport.test.ts
 * Reliability charts in reports (SPEC 8.6, SPEC 7.2, Tier 2): the band a
 * track record falls in, the org distribution (range filter, people with no
 * finished shift left out, late cancels weighted half), the volunteer track
 * record, and that both report builders carry the same numbers.
 */
import { describe, expect, it } from "vitest";
import {
  RELIABILITY_BUCKETS,
  reliabilityBucketOf,
  reliabilityDistribution,
  trackRecordFor,
  type ReliabilityReportSignup
} from "./reliabilityReport";
import { buildOrgReport, buildVolunteerReport } from "./reportData";

const DAY = 86_400_000;
const FROM = Date.UTC(2026, 8, 1, 5);
const range = { fromMs: FROM, toExclusiveMs: FROM + 60 * DAY };

const signup = (uid: string, status: ReliabilityReportSignup["status"], day: number, lateCancel = false): ReliabilityReportSignup => ({
  uid,
  status,
  lateCancel,
  startMs: FROM + day * DAY
});

const many = (uid: string, statuses: ReadonlyArray<ReliabilityReportSignup["status"]>): ReliabilityReportSignup[] =>
  statuses.map((status, index) => signup(uid, status, index + 1));

const counts = (signups: readonly ReliabilityReportSignup[]): number[] => reliabilityDistribution(signups, range).buckets.map((row) => row.volunteers);

describe("reliabilityBucketOf", () => {
  it("maps new volunteers and each score band", () => {
    expect(reliabilityBucketOf({ isNew: true, score: null })).toBe("new");
    expect(reliabilityBucketOf({ isNew: false, score: null })).toBe("new");
    expect(reliabilityBucketOf({ isNew: false, score: 1 })).toBe("100");
    expect(reliabilityBucketOf({ isNew: false, score: 0.8 })).toBe("80-99");
    expect(reliabilityBucketOf({ isNew: false, score: 0.5 })).toBe("50-79");
    expect(reliabilityBucketOf({ isNew: false, score: 0.499 })).toBe("under-50");
  });
});

describe("reliabilityDistribution", () => {
  it("counts each volunteer once, in band order, with zero rows kept", () => {
    const signups = [
      ...many("perfect", ["completed", "completed", "completed"]),
      ...many("good", ["completed", "completed", "completed", "completed", "no-show"]),
      ...many("mid", ["completed", "completed", "no-show", "no-show"]),
      ...many("low", ["completed", "no-show", "no-show"]),
      ...many("new", ["completed"])
    ];
    const distribution = reliabilityDistribution(signups, range);
    expect(distribution.buckets.map((row) => row.bucket)).toEqual([...RELIABILITY_BUCKETS]);
    expect(counts(signups)).toEqual([1, 1, 1, 1, 1]);
    expect(distribution.volunteers).toBe(5);
    expect(distribution.buckets[0]?.label).toBe("New (fewer than 3 shifts)");
  });

  it("leaves out people with no finished shift and shifts outside the range", () => {
    const signups = [
      signup("upcoming", "confirmed", 50),
      signup("excused", "excused", 2),
      signup("early", "cancelled", 3, false),
      ...many("outside", ["completed", "completed", "completed"]).map((row) => ({ ...row, startMs: row.startMs - 30 * DAY }))
    ];
    expect(reliabilityDistribution(signups, range)).toMatchObject({ volunteers: 0 });
    expect(counts(signups)).toEqual([0, 0, 0, 0, 0]);
  });

  it("weighs a late cancel as half a no-show (SPEC 7.2)", () => {
    // 2 attended / (2 + 0.5) = 0.8 -> 80-99%; as a no-show it would be 0.667.
    const signups = [signup("v", "completed", 1), signup("v", "completed", 2), signup("v", "cancelled", 3, true)];
    expect(counts(signups)).toEqual([0, 0, 0, 1, 0]);
  });
});

describe("trackRecordFor", () => {
  it("returns counts, the D12 sentence, and chart rows", () => {
    const record = trackRecordFor([...many("v", ["completed", "completed", "no-show"]), signup("v", "cancelled", 9, true)], range);
    expect(record).toMatchObject({ attended: 2, noShows: 1, lateCancels: 1, total: 4, isNew: false, summary: "Attended 2 of 4 recent shifts" });
    expect(record.rows).toEqual([
      { key: "attended", label: "Attended", count: 2 },
      { key: "noShows", label: "No-shows", count: 1 },
      { key: "lateCancels", label: "Late cancels", count: 1 }
    ]);
  });

  it("says New volunteer with fewer than 3 finished shifts", () => {
    expect(trackRecordFor([], range)).toMatchObject({ total: 0, isNew: true, summary: "New volunteer" });
  });
});

describe("report builders carry the reliability data", () => {
  it("org report: built from the range- and opportunity-filtered signups", () => {
    const row = (id: string, status: "completed" | "no-show" | "cancelled", day: number, extra: { lateCancel?: boolean; opportunityId?: string } = {}) => ({
      id,
      uid: "u1",
      displayName: "Jordan R.",
      instanceId: "i1",
      opportunityId: extra.opportunityId ?? "oppA",
      status,
      startMs: FROM + day * DAY,
      ...(extra.lateCancel === undefined ? {} : { lateCancel: extra.lateCancel })
    });
    const signups = [row("a", "completed", 1), row("b", "completed", 2), row("c", "cancelled", 3, { lateCancel: true }), row("d", "no-show", 4, { opportunityId: "oppB" })];
    const shifts = { i1: { title: "Sort food", opportunityId: "oppA" } };
    const all = buildOrgReport({ logs: [], signups, shifts, range, timeZone: "America/Chicago", opportunityId: null });
    // 2 / (2 + 1 + 0.5) = 0.571 -> 50-79%
    expect(all.reliability.buckets.find((bucket) => bucket.bucket === "50-79")?.volunteers).toBe(1);
    const onlyA = buildOrgReport({ logs: [], signups, shifts, range, timeZone: "America/Chicago", opportunityId: "oppA" });
    expect(onlyA.reliability.buckets.find((bucket) => bucket.bucket === "80-99")?.volunteers).toBe(1);
  });

  it("volunteer report: track record from the given signups, or empty without them", () => {
    const base = { logs: [], orgs: {}, shifts: {}, range, timeZone: "America/Chicago" };
    expect(buildVolunteerReport(base).trackRecord).toMatchObject({ total: 0, isNew: true });
    expect(buildVolunteerReport({ ...base, signups: many("v", ["completed", "completed", "completed"]) }).trackRecord.summary).toBe("Attended 3 of 3 recent shifts");
  });
});
