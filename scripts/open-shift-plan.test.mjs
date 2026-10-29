import { describe, expect, it } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { planOpenShifts } from "./open-shift-plan.mjs";

const ZONE = "America/Chicago";

describe("presentation shift plan", () => {
  it("creates stable, distinct future dates with enough signup lead time", () => {
    const now = Date.parse("2026-10-29T16:00:00Z");
    const first = planOpenShifts(now);
    const second = planOpenShifts(now);
    expect(first).toEqual(second);
    expect(first).toHaveLength(19);
    expect(new Set(first.map((shift) => shift.id)).size).toBe(first.length);
    expect(first.every((shift) => shift.startMs >= now + 36 * 60 * 60 * 1000 && shift.endMs > shift.startMs)).toBe(true);
  });

  it("keeps named activities on their local weekday through the daylight saving change", () => {
    const plan = planOpenShifts(Date.parse("2027-03-12T16:00:00Z"));
    const markets = plan.filter((shift) => shift.opportunityId === "pantry-family-market");
    expect(markets).toHaveLength(3);
    for (const shift of markets) {
      expect(formatInTimeZone(new Date(shift.startMs), ZONE, "EEEE HH:mm")).toBe("Saturday 09:00");
    }
    expect(plan.find((shift) => shift.opportunityId === "pantry-weekend-snack-bags")?.startMs).toBeGreaterThan(Date.parse("2027-03-12T16:00:00Z"));
  });
});
