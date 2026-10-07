/**
 * shiftForm.ts
 * Turns what a coordinator types for a shift (a calendar date and HH:mm
 * start and end, read in the ORGANIZATION's time zone, SPEC#formulas 7.5,
 * D24) into the ISO instants createInstance/updateInstance take, and checks
 * the same rules the server enforces with INSTANCE_TIME_INVALID: end after
 * start, at most 12 hours, starts in the future. An end time earlier than
 * the start means the shift runs past midnight (for example 22:00-02:00).
 * Also the reverse: an instance's instants back into form values.
 */
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { MAX_SHIFT_HOURS, isValidYmd } from "@fbla/shared";

export interface ShiftTimesInput {
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
}

export type ShiftTimesResult =
  | { readonly ok: true; readonly start: string; readonly end: string; readonly durationMin: number }
  | { readonly ok: false; readonly field: keyof ShiftTimesInput; readonly message: string };

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

const fail = (field: keyof ShiftTimesInput, message: string): ShiftTimesResult => ({ ok: false, field, message });

export const toShiftInstants = (input: ShiftTimesInput, timeZone: string, nowMs: number): ShiftTimesResult => {
  if (!isValidYmd(input.date)) return fail("date", "Pick a date.");
  if (!TIME_PATTERN.test(input.startTime)) return fail("startTime", "Enter a start time like 09:00.");
  if (!TIME_PATTERN.test(input.endTime)) return fail("endTime", "Enter an end time like 13:00.");
  if (input.startTime === input.endTime) return fail("endTime", "The shift must end after it starts.");
  const startMs = fromZonedTime(`${input.date}T${input.startTime}:00`, timeZone).getTime();
  const crossesMidnight = input.endTime < input.startTime;
  const endDay = crossesMidnight ? new Date(Date.parse(`${input.date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10) : input.date;
  const endMs = fromZonedTime(`${endDay}T${input.endTime}:00`, timeZone).getTime();
  const durationMin = Math.round((endMs - startMs) / 60_000);
  if (durationMin <= 0) return fail("endTime", "The shift must end after it starts.");
  if (durationMin > MAX_SHIFT_HOURS * 60) return fail("endTime", `Shifts can be at most ${MAX_SHIFT_HOURS} hours long.`);
  if (startMs <= nowMs) return fail("date", "Pick a start time in the future.");
  return { ok: true, start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString(), durationMin };
};

/** Form values for an existing shift, in the org zone. */
export const fromShiftInstants = (startMs: number, endMs: number, timeZone: string): ShiftTimesInput => ({
  date: formatInTimeZone(new Date(startMs), timeZone, "yyyy-MM-dd"),
  startTime: formatInTimeZone(new Date(startMs), timeZone, "HH:mm"),
  endTime: formatInTimeZone(new Date(endMs), timeZone, "HH:mm")
});

/** The zone label shown next to time fields, for example "CDT". */
export const zoneLabel = (timeZone: string, atMs: number): string => formatInTimeZone(new Date(atMs), timeZone, "zzz");
