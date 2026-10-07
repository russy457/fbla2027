import { describe, expect, it } from "vitest";
import { CONFIG_ENV_VARS, DEFAULT_CONFIG, DEFAULT_TIME_ZONE, MILESTONES, resolveConfig } from "./config";

describe("resolveConfig (SPEC#config)", () => {
  it("returns the SPEC defaults when no overrides are set", () => {
    const config = resolveConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(config.checkinRateMax).toBe(10);
    expect(config.checkinRateWindowSec).toBe(600);
    expect(config.waitlistCutoffMin).toBe(120);
    expect(config.jobLeaseSec).toBe(240);
  });

  it("names each override after its key in UPPER_SNAKE_CASE", () => {
    expect(CONFIG_ENV_VARS.aiPerHour).toBe("AI_PER_HOUR");
    expect(CONFIG_ENV_VARS.checkinRateWindowSec).toBe("CHECKIN_RATE_WINDOW_SEC");
    expect(CONFIG_ENV_VARS.jobPageSize).toBe("JOB_PAGE_SIZE");
    expect(Object.keys(CONFIG_ENV_VARS).sort()).toEqual(Object.keys(DEFAULT_CONFIG).sort());
  });

  it("applies an environment override", () => {
    const config = resolveConfig({ CHECKIN_RATE_MAX: " 5 " });
    expect(config.checkinRateMax).toBe(5);
    expect(config.aiPerDay).toBe(DEFAULT_CONFIG.aiPerDay);
  });

  it.each(["", "0", "-3", "2.5", "ten"])("rejects the malformed override %j", (raw) => {
    expect(() => resolveConfig({ SERIES_WINDOW_WEEKS: raw })).toThrow(/SERIES_WINDOW_WEEKS/);
  });

  it("returns a frozen object and exposes milestones and the default zone", () => {
    expect(Object.isFrozen(resolveConfig())).toBe(true);
    expect([...MILESTONES]).toEqual([25, 50, 100]);
    expect(DEFAULT_TIME_ZONE).toBe("America/Chicago");
  });
});
