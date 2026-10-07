import { describe, expect, it } from "vitest";
import { fromZonedTime } from "date-fns-tz";
import { badgesFor, creditedMinutes, minutesToHours, nextMilestone, round2, roundToStep, totalApprovedHours } from "./hours";

const CHICAGO = "America/Chicago";
const DENVER = "America/Denver";
const at = (local: string, zone = CHICAGO) => fromZonedTime(local, zone).getTime();
const DAY = "2026-10-17";
const shift = { startMs: at(`${DAY}T09:00:00`), endMs: at(`${DAY}T13:00:00`) };

describe("creditedMinutes (SPEC#hours table, shift 9:00-13:00)", () => {
  it.each([
    ["08:45:00", "13:10:00", 240],
    ["09:07:00", "12:52:00", 225],
    ["09:08:00", "12:52:00", 225], // 224 raw
    ["09:00:00", "09:20:00", 15],
    ["09:00:00", "09:22:30", 30], // 22.5 raw, tie rounds up
    ["08:31:00", "08:50:00", 0], // entirely before start
    ["09:10:00", "13:00:00", 225], // finalize uses checkOut = scheduled end (230 raw)
    ["09:00:00", "11:00:00", 120] // mid-shift cancel at 11:00
  ])("in %s out %s -> %i", (checkIn, checkOut, expected) => {
    expect(creditedMinutes({ ...shift, checkInMs: at(`${DAY}T${checkIn}`), checkOutMs: at(`${DAY}T${checkOut}`) })).toBe(expected);
  });

  it("spring-forward night in America/Denver: 1:00 to 4:00 local is 120 minutes", () => {
    const startMs = at("2027-03-14T01:00:00", DENVER);
    const endMs = at("2027-03-14T04:00:00", DENVER);
    expect(creditedMinutes({ startMs, endMs, checkInMs: startMs, checkOutMs: endMs })).toBe(120);
  });

  it("fall-back night in America/Denver: 1:00 to 3:00 local is 180 minutes", () => {
    // 1:00 local on 2027-11-07 is the first (MDT) 1:00; 3:00 is MST, so three real hours pass.
    const startMs = Date.parse("2027-11-07T07:00:00Z");
    const endMs = at("2027-11-07T03:00:00", DENVER);
    expect(creditedMinutes({ startMs, endMs, checkInMs: startMs, checkOutMs: endMs })).toBe(180);
  });
});

describe("rounding and totals", () => {
  it("rounds to the nearest step and never below zero", () => {
    expect(roundToStep(7.4)).toBe(0);
    expect(roundToStep(7.5)).toBe(15);
    expect(roundToStep(-40)).toBe(0);
    expect(roundToStep(10, 5)).toBe(10);
  });

  it("totals approved minutes into hours with two decimals", () => {
    expect(round2(1.234)).toBe(1.23);
    expect(minutesToHours(735)).toBe(12.25);
    expect(totalApprovedHours([735, 360])).toBe(18.25);
    expect(totalApprovedHours([])).toBe(0);
  });
});

describe("milestones (SPEC 7.3)", () => {
  it("awards badges at 25, 50, and 100 hours", () => {
    expect(badgesFor(24.75)).toEqual([]);
    expect(badgesFor(25)).toEqual(["hours-25"]);
    expect(badgesFor(100)).toEqual(["hours-25", "hours-50", "hours-100"]);
  });

  it("names the next milestone or null after the last", () => {
    expect(nextMilestone(0)).toBe(25);
    expect(nextMilestone(25)).toBe(50);
    expect(nextMilestone(100)).toBeNull();
  });
});
