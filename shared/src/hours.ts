/**
 * hours.ts
 * The credited-hours formula (SPEC#hours, G12) and the totals built on it.
 *
 *   rawMinutes = (min(checkOut, scheduledEnd) - max(checkIn, scheduledStart)) / 60000
 *   minutes    = max(0, floor(rawMinutes / 15 + 0.5) * 15)   // nearest 15, ties round up
 *
 * Clamping to the scheduled window means a verified letter never credits time
 * outside the shift; coordinators adjust real exceptions with setAttendance.
 * All inputs are instants in epoch milliseconds, so daylight saving changes
 * are handled by the caller building correct instants, not by this math.
 */
import { MILESTONES } from "./config";
import { MINUTE_MS } from "./time";

/** Credited time is always a multiple of this many minutes. */
export const HOURS_STEP_MIN = 15;

export interface ShiftTimes {
  /** Scheduled start, epoch ms. */
  readonly startMs: number;
  /** Scheduled end, epoch ms. */
  readonly endMs: number;
}

export interface AttendanceTimes extends ShiftTimes {
  readonly checkInMs: number;
  /** Actual check-out; finalize passes the scheduled end, a mid-shift cancel passes the cancel time. */
  readonly checkOutMs: number;
}

/** Rounds minutes to the nearest step; exact halves round up (22.5 -> 30). */
export const roundToStep = (minutes: number, step: number = HOURS_STEP_MIN): number =>
  Math.max(0, Math.floor(minutes / step + 0.5) * step);

/** Minutes credited for one attendance, clamped to the scheduled window (SPEC#hours). */
export const creditedMinutes = (times: AttendanceTimes): number => {
  const from = Math.max(times.checkInMs, times.startMs);
  const to = Math.min(times.checkOutMs, times.endMs);
  return roundToStep((to - from) / MINUTE_MS);
};

/** Rounds to two decimals (used for hour totals shown to people). */
export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** totalApprovedHours = round2(sum(approved minutes) / 60). */
export const minutesToHours = (minutes: number): number => round2(minutes / 60);

/** Sums a list of approved minutes into hours with two decimals. */
export const totalApprovedHours = (approvedMinutes: readonly number[]): number =>
  minutesToHours(approvedMinutes.reduce((sum, minutes) => sum + minutes, 0));

export type Badge = `hours-${(typeof MILESTONES)[number]}`;

/** Milestone badges earned at a total (SPEC#dm-users: subset of hours-25, hours-50, hours-100). */
export const badgesFor = (hours: number): Badge[] =>
  MILESTONES.filter((milestone) => hours >= milestone).map((milestone) => `hours-${milestone}` as Badge);

/** The next milestone above a total, or null once every milestone is reached. */
export const nextMilestone = (hours: number): number | null => MILESTONES.find((milestone) => hours < milestone) ?? null;
