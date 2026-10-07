import { afterEach, describe, expect, it } from "vitest";
import { clock, createClock, getOffsetMs, setOffsetMs, withFixedNow } from "./clock";

const FIXED = Date.UTC(2026, 9, 6, 15, 0, 0); // 2026-10-06T15:00:00Z
const FIFTEEN_MINUTES = 15 * 60 * 1000;

afterEach(() => {
  setOffsetMs(0);
});

describe("clock", () => {
  it("tracks real time when nothing is overridden", () => {
    const before = Date.now();
    const now = clock.nowMs();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(clock.now()).toBeInstanceOf(Date);
  });

  it("freezes time inside withFixedNow and restores it afterwards", () => {
    const seen = withFixedNow(FIXED, () => clock.now().toISOString());
    expect(seen).toBe("2026-10-06T15:00:00.000Z");
    expect(Math.abs(clock.nowMs() - Date.now())).toBeLessThan(1000);
  });

  it("accepts a Date for withFixedNow", () => {
    expect(withFixedNow(new Date(FIXED), () => clock.nowMs())).toBe(FIXED);
  });

  it("applies the demo offset on top of a fixed time", () => {
    setOffsetMs(FIFTEEN_MINUTES);
    expect(getOffsetMs()).toBe(FIFTEEN_MINUTES);
    expect(withFixedNow(FIXED, () => clock.nowMs())).toBe(FIXED + FIFTEEN_MINUTES);
  });

  it("truncates fractional offsets and rejects non-finite ones", () => {
    setOffsetMs(1500.9);
    expect(getOffsetMs()).toBe(1500);
    expect(() => setOffsetMs(Number.NaN)).toThrow(RangeError);
    expect(() => setOffsetMs(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("rejects an invalid fixed time", () => {
    expect(() => withFixedNow(new Date("not a date"), () => 1)).toThrow(RangeError);
  });

  it("restores the clock when the callback throws", () => {
    expect(() =>
      withFixedNow(FIXED, () => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(Math.abs(clock.nowMs() - Date.now())).toBeLessThan(1000);
  });

  it("keeps time frozen until an async callback settles", async () => {
    const result = await withFixedNow(FIXED, async () => {
      await Promise.resolve();
      return clock.nowMs();
    });
    expect(result).toBe(FIXED);
    expect(Math.abs(clock.nowMs() - Date.now())).toBeLessThan(1000);
  });

  it("createClock uses the injected base time and offset", () => {
    let base = FIXED;
    const testClock = createClock({ baseNowMs: () => base, offsetMs: FIFTEEN_MINUTES + 0.7 });
    expect(testClock.nowMs()).toBe(FIXED + FIFTEEN_MINUTES);
    base += 1000;
    expect(testClock.now().getTime()).toBe(FIXED + FIFTEEN_MINUTES + 1000);
  });

  it("createClock defaults to wall time (or withFixedNow) and ignores the global offset", () => {
    expect(withFixedNow(FIXED, () => createClock().nowMs())).toBe(FIXED);
    expect(Math.abs(createClock().nowMs() - Date.now())).toBeLessThan(1000);
    setOffsetMs(FIFTEEN_MINUTES);
    expect(createClock({ baseNowMs: () => FIXED }).nowMs()).toBe(FIXED);
  });

  it("createClock rejects a non-finite offset", () => {
    expect(() => createClock({ offsetMs: Number.NaN })).toThrow(RangeError);
  });

  it("supports nesting by restoring the outer fixed time", () => {
    const inner = FIXED + 1000;
    const values = withFixedNow(FIXED, () => {
      const nested = withFixedNow(inner, () => clock.nowMs());
      return [nested, clock.nowMs()];
    });
    expect(values).toEqual([inner, FIXED]);
  });
});
