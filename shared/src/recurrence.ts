/**
 * recurrence.ts
 * Pure date math for recurring series (Tier 2, SPEC 3.7, 7.3 "Series window",
 * 7.5 time zones). Used by upsertSeries/extendSeries to materialize shifts, by
 * signupSeries to find a series' dates, and by the UI to describe a rule.
 *
 * Every rule date is a calendar date (`YYYY-MM-DD`) in the org's zone, and a
 * shift's instants come from that date plus the rule's local clock times
 * through date-fns-tz. So "Saturdays 9:00 to 13:00" in America/Denver is
 * 9:00 local before and after the March and November clock changes; only the
 * UTC instant moves.
 *
 *   weekly     every listed weekday
 *   biweekly   every listed weekday in every other week, counted from the
 *              Sunday-start week that contains startsOn
 *   monthly    the Nth (1st to 4th) or last occurrence of each listed weekday
 *
 * Window (SPEC 7.3): shifts exist from today through today + 8 weeks; the
 * series is extended again when within 7 days of materializedThrough.
 */
import { fromZonedTime } from "date-fns-tz";
import type { MonthWeek, SeriesRule } from "./schemas/seriesDocs";
import { DAY_MS, MINUTE_MS, localDateIn, startOfNextLocalDay } from "./time";

/** Longest shift a rule may describe, in local minutes (SPEC 3.8: 12 h). */
const MAX_RULE_MINUTES = 12 * 60;
/** Extend a series this long before its materialized window runs out (SPEC 7.3). */
export const SERIES_EXTEND_LEAD_MS = 7 * DAY_MS;
const DAYS_PER_WEEK = 7;

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const ymdToUtcMs = (ymd: string): number => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
const utcMsToYmd = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Calendar arithmetic on `YYYY-MM-DD` (no zone involved). */
export const addDaysYmd = (ymd: string, days: number): string => utcMsToYmd(ymdToUtcMs(ymd) + days * DAY_MS);

/** 0 = Sunday ... 6 = Saturday, the weekday of a calendar date. */
export const weekdayOfYmd = (ymd: string): number => new Date(ymdToUtcMs(ymd)).getUTCDay();

/** Minutes after midnight for "HH:mm". */
const minutesOf = (clock: string): number => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

/**
 * Why a rule cannot be saved, in plain words, or null when it is fine.
 * The op answers SERIES_RULE_INVALID; the form shows the sentence.
 */
export const seriesRuleProblem = (rule: SeriesRule, startsOn: string, endsOn: string | null): string | null => {
  if (new Set(rule.weekdays).size !== rule.weekdays.length) return "Pick each weekday once.";
  const length = minutesOf(rule.endTime) - minutesOf(rule.startTime);
  if (length <= 0) return "The end time must be after the start time on the same day.";
  if (length > MAX_RULE_MINUTES) return "Shifts can be at most 12 hours long.";
  if ((rule.frequency === "monthly") !== (rule.monthWeek !== undefined)) return "Monthly series need a week of the month; others do not.";
  if (endsOn !== null && endsOn < startsOn) return "The last date must be on or after the first date.";
  return null;
};

/** Days in the month of a calendar date. */
const daysInMonth = (ymd: string): number => new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)), 0)).getUTCDate();

const isNthWeekdayOfMonth = (ymd: string, monthWeek: MonthWeek): boolean => {
  const day = Number(ymd.slice(8, 10));
  return monthWeek === -1 ? day + DAYS_PER_WEEK > daysInMonth(ymd) : Math.ceil(day / DAYS_PER_WEEK) === monthWeek;
};

/** Whole weeks between the Sunday-start weeks of two dates. */
const weeksBetween = (fromYmd: string, toYmd: string): number => {
  const fromSunday = ymdToUtcMs(fromYmd) - weekdayOfYmd(fromYmd) * DAY_MS;
  return Math.floor((ymdToUtcMs(toYmd) - fromSunday) / (DAYS_PER_WEEK * DAY_MS));
};

/** True when the rule produces a shift on `ymd` (bounds are checked by the caller). */
export const isRuleDate = (rule: SeriesRule, startsOn: string, ymd: string): boolean => {
  if (!rule.weekdays.includes(weekdayOfYmd(ymd))) return false;
  if (rule.frequency === "biweekly") return weeksBetween(startsOn, ymd) % 2 === 0;
  if (rule.frequency === "monthly") return isNthWeekdayOfMonth(ymd, rule.monthWeek ?? 1);
  return true;
};

export interface SeriesBounds {
  readonly rule: SeriesRule;
  readonly startsOn: string;
  readonly endsOn: string | null;
}

