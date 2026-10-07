import { describe, expect, it } from "vitest";
import { fromZonedTime } from "date-fns-tz";
import {
  ageOn,
  formatClockTime,
  formatLongDate,
  formatShiftTime,
  formatYmd,
  isValidYmd,
  localDateIn,
  startOfLocalDay,
  startOfNextLocalDay
} from "./time";

const CHICAGO = "America/Chicago";

describe("isValidYmd", () => {
  it.each([
    ["2026-10-06", true],
    ["2024-02-29", true],
    ["2027-02-29", false],
    ["2026-13-01", false],
    ["2026-1-01", false],
    ["not a date", false]
  ])("%s -> %s", (value, expected) => {
    expect(isValidYmd(value)).toBe(expected);
  });
});

describe("zoned calendar days (SPEC 7.5)", () => {
  it("reads the local date of an instant in the org zone", () => {
    // 2026-10-07T03:00Z is still Oct 6 in Chicago (UTC-5 in October).
    expect(localDateIn(new Date("2026-10-07T03:00:00Z"), CHICAGO)).toBe("2026-10-06");
    expect(localDateIn(new Date("2026-10-07T03:00:00Z"), "UTC")).toBe("2026-10-07");
  });

  it("finds local midnight and the next local midnight across a DST change", () => {
    expect(startOfLocalDay("2026-10-06", CHICAGO).toISOString()).toBe("2026-10-06T05:00:00.000Z");
    // Nov 1 2026 is the fall-back day in Chicago, so that day lasts 25 hours.
    const start = startOfLocalDay("2026-11-01", CHICAGO);
    const next = startOfNextLocalDay("2026-11-01", CHICAGO);
    expect((next.getTime() - start.getTime()) / 3_600_000).toBe(25);
    expect(startOfNextLocalDay("2026-12-31", CHICAGO).toISOString()).toBe("2027-01-01T06:00:00.000Z");
  });
});

describe("ageOn (SPEC#minors G11)", () => {
  const at = (iso: string) => new Date(iso);

  it("counts whole years on the zone's calendar date", () => {
    expect(ageOn("2013-10-06", at("2026-10-06T15:00:00Z"), CHICAGO)).toBe(13);
    expect(ageOn("2013-10-07", at("2026-10-06T15:00:00Z"), CHICAGO)).toBe(12);
    // Late evening Oct 6 in Chicago is already Oct 7 in UTC; Chicago still says 12.
    expect(ageOn("2013-10-07", at("2026-10-07T03:00:00Z"), CHICAGO)).toBe(12);
    expect(ageOn("2013-10-07", at("2026-10-07T03:00:00Z"), "UTC")).toBe(13);
  });

  it("treats a leap-day birthday as Mar 1 in non-leap years", () => {
    expect(ageOn("2008-02-29", at("2026-02-28T18:00:00Z"), CHICAGO)).toBe(17);
    expect(ageOn("2008-02-29", at("2026-03-01T18:00:00Z"), CHICAGO)).toBe(18);
  });
});

describe("display formats (SPEC 9.19)", () => {
  const nineAm = fromZonedTime("2026-10-17T09:00:00", CHICAGO);

  it("labels shift times with the zone", () => {
    expect(formatShiftTime(nineAm, CHICAGO)).toBe("Sat, Oct 17, 9:00 AM CDT");
    expect(formatClockTime(nineAm, CHICAGO)).toBe("9:00 AM CDT");
    expect(formatLongDate(nineAm, CHICAGO)).toBe("Oct 17, 2026");
  });

  it("formats a plain calendar date without shifting it", () => {
    expect(formatYmd("2026-08-01")).toBe("Aug 1, 2026");
  });
});
