/**
 * orgAnalytics.ts
 * The coordinator dashboard analytics strip (SPEC 9.2 "Coordinator
 * Dashboard", Tier 1): attendance rate = completed / (completed + no-show)
 * over the org's finished signups, and approved hours dated in the current
 * calendar month of the org's time zone. Pure; the same attendance formula as
 * the org participation report (SPEC 8.6).
 */
import { minutesToHours, startOfLocalDay, type HoursStatus, type SignupStatus } from "@fbla/shared";
import { formatInTimeZone } from "date-fns-tz";

export interface AnalyticsSignup {
  readonly status: SignupStatus;
}

export interface AnalyticsLog {
  readonly status: HoursStatus;
  readonly minutes: number;
  readonly date: { toMillis(): number };
}

export interface OrgAnalytics {
  /** 0..1, or null before anyone finished a shift. */
  readonly attendanceRate: number | null;
  readonly completed: number;
  readonly noShows: number;
  readonly hoursThisMonth: number;
}

/** The instant the current month starts in the org zone (local midnight on the 1st). */
export const startOfMonthMs = (nowMs: number, timeZone: string): number =>
  startOfLocalDay(`${formatInTimeZone(new Date(nowMs), timeZone, "yyyy-MM")}-01`, timeZone).getTime();

export const computeOrgAnalytics = (
  signups: readonly AnalyticsSignup[],
  logs: readonly AnalyticsLog[],
  nowMs: number,
  timeZone: string
): OrgAnalytics => {
  const completed = signups.filter((signup) => signup.status === "completed").length;
  const noShows = signups.filter((signup) => signup.status === "no-show").length;
  const monthStart = startOfMonthMs(nowMs, timeZone);
  const minutes = logs
    .filter((log) => log.status === "approved" && log.date.toMillis() >= monthStart && log.date.toMillis() <= nowMs)
    .reduce((sum, log) => sum + log.minutes, 0);
  return {
    attendanceRate: completed + noShows === 0 ? null : completed / (completed + noShows),
    completed,
    noShows,
    hoursThisMonth: minutesToHours(minutes)
  };
};

/** "88%" or "No finished shifts yet". */
export const formatRate = (rate: number | null): string => (rate === null ? "No finished shifts yet" : `${Math.round(rate * 100)}%`);
