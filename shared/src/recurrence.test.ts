/**
 * recurrence.test.ts
 * Series date math (SPEC 3.7, 7.3, 7.5): rule validation, weekly, biweekly,
 * and monthly dates, bounds, the 8-week window, and table tests that cross
 * the March and November clock changes in America/Denver (a non-Chicago org).
 */
import { fromZonedTime } from "date-fns-tz";
import { describe, expect, it } from "vitest";
import {
  SERIES_EXTEND_LEAD_MS,
  addDaysYmd,
  describeSeriesRule,
  formatClock,
  isRuleDate,
  lastMaterializedDate,
  occurrenceTimes,
  ruleDatesBetween,
  seriesInstanceIdFor,
  seriesRuleProblem,
  seriesWindow,
  weekdayOfYmd
} from "./recurrence";
import { seriesRuleSchema, seriesSignupIdFor, type SeriesRule } from "./schemas/seriesDocs";

const HOUR = 3_600_000;
const DENVER = "America/Denver";
const CHICAGO = "America/Chicago";

const rule = (overrides: Partial<SeriesRule> = {}): SeriesRule => ({ frequency: "weekly", weekdays: [6], startTime: "09:00", endTime: "13:00", ...overrides });

describe("calendar helpers", () => {
  it.each([
    ["2026-10-17", 1, "2026-10-18"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2027-03-01", -1, "2027-02-28"]
  ])("addDaysYmd(%s, %i) = %s", (ymd, days, expected) => {
    expect(addDaysYmd(ymd, days)).toBe(expected);
  });

  it("reads weekdays without any zone (0 = Sunday)", () => {
    expect(weekdayOfYmd("2026-10-17")).toBe(6);
    expect(weekdayOfYmd("2026-10-18")).toBe(0);
  });

  it("formats clock times and builds deterministic ids", () => {
    expect(formatClock("00:15")).toBe("12:15 AM");
    expect(formatClock("09:00")).toBe("9:00 AM");
    expect(formatClock("12:30")).toBe("12:30 PM");
    expect(formatClock("13:05")).toBe("1:05 PM");
    expect(seriesInstanceIdFor("abc", "2026-10-17")).toBe("abc_20261017");
    expect(seriesSignupIdFor("abc", "uid1")).toBe("abc_uid1");
  });
});

describe("seriesRuleProblem", () => {
  it.each([
    ["a fine weekly rule", rule(), null],
    ["a repeated weekday", rule({ weekdays: [6, 6] }), "Pick each weekday once."],
    ["end before start", rule({ startTime: "13:00", endTime: "09:00" }), "The end time must be after the start time on the same day."],
    ["end equal to start", rule({ endTime: "09:00" }), "The end time must be after the start time on the same day."],
    ["over 12 hours", rule({ startTime: "06:00", endTime: "18:15" }), "Shifts can be at most 12 hours long."],
    ["exactly 12 hours", rule({ startTime: "06:00", endTime: "18:00" }), null],
    ["monthly without a week", rule({ frequency: "monthly" }), "Monthly series need a week of the month; others do not."],
    ["weekly with a week", rule({ monthWeek: 2 }), "Monthly series need a week of the month; others do not."],
    ["monthly with a week", rule({ frequency: "monthly", monthWeek: -1 }), null]
  ])("%s", (_name, candidate, expected) => {
    expect(seriesRuleProblem(candidate, "2026-10-01", null)).toBe(expected);
  });

  it("refuses an end date before the start date", () => {
    expect(seriesRuleProblem(rule(), "2026-10-10", "2026-10-09")).toBe("The last date must be on or after the first date.");
    expect(seriesRuleProblem(rule(), "2026-10-10", "2026-10-10")).toBeNull();
  });

  it("parses a SPEC-shaped rule without a frequency as weekly", () => {
    expect(seriesRuleSchema.parse({ weekdays: [1], startTime: "09:00", endTime: "10:00" }).frequency).toBe("weekly");
    expect(seriesRuleSchema.safeParse({ weekdays: [7], startTime: "09:00", endTime: "10:00" }).success).toBe(false);
    expect(seriesRuleSchema.safeParse({ weekdays: [1], startTime: "9:00", endTime: "10:00" }).success).toBe(false);
  });
});

describe("rule dates", () => {
  it("weekly: every listed weekday inside the bounds", () => {
    const dates = ruleDatesBetween({ rule: rule({ weekdays: [1, 3] }), startsOn: "2026-10-07", endsOn: "2026-10-21" }, "2026-10-01", "2026-12-31");
    expect(dates).toEqual(["2026-10-07", "2026-10-12", "2026-10-14", "2026-10-19", "2026-10-21"]);
  });

  it("weekly: the from/through window wins when it is narrower than the bounds", () => {
    const dates = ruleDatesBetween({ rule: rule(), startsOn: "2026-01-01", endsOn: null }, "2026-10-10", "2026-10-24");
    expect(dates).toEqual(["2026-10-10", "2026-10-17", "2026-10-24"]);
  });

  it("biweekly: every other week counted from the week of startsOn", () => {
    // startsOn is a Wednesday; its Sunday-start week holds Saturday Oct 10.
    const series = { rule: rule({ frequency: "biweekly" }), startsOn: "2026-10-07", endsOn: null };
    expect(ruleDatesBetween(series, "2026-10-01", "2026-11-30")).toEqual(["2026-10-10", "2026-10-24", "2026-11-07", "2026-11-21"]);
    expect(isRuleDate(series.rule, series.startsOn, "2026-10-17")).toBe(false);
  });

  it.each([
    [1, ["2026-10-03", "2026-11-07", "2026-12-05"]],
    [2, ["2026-10-10", "2026-11-14", "2026-12-12"]],
    [4, ["2026-10-24", "2026-11-28", "2026-12-26"]],
    [-1, ["2026-10-31", "2026-11-28", "2026-12-26"]]
  ] as const)("monthly week %i of each month on Saturdays", (monthWeek, expected) => {
    const series = { rule: rule({ frequency: "monthly", monthWeek }), startsOn: "2026-10-01", endsOn: null };
    expect(ruleDatesBetween(series, "2026-10-01", "2026-12-31")).toEqual(expected);
  });

  it("monthly without a week falls back to the 1st (the op refuses such rules before saving)", () => {
    expect(isRuleDate(rule({ frequency: "monthly" }), "2026-10-01", "2026-10-03")).toBe(true);
    expect(isRuleDate(rule({ frequency: "monthly" }), "2026-10-01", "2026-10-10")).toBe(false);
  });

  it("returns nothing when the window ends before it starts", () => {
    expect(ruleDatesBetween({ rule: rule(), startsOn: "2026-10-01", endsOn: "2026-10-05" }, "2026-10-10", "2026-10-31")).toEqual([]);
  });
});

describe("occurrenceTimes across daylight saving (America/Denver)", () => {
  it.each([
    ["Saturday before spring forward", "2027-03-13", "09:00", "13:00", "2027-03-13T16:00:00.000Z", 4],
    ["Saturday after spring forward", "2027-03-20", "09:00", "13:00", "2027-03-20T15:00:00.000Z", 4],
    ["spring-forward Sunday 1:00 to 4:00", "2027-03-14", "01:00", "04:00", "2027-03-14T08:00:00.000Z", 2],
    ["skipped 2:30 AM reads as daylight time", "2027-03-14", "02:30", "05:00", "2027-03-14T08:30:00.000Z", 2.5],
    ["Saturday before fall back", "2027-11-06", "09:00", "13:00", "2027-11-06T15:00:00.000Z", 4],
    ["Saturday after fall back", "2027-11-13", "09:00", "13:00", "2027-11-13T16:00:00.000Z", 4],
    ["fall-back Sunday 1:00 to 3:00", "2027-11-07", "01:00", "03:00", "2027-11-07T07:00:00.000Z", 3]
  ])("%s", (_name, ymd, startTime, endTime, startIso, hours) => {
    const times = occurrenceTimes(ymd, { startTime, endTime }, DENVER);
    expect(new Date(times.startMs).toISOString()).toBe(startIso);
    expect((times.endMs - times.startMs) / HOUR).toBe(hours);
  });

  it("keeps 9:00 local for every Saturday of a series that crosses both changes", () => {
    const dates = ruleDatesBetween({ rule: rule(), startsOn: "2027-03-01", endsOn: "2027-11-30" }, "2027-03-01", "2027-11-30");
    const localStarts = new Set(
      dates.map((ymd) => new Intl.DateTimeFormat("en-US", { timeZone: DENVER, hour: "numeric", minute: "2-digit" }).format(occurrenceTimes(ymd, rule(), DENVER).startMs))
    );
    expect(localStarts).toEqual(new Set(["9:00 AM"]));
  });
});

describe("seriesWindow", () => {
  const nowMs = fromZonedTime("2026-10-17T08:00:00", CHICAGO).getTime();

  it("covers today through today + 8 weeks and asks to extend 7 days before the end", () => {
    const window = seriesWindow({ startsOn: "2026-10-01", endsOn: null, timeZone: CHICAGO, nowMs, windowWeeks: 8 });
    expect(window.fromYmd).toBe("2026-10-17");
    expect(window.throughYmd).toBe("2026-12-12");
    expect(window.materializedThroughMs).toBe(fromZonedTime("2026-12-13T00:00:00", CHICAGO).getTime());
    expect(window.nextExtendAtMs).toBe(window.materializedThroughMs - SERIES_EXTEND_LEAD_MS);
    expect(lastMaterializedDate(window.materializedThroughMs, CHICAGO)).toBe("2026-12-12");
  });

  it("starts at startsOn when it is later than today", () => {
    expect(seriesWindow({ startsOn: "2026-11-01", endsOn: null, timeZone: CHICAGO, nowMs, windowWeeks: 8 }).fromYmd).toBe("2026-11-01");
  });

  it("stops at endsOn inside the window and needs no further extension", () => {
    const window = seriesWindow({ startsOn: "2026-10-01", endsOn: "2026-11-14", timeZone: CHICAGO, nowMs, windowWeeks: 8 });
    expect(window.throughYmd).toBe("2026-11-14");
    expect(window.nextExtendAtMs).toBeNull();
  });

  it("keeps extending when endsOn is beyond the window", () => {
    const window = seriesWindow({ startsOn: "2026-10-01", endsOn: "2027-06-01", timeZone: CHICAGO, nowMs, windowWeeks: 8 });
    expect(window.throughYmd).toBe("2026-12-12");
    expect(window.nextExtendAtMs).not.toBeNull();
  });

  it("uses the org zone for today: 11 PM Friday in Denver is still Friday", () => {
    const lateFriday = fromZonedTime("2026-10-16T23:00:00", DENVER).getTime();
    expect(seriesWindow({ startsOn: "2026-10-01", endsOn: null, timeZone: DENVER, nowMs: lateFriday, windowWeeks: 1 }).fromYmd).toBe("2026-10-16");
  });
});

describe("describeSeriesRule", () => {
  it.each([
    [rule(), "Every Saturday, 9:00 AM to 1:00 PM"],
    [rule({ weekdays: [0, 1] }), "Every Monday and Sunday, 9:00 AM to 1:00 PM"],
    [rule({ weekdays: [5, 1, 3], startTime: "17:30", endTime: "19:00" }), "Every Monday, Wednesday, and Friday, 5:30 PM to 7:00 PM"],
    [rule({ frequency: "biweekly" }), "Every other Saturday, 9:00 AM to 1:00 PM"],
    [rule({ frequency: "monthly", monthWeek: 2 }), "The 2nd Saturday of each month, 9:00 AM to 1:00 PM"],
    [rule({ frequency: "monthly", monthWeek: -1 }), "The last Saturday of each month, 9:00 AM to 1:00 PM"],
    [rule({ frequency: "monthly" }), "The 1st Saturday of each month, 9:00 AM to 1:00 PM"]
  ])("%#", (candidate, expected) => {
    expect(describeSeriesRule(candidate)).toBe(expected);
  });
});
