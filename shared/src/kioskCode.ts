/**
 * kioskCode.ts
 * Window math for the rotating 6-digit kiosk code (SPEC#kiosk, G21). The code
 * itself is an HMAC computed only on the server (functions/src/kiosk); this
 * module holds the parts the kiosk screen also needs: which 30-second window
 * we are in, when it ends, and how many seconds remain for the countdown ring.
 */

/** Codes are exactly six digits, zero-padded ("004219"). */
export const KIOSK_CODE_PATTERN = /^\d{6}$/;

export interface KioskWindow {
  /** floor(nowMs / rotationMs): the counter fed to the HMAC. */
  readonly index: number;
  /** When this window ends and the next code appears, epoch ms. */
  readonly endsAtMs: number;
  /** 30 - (floor(nowMs / 1000) mod 30), so it counts 30, 29, ... 1 (SPEC 5.10). */
  readonly secondsRemaining: number;
}

export const kioskWindowAt = (nowMs: number, rotationSec: number): KioskWindow => {
  const rotationMs = rotationSec * 1000;
  const index = Math.floor(nowMs / rotationMs);
  return {
    index,
    endsAtMs: (index + 1) * rotationMs,
    secondsRemaining: rotationSec - (Math.floor(nowMs / 1000) % rotationSec)
  };
};

/**
 * Windows whose codes are accepted at `nowMs`: the current one and the one
 * before it, so a volunteer who reads the code just before it rotates still
 * gets in (SPEC#fn-checkin: "w or w - 1").
 */
export const acceptedKioskWindows = (nowMs: number, rotationSec: number): readonly [number, number] => {
  const { index } = kioskWindowAt(nowMs, rotationSec);
  return [index, index - 1];
};

export const isKioskCodeFormat = (value: string): boolean => KIOSK_CODE_PATTERN.test(value);
