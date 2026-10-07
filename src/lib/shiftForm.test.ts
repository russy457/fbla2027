/**
 * shiftForm.test.ts
 * Shift time entry in the org zone (SPEC 7.5): local to UTC instants,
 * past-midnight shifts, a non-Chicago zone across DST, and each refusal.
 */
import { describe, expect, it } from "vitest";
import { fromShiftInstants, toShiftInstants, zoneLabel } from "./shiftForm";

const NOW = Date.UTC(2026, 9, 1);

describe("toShiftInstants", () => {
  it("reads times in the org zone", () => {
    expect(toShiftInstants({ date: "2026-10-17", startTime: "09:00", endTime: "13:00" }, "America/Chicago", NOW)).toEqual({
      ok: true,
      start: "2026-10-17T14:00:00.000Z",
      end: "2026-10-17T18:00:00.000Z",
      durationMin: 240
    });
  });

  it("runs past midnight when the end is earlier than the start", () => {
    const result = toShiftInstants({ date: "2026-10-17", startTime: "22:00", endTime: "02:00" }, "America/Chicago", NOW);
    expect(result).toMatchObject({ ok: true, end: "2026-10-18T07:00:00.000Z", durationMin: 240 });
  });

  it("handles DST in a non-Chicago zone", () => {
    const result = toShiftInstants({ date: "2027-03-14", startTime: "01:00", endTime: "04:00" }, "America/Denver", NOW);
    expect(result).toMatchObject({ ok: true, durationMin: 120 });
  });

  it.each([
    [{ date: "2026-02-30", startTime: "09:00", endTime: "10:00" }, "date"],
    [{ date: "2026-10-17", startTime: "9", endTime: "10:00" }, "startTime"],
    [{ date: "2026-10-17", startTime: "09:00", endTime: "x" }, "endTime"],
    [{ date: "2026-10-17", startTime: "09:00", endTime: "09:00" }, "endTime"],
    [{ date: "2026-10-17", startTime: "06:00", endTime: "19:00" }, "endTime"],
    [{ date: "2026-09-01", startTime: "09:00", endTime: "10:00" }, "date"]
  ])("refuses %o", (input, field) => {
    expect(toShiftInstants(input, "America/Chicago", NOW)).toMatchObject({ ok: false, field });
  });
});

describe("fromShiftInstants", () => {
  it("round-trips to form values with a zone label", () => {
    const start = Date.UTC(2026, 9, 17, 14);
    expect(fromShiftInstants(start, start + 4 * 3_600_000, "America/Chicago")).toEqual({ date: "2026-10-17", startTime: "09:00", endTime: "13:00" });
    expect(zoneLabel("America/Chicago", start)).toBe("CDT");
  });
});
