import { describe, expect, it } from "vitest";
import { acceptedKioskWindows, isKioskCodeFormat, kioskWindowAt } from "./kioskCode";
import { DEFAULT_CONFIG } from "./config";
import {
  canReleasePromotion,
  checkInWindow,
  checkOutWindow,
  cutoffAtMs,
  finalizeAtMs,
  isLateCancel,
  isLatePromotion,
  isWithin,
  kioskCodeWindow,
  kioskStartWindow
} from "./shiftWindows";

const MIN = 60_000;
const HOUR = 60 * MIN;
const START = Date.UTC(2026, 9, 17, 14, 0, 0);
const END = START + 4 * HOUR;

describe("shift windows (SPEC 7.3)", () => {
  it("computes cutoff and finalize instants", () => {
    expect(cutoffAtMs(START, DEFAULT_CONFIG)).toBe(START - 2 * HOUR);
    expect(finalizeAtMs(END, DEFAULT_CONFIG)).toBe(END + 30 * MIN);
  });

  it("opens check-in 30 minutes early and closes it at the end", () => {
    const window = checkInWindow(START, END, DEFAULT_CONFIG);
    expect(window).toEqual({ fromMs: START - 30 * MIN, toMs: END });
    expect(isWithin(START - 30 * MIN, window)).toBe(true);
    expect(isWithin(START - 30 * MIN - 1, window)).toBe(false);
    expect(isWithin(END + 1, window)).toBe(false);
  });

  it("opens check-out 15 minutes after check-in until 30 minutes after the end", () => {
    expect(checkOutWindow(START, END, DEFAULT_CONFIG)).toEqual({ fromMs: START + 15 * MIN, toMs: END + 30 * MIN });
  });

  it("shows kiosk codes from start - 30 to end + 30, and allows starting the kiosk from start - 60", () => {
    expect(kioskCodeWindow(START, END, DEFAULT_CONFIG)).toEqual({ fromMs: START - 30 * MIN, toMs: END + 30 * MIN });
    expect(kioskStartWindow(START, END, DEFAULT_CONFIG)).toEqual({ fromMs: START - 60 * MIN, toMs: END + 30 * MIN });
  });

  it("flags late cancels and late promotions inside 24 hours", () => {
    expect(isLateCancel(START - 23 * HOUR, START, DEFAULT_CONFIG)).toBe(true);
    expect(isLateCancel(START - 24 * HOUR, START, DEFAULT_CONFIG)).toBe(false);
    expect(isLatePromotion(START - 2 * HOUR, START, DEFAULT_CONFIG)).toBe(true);
    expect(isLatePromotion(START - 48 * HOUR, START, DEFAULT_CONFIG)).toBe(false);
  });

  it("allows a release within 24 h of promotion or after a late promotion", () => {
    const promoted = START - 72 * HOUR;
    expect(canReleasePromotion(promoted + 24 * HOUR, promoted, START, DEFAULT_CONFIG)).toBe(true);
    expect(canReleasePromotion(promoted + 25 * HOUR, promoted, START, DEFAULT_CONFIG)).toBe(false);
    const latePromoted = START - 3 * HOUR;
    expect(canReleasePromotion(START - MIN, latePromoted, START, DEFAULT_CONFIG)).toBe(true);
  });
});

describe("kiosk code windows (SPEC 5.10)", () => {
  it("indexes 30 second windows and counts down 30..1", () => {
    const t = 1_700_000_010_000 + 10_000; // 10 s into a window
    const window = kioskWindowAt(t, 30);
    expect(window.index).toBe(Math.floor(t / 30_000));
    expect(window.endsAtMs).toBe((window.index + 1) * 30_000);
    expect(window.secondsRemaining).toBe(20);
    expect(kioskWindowAt(window.index * 30_000, 30).secondsRemaining).toBe(30);
  });

  it("accepts the current and previous window only", () => {
    const t = 1_700_000_010_000 + 10_000;
    const index = Math.floor(t / 30_000);
    expect(acceptedKioskWindows(t, 30)).toEqual([index, index - 1]);
  });

  it("checks the six-digit format", () => {
    expect(isKioskCodeFormat("004219")).toBe(true);
    expect(isKioskCodeFormat("4219")).toBe(false);
    expect(isKioskCodeFormat("12345a")).toBe(false);
  });
});