/** Every rule date from `fromYmd` through `throughYmd` (inclusive) inside the series bounds, oldest first. */
export const ruleDatesBetween = (series: SeriesBounds, fromYmd: string, throughYmd: string): string[] => {
  const first = fromYmd > series.startsOn ? fromYmd : series.startsOn;
  const last = series.endsOn !== null && series.endsOn < throughYmd ? series.endsOn : throughYmd;
  const dates: string[] = [];
  for (let day = first; day <= last; day = addDaysYmd(day, 1)) {
    if (isRuleDate(series.rule, series.startsOn, day)) dates.push(day);
  }
  return dates;
};

/**
 * The UTC instants of the shift on a rule date. date-fns-tz reads a local
 * time skipped by the spring-forward change (2:30 AM) with the daylight
 * offset, which is 1:30 AM standard time, and an ambiguous fall-back time
 * (1:30 AM) as its first, daylight occurrence. Rules that sit in those hours
 * are rare (overnight shifts are not allowed), and the table tests pin it.
 */
export const occurrenceTimes = (ymd: string, rule: Pick<SeriesRule, "startTime" | "endTime">, timeZone: string): { startMs: number; endMs: number } => ({
  startMs: fromZonedTime(`${ymd}T${rule.startTime}:00`, timeZone).getTime(),
  endMs: fromZonedTime(`${ymd}T${rule.endTime}:00`, timeZone).getTime()
});

/** Deterministic shift id for a series date (SPEC 5.2: `{seriesId}_{YYYYMMDD}`). */
export const seriesInstanceIdFor = (seriesId: string, ymd: string): string => `${seriesId}_${ymd.replaceAll("-", "")}`;

export interface SeriesWindowInput {
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly timeZone: string;
  readonly nowMs: number;
  readonly windowWeeks: number;
}

export interface SeriesWindow {
  /** First date to materialize: today in the org zone, or startsOn if later. */
  readonly fromYmd: string;
  /** Last date to materialize (inclusive): today + windowWeeks, or endsOn if sooner. */
  readonly throughYmd: string;
  /** Start of the day after throughYmd: stored as materializedThrough. */
  readonly materializedThroughMs: number;
  /** materializedThrough - 7 days, or null when every date through endsOn now exists. */
  readonly nextExtendAtMs: number | null;
}

export const seriesWindow = (input: SeriesWindowInput): SeriesWindow => {
  const today = localDateIn(new Date(input.nowMs), input.timeZone);
  const horizon = addDaysYmd(today, input.windowWeeks * DAYS_PER_WEEK);
  // endsOn inside the window means this pass creates the series' last dates.
  const endsInWindow = input.endsOn !== null && input.endsOn <= horizon ? input.endsOn : null;
  const throughYmd = endsInWindow ?? horizon;
  const materializedThroughMs = startOfNextLocalDay(throughYmd, input.timeZone).getTime();
  return {
    fromYmd: today > input.startsOn ? today : input.startsOn,
    throughYmd,
    materializedThroughMs,
    nextExtendAtMs: endsInWindow === null ? materializedThroughMs - SERIES_EXTEND_LEAD_MS : null
  };
};

/** The last calendar date (org zone) a materialized window covers. */
export const lastMaterializedDate = (materializedThroughMs: number, timeZone: string): string =>
  localDateIn(new Date(materializedThroughMs - MINUTE_MS), timeZone);

const ORDINALS: Readonly<Record<MonthWeek, string>> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", [-1]: "last" };

/** "9:00 AM" from "09:00". */
export const formatClock = (clock: string): string => {
  const minutes = minutesOf(clock);
  const hour = Math.floor(minutes / 60);
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour % 12 === 0 ? 12 : hour % 12}:${clock.slice(3, 5)} ${suffix}`;
};

/** "Monday", "Monday and Friday", "Monday, Wednesday, and Friday" (Monday-first order). */
const weekdayList = (weekdays: readonly number[]): string => {
  const names = [...weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((day) => WEEKDAY_NAMES[day] as string);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1] as string}`;
};

/** Plain-English rule, for example "Every other Saturday, 9:00 AM to 1:00 PM". */
export const describeSeriesRule = (rule: SeriesRule): string => {
  const days = weekdayList(rule.weekdays);
  const times = `${formatClock(rule.startTime)} to ${formatClock(rule.endTime)}`;
  if (rule.frequency === "biweekly") return `Every other ${days}, ${times}`;
  if (rule.frequency === "monthly") return `The ${ORDINALS[rule.monthWeek ?? 1]} ${days} of each month, ${times}`;
  return `Every ${days}, ${times}`;
};
