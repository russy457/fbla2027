/**
 * orgAnalytics.test.ts
 * Dashboard analytics (SPEC 9.2): attendance rate and hours this month in
 * the org zone, including the month boundary in Chicago.
 */
import { describe, expect, it } from "vitest";
import { ts } from "@/test/fixtures";
import { computeOrgAnalytics, formatRate, startOfMonthMs } from "./orgAnalytics";

const TZ = "America/Chicago";
const NOW = Date.UTC(2026, 9, 17, 15); // Oct 17 2026, 10:00 CDT
const OCT_1 = Date.UTC(2026, 9, 1, 5); // local midnight Oct 1 (CDT = UTC-5)

describe("computeOrgAnalytics", () => {
  it("starts the month at local midnight", () => {
    expect(startOfMonthMs(NOW, TZ)).toBe(OCT_1);
  });

  it("computes attendance and this month's approved hours", () => {
    const result = computeOrgAnalytics(
      [{ status: "completed" }, { status: "completed" }, { status: "completed" }, { status: "no-show" }, { status: "excused" }],
      [
        { status: "approved", minutes: 90, date: ts(OCT_1) },
        { status: "approved", minutes: 60, date: ts(OCT_1 - 1) },
        { status: "pending", minutes: 60, date: ts(NOW - 1000) },
        { status: "approved", minutes: 30, date: ts(NOW - 1000) }
      ],
      NOW,
      TZ
    );
    expect(result).toEqual({ attendanceRate: 0.75, completed: 3, noShows: 1, hoursThisMonth: 2 });
    expect(formatRate(result.attendanceRate)).toBe("75%");
  });

  it("has no rate before anyone finished", () => {
    expect(computeOrgAnalytics([{ status: "confirmed" }], [], NOW, TZ).attendanceRate).toBeNull();
    expect(formatRate(null)).toBe("No finished shifts yet");
  });
});
