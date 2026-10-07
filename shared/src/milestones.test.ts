/**
 * milestones.test.ts
 * E4: milestone moments at 25/50/100 hours and the weekly streak rule
 * (SPEC 7.5), including a week boundary across the March DST change.
 */
import { fromZonedTime } from "date-fns-tz";
import { describe, expect, it } from "vitest";
import { isoWeekKey, newMilestones, streakWeeks } from "./milestones";

const CHI = "America/Chicago";
const at = (iso: string, zone = CHI): number => fromZonedTime(iso, zone).getTime();

describe("newMilestones", () => {
  it("returns reached milestones not yet seen", () => {
    expect(newMilestones(24.75, [])).toEqual([]);
    expect(newMilestones(25, [])).toEqual([25]);
    expect(newMilestones(60, [25])).toEqual([50]);
    expect(newMilestones(120, [25, 50, 100])).toEqual([]);
    expect(newMilestones(120, [])).toEqual([25, 50, 100]);
  });
});

describe("isoWeekKey", () => {
  it("uses ISO weeks that start on Monday", () => {
    expect(isoWeekKey("2026-10-18")).toBe("2026-W42"); // Sunday
    expect(isoWeekKey("2026-10-19")).toBe("2026-W43"); // Monday
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
  });
});

describe("streakWeeks", () => {
  const now = at("2026-10-21T10:00:00"); // Wednesday of 2026-W43

  it("is 0 without logs", () => {
    expect(streakWeeks([], now, CHI)).toBe(0);
  });

  it("counts consecutive weeks including the current one", () => {
    const logs = [at("2026-10-20T09:00:00"), at("2026-10-17T09:00:00"), at("2026-10-10T09:00:00")].map((dateMs) => ({ dateMs, timeZone: CHI }));
    expect(streakWeeks(logs, now, CHI)).toBe(3);
  });

  it("does not break on a current week with no log yet", () => {
    const logs = [at("2026-10-17T09:00:00"), at("2026-10-10T09:00:00")].map((dateMs) => ({ dateMs, timeZone: CHI }));
    expect(streakWeeks(logs, now, CHI)).toBe(2);
  });

  it("stops at the first empty week", () => {
    const logs = [at("2026-10-20T09:00:00"), at("2026-10-03T09:00:00")].map((dateMs) => ({ dateMs, timeZone: CHI }));
    expect(streakWeeks(logs, now, CHI)).toBe(1);
  });

  it("reads each log's week in its own org zone", () => {
    // Sunday 11 PM in Denver is already Monday in UTC; the log still belongs to the earlier week.
    const denver = { dateMs: at("2026-10-18T23:00:00", "America/Denver"), timeZone: "America/Denver" };
    expect(streakWeeks([denver], now, CHI)).toBe(1);
  });

  it("steps across the spring DST change without skipping a week", () => {
    const monday = at("2027-03-15T00:30:00");
    const logs = [at("2027-03-15T00:10:00"), at("2027-03-08T09:00:00"), at("2027-03-01T09:00:00")].map((dateMs) => ({ dateMs, timeZone: CHI }));
    expect(streakWeeks(logs, monday, CHI)).toBe(3);
  });
});
