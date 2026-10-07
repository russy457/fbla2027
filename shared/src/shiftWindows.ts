/**
 * shiftWindows.ts
 * When each shift action is allowed (SPEC#formulas 7.3, SPEC 5.4, 5.10). One
 * module so the phone ("Check-in opens 9:30"), the kiosk ("Shift not open"),
 * and the Functions that enforce the rule compute the same instants.
 * Every value is epoch milliseconds.
 */
import type { AppConfig } from "./config";
import { HOUR_MS, MINUTE_MS } from "./time";

/** The thresholds this module reads; a full AppConfig satisfies it. */
export type WindowConfig = Pick<
  AppConfig,
  | "waitlistCutoffMin"
  | "checkinOpenBeforeMin"
  | "checkoutMinAfterCheckinMin"
  | "checkoutGraceMin"
  | "kioskStartBeforeMin"
  | "lateCancelHours"
  | "latePromotionHours"
  | "releaseWindowHours"
>;

export interface Range {
  readonly fromMs: number;
  readonly toMs: number;
}

export const isWithin = (nowMs: number, range: Range): boolean => nowMs >= range.fromMs && nowMs <= range.toMs;

/** cutoffAt = start - 2 h: the waitlist closes and later signups are walk-ups. */
export const cutoffAtMs = (startMs: number, config: WindowConfig): number => startMs - config.waitlistCutoffMin * MINUTE_MS;

/** finalizeAt = end + 30 min: runDueJobs finalizes the shift after this. */
export const finalizeAtMs = (endMs: number, config: WindowConfig): number => endMs + config.checkoutGraceMin * MINUTE_MS;

/** Check-in: start - 30 min to end (inclusive). */
export const checkInWindow = (startMs: number, endMs: number, config: WindowConfig): Range => ({
  fromMs: startMs - config.checkinOpenBeforeMin * MINUTE_MS,
  toMs: endMs
});

/** Check-out: checkInAt + 15 min to end + 30 min (inclusive). */
export const checkOutWindow = (checkInMs: number, endMs: number, config: WindowConfig): Range => ({
  fromMs: checkInMs + config.checkoutMinAfterCheckinMin * MINUTE_MS,
  toMs: endMs + config.checkoutGraceMin * MINUTE_MS
});

/** The kiosk shows codes from start - 30 min to end + 30 min. */
export const kioskCodeWindow = (startMs: number, endMs: number, config: WindowConfig): Range => ({
  fromMs: startMs - config.checkinOpenBeforeMin * MINUTE_MS,
  toMs: endMs + config.checkoutGraceMin * MINUTE_MS
});

/** A coordinator may start the kiosk from start - 60 min until finalizeAt. */
export const kioskStartWindow = (startMs: number, endMs: number, config: WindowConfig): Range => ({
  fromMs: startMs - config.kioskStartBeforeMin * MINUTE_MS,
  toMs: finalizeAtMs(endMs, config)
});

/** A volunteer cancel of a confirmed signup within 24 h of start is a late cancel. */
export const isLateCancel = (nowMs: number, startMs: number, config: WindowConfig): boolean =>
  startMs - nowMs < config.lateCancelHours * HOUR_MS;

/** A promotion within 24 h of start excuses a later no-show (SPEC 5.5). */
export const isLatePromotion = (promotedAtMs: number, startMs: number, config: WindowConfig): boolean =>
  startMs - promotedAtMs < config.latePromotionHours * HOUR_MS;

/** A promoted volunteer may release the seat within 24 h of promotion, or any time after a late promotion (SPEC 5.3). */
export const canReleasePromotion = (nowMs: number, promotedAtMs: number, startMs: number, config: WindowConfig): boolean =>
  nowMs - promotedAtMs <= config.releaseWindowHours * HOUR_MS || isLatePromotion(promotedAtMs, startMs, config);
