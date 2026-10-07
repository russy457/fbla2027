/**
 * clock.ts
 * The one clock for the whole system (plan G6, X12). Client code and Cloud
 * Functions call clock.now() instead of new Date() or serverTimestamp(), so
 * kiosk code windows, check-in/out windows, finalizeShift, and age checks all
 * agree on "now".
 *
 * Two hooks change what "now" means:
 *  - setOffsetMs(ms): demo mode only. Shifts time forward (or back) so a demo
 *    can jump 15 minutes ahead. Callers in Functions must allow a non-zero
 *    offset only when DEMO_MODE is on for a "demo-" project (G6).
 *  - withFixedNow(at, fn): tests only. Freezes time while fn runs, then restores.
 */

export interface Clock {
  /** Current time as a Date (includes any demo offset). */
  now(): Date;
  /** Current time in epoch milliseconds (includes any demo offset). */
  nowMs(): number;
}

let offsetMs = 0;
let fixedNowMs: number | null = null;

const currentMs = (): number => (fixedNowMs ?? Date.now()) + offsetMs;

export const clock: Clock = {
  now: () => new Date(currentMs()),
  nowMs: currentMs
};

/** Sets the demo clock offset. Throws on non-finite input so a bad env value cannot corrupt time. */
export const setOffsetMs = (ms: number): void => {
  if (!Number.isFinite(ms)) {
    throw new RangeError(`Clock offset must be a finite number of milliseconds, got ${String(ms)}`);
  }
  offsetMs = Math.trunc(ms);
};

/** Current demo clock offset in milliseconds (0 outside demo mode). */
export const getOffsetMs = (): number => offsetMs;

const toEpochMs = (at: Date | number): number => {
  const ms = at instanceof Date ? at.getTime() : at;
  if (!Number.isFinite(ms)) {
    throw new RangeError("withFixedNow needs a valid Date or epoch milliseconds");
  }
  return ms;
};

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function";

/**
 * Runs fn with the clock frozen at `at`, then restores the previous state.
 * Works for synchronous and async callbacks (restores after the promise settles).
 */
export function withFixedNow<T>(at: Date | number, fn: () => T): T {
  const previous = fixedNowMs;
  fixedNowMs = toEpochMs(at);
  const restore = (): void => {
    fixedNowMs = previous;
  };

  let result: T;
  try {
    result = fn();
  } catch (error) {
    restore();
    throw error;
  }

  if (isPromiseLike(result)) {
    return Promise.resolve(result).finally(restore) as T;
  }
  restore();
  return result;
}
