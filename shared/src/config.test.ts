import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, LIMIT_ENV_VARS, resolveLimits } from "./config";

describe("resolveLimits", () => {
  it("returns the plan's defaults when no overrides are set", () => {
    expect(resolveLimits()).toEqual({
      aiCallsPerHour: 20,
      aiCallsPerDay: 100,
      aiInputMaxChars: 2000,
      aiOutputMaxTokens: 1024,
      checkInAttemptsPerWindow: 10,
      checkInWindowMinutes: 10,
      kioskCodeRotationSeconds: 30,
      seriesWindowWeeks: 8
    });
  });

  it("applies an environment override", () => {
    const limits = resolveLimits({ LIMIT_AI_CALLS_PER_HOUR: " 5 " });
    expect(limits.aiCallsPerHour).toBe(5);
    expect(limits.aiCallsPerDay).toBe(DEFAULT_LIMITS.aiCallsPerDay);
  });

  it("has an env var for every limit", () => {
    expect(Object.keys(LIMIT_ENV_VARS).sort()).toEqual(Object.keys(DEFAULT_LIMITS).sort());
  });

  it.each(["", "0", "-3", "2.5", "ten"])("rejects the malformed override %j", (raw) => {
    expect(() => resolveLimits({ LIMIT_SERIES_WINDOW_WEEKS: raw })).toThrow(/LIMIT_SERIES_WINDOW_WEEKS/);
  });

  it("returns a frozen object", () => {
    expect(Object.isFrozen(resolveLimits())).toBe(true);
  });
});
