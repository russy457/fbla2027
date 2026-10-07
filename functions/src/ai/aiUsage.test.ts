/**
 * aiUsage.test.ts
 * The pure limit decision (SPEC 8.4): 20 per hour window, 100 per UTC day,
 * and the global daily cap; windows and days reset. The transaction wrapper
 * is exercised by functions/test/askAssistant.test.ts on the emulator.
 */
import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, HOUR_MS } from "@fbla/shared";
import { decideUsage } from "./aiUsage";

const NOW = Date.UTC(2026, 9, 6, 15, 0, 0);
const config = { aiPerHour: 2, aiPerDay: 3, aiGlobalDailyCap: 5 };
const user = (hourCount: number, dayCount: number, windowStartMs = NOW - 10 * 60_000, day = "2026-10-06") => ({
  hourWindowStart: Timestamp.fromMillis(windowStartMs),
  hourCount,
  day,
  dayCount
});

describe("decideUsage", () => {
  it("counts the first call of a new user and the global counter", () => {
    const decision = decideUsage(null, null, config, NOW);
    expect(decision.verdict).toBe("ok");
    expect(decision.user).toMatchObject({ hourCount: 1, dayCount: 1, day: "2026-10-06" });
    expect(decision.global).toEqual({ day: "2026-10-06", count: 1 });
  });

  it("stops at the hourly limit, then allows again after the window", () => {
    expect(decideUsage(user(2, 2), null, config, NOW).verdict).toBe("user-limit");
    expect(decideUsage(user(2, 2, NOW - HOUR_MS), null, config, NOW)).toMatchObject({ verdict: "ok", user: { hourCount: 1, dayCount: 3 } });
  });

  it("stops at the daily limit and resets on the next UTC day", () => {
    expect(decideUsage(user(0, 3, NOW - 2 * HOUR_MS), null, config, NOW).verdict).toBe("user-limit");
    expect(decideUsage(user(0, 3, NOW - 2 * HOUR_MS, "2026-10-05"), null, config, NOW).verdict).toBe("ok");
  });

  it("turns AI off for everyone at the global cap until the next UTC day", () => {
    expect(decideUsage(null, { day: "2026-10-06", count: 5 }, config, NOW).verdict).toBe("global-cap");
    expect(decideUsage(null, { day: "2026-10-05", count: 500 }, config, NOW).verdict).toBe("ok");
  });

  it("uses SPEC defaults of 20 per hour and 100 per day", () => {
    expect(DEFAULT_CONFIG.aiPerHour).toBe(20);
    expect(DEFAULT_CONFIG.aiPerDay).toBe(100);
  });
});
