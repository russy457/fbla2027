/**
 * time.ts
 * Time zone and calendar helpers (SPEC#formulas 7.5). Instants are stored as
 * UTC; every calendar-day rule (age on a date, letter ranges, display) is
 * evaluated in an IANA zone through date-fns-tz, so a shift at 9:00 AM in
 * San Antonio stays 9:00 AM across daylight saving changes.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** `YYYY-MM-DD` calendar date (no time, no zone). */
export const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when the string is a real calendar date, so "2027-02-30" is rejected. */
export const isValidYmd = (value: string): boolean => {
  const match = YMD_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
};

/** The calendar date of an instant as seen in a zone, as `YYYY-MM-DD`. */
export const localDateIn = (at: Date, timeZone: string): string => formatInTimeZone(at, timeZone, "yyyy-MM-dd");

/** The instant a calendar day starts in a zone (local midnight). */
export const startOfLocalDay = (ymd: string, timeZone: string): Date => fromZonedTime(`${ymd}T00:00:00`, timeZone);

/**
 * The instant the day after `ymd` starts in a zone. Letter ranges use
 * [startOfLocalDay(from), startOfNextLocalDay(to)) so `to` is inclusive.
 */
export const startOfNextLocalDay = (ymd: string, timeZone: string): Date => {
  const [year, month, day] = ymd.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return startOfLocalDay(next.toISOString().slice(0, 10), timeZone);
};

/**
 * Whole years between a birth date and the calendar date of `at` in `timeZone`
 * (SPEC#minors G11: age is computed at each decision, never cached).
 * String comparison of MM-DD handles leap-day birthdays: a Feb 29 birthday
 * turns a year older on Mar 1 in non-leap years.
 */
export const ageOn = (birthDate: string, at: Date, timeZone: string): number => {
  const today = localDateIn(at, timeZone);
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) >= birthDate.slice(5) ? years : years - 1;
};

/** Shift time with a zone label, for example "Sat, Oct 17, 9:00 AM CDT" (SPEC#screens 9.19). */
export const formatShiftTime = (at: Date, timeZone: string): string =>
  formatInTimeZone(at, timeZone, "EEE, MMM d, h:mm a zzz");

/** Clock time only with a zone label, for "Check-in opens 9:30 AM CDT". */
export const formatClockTime = (at: Date, timeZone: string): string => formatInTimeZone(at, timeZone, "h:mm a zzz");

/** Long date for letters, for example "Oct 17, 2026". */
export const formatLongDate = (at: Date, timeZone: string): string => formatInTimeZone(at, timeZone, "MMM d, yyyy");

/** Formats a `YYYY-MM-DD` value as "Oct 17, 2026" without any zone shift. */
export const formatYmd = (ymd: string): string => formatInTimeZone(new Date(`${ymd}T12:00:00Z`), "UTC", "MMM d, yyyy");
