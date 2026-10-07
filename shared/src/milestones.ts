/**
 * milestones.ts
 * E4 milestones and streaks (SPEC 7.3 MILESTONES, SPEC#dm-users badges and
 * streakWeeks, SPEC 7.5 streak rule).
 *
 *   newMilestones(hours, seen)  milestones reached but not yet celebrated on
 *                               this account (private profile milestonesSeen),
 *                               so the "milestone moment" shows once.
 *   streakWeeks(logs, now, tz)  consecutive ISO weeks (Monday start) with at
 *                               least one approved log, counted back from the
 *                               current week; each log's week is read in its
 *                               organization's zone. The current week does not
 *                               break the streak until it ends.
 */
import { formatInTimeZone } from "date-fns-tz";
import { MILESTONES } from "./config";
import { DAY_MS, localDateIn } from "./time";

export type Milestone = (typeof MILESTONES)[number];

/** Milestones at or below `hours` that are missing from `seen`, lowest first. */
export const newMilestones = (hours: number, seen: readonly number[]): Milestone[] =>
  MILESTONES.filter((milestone) => hours >= milestone && !seen.includes(milestone));

/** "2026-W42" for a calendar date (ISO week-numbering year and week). */
export const isoWeekKey = (ymd: string): string => formatInTimeZone(new Date(`${ymd}T12:00:00Z`), "UTC", "RRRR-'W'II");

export interface StreakLog {
  /** The log's date (shift start or service date), epoch ms. */
  readonly dateMs: number;
  /** The zone of the log's organization. */
  readonly timeZone: string;
}

const WEEK_MS = 7 * DAY_MS;

export const streakWeeks = (logs: readonly StreakLog[], nowMs: number, timeZone: string): number => {
  const weeks = new Set(logs.map((log) => isoWeekKey(localDateIn(new Date(log.dateMs), log.timeZone))));
  // Step back a week at a time from noon UTC of today's local date, so DST never skips a week.
  let cursorMs = Date.parse(`${localDateIn(new Date(nowMs), timeZone)}T12:00:00Z`);
  const keyAt = (ms: number): string => formatInTimeZone(new Date(ms), "UTC", "RRRR-'W'II");
  if (!weeks.has(keyAt(cursorMs))) cursorMs -= WEEK_MS;
  let count = 0;
  while (weeks.has(keyAt(cursorMs))) {
    count += 1;
    cursorMs -= WEEK_MS;
  }
  return count;
};
