/**
 * reliability.test.ts
 * SPEC#reliability 7.2 table cases: mixed history, fewer than 3, excused,
 * early / late / system cancels, a waitlisted cancel, promotion releases, the
 * 20-signup cap, and the 12-month drop.
 */
import { describe, expect, it } from "vitest";
import {
  NEW_VOLUNTEER_RANKING_SCORE,
  computeReliability,
  isFinishedForReliability,
  rankingReliability,
  reliabilitySummary,
  type ReliabilitySignup
} from "./reliability";
import { DAY_MS } from "./time";

const NOW = Date.UTC(2026, 9, 17, 15, 0, 0);

const at = (daysAgo: number, status: ReliabilitySignup["status"], lateCancel = false): ReliabilitySignup => ({
  status,
  lateCancel,
  instanceStartMs: NOW - daysAgo * DAY_MS
});

describe("computeReliability", () => {
  it("counts a mixed history and weighs late cancels as half", () => {
    const result = computeReliability(
      [at(1, "completed"), at(2, "completed"), at(3, "no-show"), at(4, "cancelled", true), at(5, "completed")],
      NOW
    );
    expect(result).toEqual({
      attended: 3,
      noShows: 1,
      lateCancels: 1,
      total: 5,
      score: Math.round((3 / 4.5) * 1000) / 1000,
      isNew: false,
      windowFromMs: NOW - 5 * DAY_MS
    });
  });

  it("marks fewer than 3 finished shifts as new with no score", () => {
    const result = computeReliability([at(1, "completed"), at(2, "no-show")], NOW);
    expect(result).toMatchObject({ attended: 1, noShows: 1, total: 2, isNew: true, score: null });
  });

  it("returns an empty window for no history", () => {
    expect(computeReliability([], NOW)).toEqual({
      attended: 0,
      noShows: 0,
      lateCancels: 0,
      total: 0,
      score: null,
      isNew: true,
      windowFromMs: null
    });
  });

  it("excludes excused, early cancels, system cancels, releases, and open signups", () => {
    const excluded = [
      at(1, "excused"),
      at(2, "cancelled", false), // early volunteer cancel, waitlist cancel, cutoff, org-cancelled, or release
      at(3, "confirmed"),
      at(4, "waitlisted"),
      at(5, "checked-in")
    ];
    const result = computeReliability([...excluded, at(6, "completed"), at(7, "completed"), at(8, "completed")], NOW);
    expect(result).toMatchObject({ attended: 3, noShows: 0, lateCancels: 0, total: 3, score: 1, isNew: false });
  });

  it("keeps only the newest 20 finished signups", () => {
    const old = Array.from({ length: 5 }, (_, index) => at(100 + index, "no-show"));
    const recent = Array.from({ length: 20 }, (_, index) => at(1 + index, "completed"));
    const result = computeReliability([...old, ...recent], NOW);
    expect(result).toMatchObject({ attended: 20, noShows: 0, total: 20, score: 1, windowFromMs: NOW - 20 * DAY_MS });
  });

  it("drops signups older than 12 months", () => {
    const result = computeReliability([at(400, "no-show"), at(366, "no-show"), at(10, "completed"), at(20, "completed"), at(30, "completed")], NOW);
    expect(result).toMatchObject({ noShows: 0, attended: 3, score: 1 });
  });

  it("orders input before capping, whatever order it arrives in", () => {
    const shuffled = [at(30, "completed"), at(1, "no-show"), at(15, "completed")];
    expect(computeReliability(shuffled, NOW).windowFromMs).toBe(NOW - 30 * DAY_MS);
  });
});

describe("isFinishedForReliability", () => {
  it("is true only for completed, no-show, and late cancels", () => {
    expect(isFinishedForReliability({ status: "completed", lateCancel: false })).toBe(true);
    expect(isFinishedForReliability({ status: "no-show", lateCancel: false })).toBe(true);
    expect(isFinishedForReliability({ status: "cancelled", lateCancel: true })).toBe(true);
    expect(isFinishedForReliability({ status: "cancelled", lateCancel: false })).toBe(false);
    expect(isFinishedForReliability({ status: "excused", lateCancel: false })).toBe(false);
  });
});

describe("display helpers", () => {
  it("summarizes neutrally (D12)", () => {
    expect(reliabilitySummary({ attended: 8, total: 10, isNew: false })).toBe("Attended 8 of 10 recent shifts");
    expect(reliabilitySummary({ attended: 1, total: 1, isNew: true })).toBe("New volunteer");
  });

  it("ranks new volunteers at 0.8 and others by score", () => {
    expect(rankingReliability({ score: null, isNew: true })).toBe(NEW_VOLUNTEER_RANKING_SCORE);
    expect(rankingReliability({ score: 0.5, isNew: false })).toBe(0.5);
    expect(rankingReliability({ score: null, isNew: false })).toBe(NEW_VOLUNTEER_RANKING_SCORE);
  });
});
