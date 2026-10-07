/**
 * instanceTimes.ts
 * Shift time rules for createInstance and updateInstance (SPEC 3.8,
 * INSTANCE_TIME_INVALID): end after start, at most 12 hours long, starting
 * in the future. Also derives the job times every instance carries
 * (cutoffAt = start - 2 h, finalizeAt = end + 30 min, nextActionAt).
 */
import { Timestamp } from "firebase-admin/firestore";
import { AppError, HOUR_MS, MAX_SHIFT_HOURS, cutoffAtMs, finalizeAtMs, type AppConfig } from "@fbla/shared";
import { ts } from "../lib/firestore";

export interface ShiftTimesMs {
  readonly startMs: number;
  readonly endMs: number;
}

/** Throws INSTANCE_TIME_INVALID unless the times make a valid future shift. */
export const assertShiftTimes = ({ startMs, endMs }: ShiftTimesMs, nowMs: number): void => {
  const valid = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs && endMs - startMs <= MAX_SHIFT_HOURS * HOUR_MS && startMs > nowMs;
  if (!valid) throw new AppError("INSTANCE_TIME_INVALID");
};

export interface JobTimes {
  readonly start: Timestamp;
  readonly end: Timestamp;
  readonly cutoffAt: Timestamp;
  readonly finalizeAt: Timestamp;
}

export const jobTimesFor = ({ startMs, endMs }: ShiftTimesMs, config: AppConfig): JobTimes => ({
  start: ts(startMs),
  end: ts(endMs),
  cutoffAt: ts(cutoffAtMs(startMs, config)),
  finalizeAt: ts(finalizeAtMs(endMs, config))
});
