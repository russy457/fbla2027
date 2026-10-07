/**
 * match.test.ts
 * The recommendation match score (SPEC 8.4): each signal alone, all signals,
 * nothing in common, zone-aware weekday and time block, and geohash distance.
 */
import { fromZonedTime } from "date-fns-tz";
import { describe, expect, it } from "vitest";
import { MATCH_WEIGHTS, matchShift, sharedGeohashPrefix, timeBlockOf, weekdayKeyOf, type MatchProfile, type MatchShift } from "./match";
import type { Availability } from "./schemas/userDocs";

const none = { morning: false, afternoon: false, evening: false };
const availability = (overrides: Partial<Availability> = {}): Availability => ({
  mon: none,
  tue: none,
  wed: none,
  thu: none,
  fri: none,
  sat: none,
  sun: none,
  ...overrides
});

// Saturday, Oct 17, 2026, 9:00 AM in the demo time zone.
const SAT_9AM = fromZonedTime("2026-10-17T09:00:00", "America/Chicago").getTime();

const shift: MatchShift = {
  causeArea: "hunger-food-security",
  skills: ["Lifting", "Spanish"],
  startMs: SAT_9AM,
  timeZone: "America/Chicago",
  geohash: "9v1zv",
  isVirtual: false
};

const empty: MatchProfile = { interests: [], skills: [], availability: null, homeGeohash: null };

describe("matchShift", () => {
  it("scores 0 with no reasons when nothing matches", () => {
    expect(matchShift(empty, shift)).toEqual({ score: 0, reasons: [] });
  });

  it("adds every signal with its reason, strongest first", () => {
    const result = matchShift(
      { interests: ["hunger-food-security"], skills: [" spanish ", "lifting"], availability: availability({ sat: { ...none, morning: true } }), homeGeohash: "9v1zv" },
      shift
    );
    expect(result.score).toBe(1);
    expect(result.reasons).toEqual([
      { kind: "interest", causeArea: "hunger-food-security" },
      { kind: "skills", skills: ["Lifting", "Spanish"] },
      { kind: "availability", weekday: "sat", block: "morning" },
      { kind: "nearby" }
    ]);
  });

  it("gives partial credit for some skills and a farther location", () => {
    const result = matchShift({ ...empty, skills: ["Spanish"], homeGeohash: "9v1zq" }, shift);
    expect(result.score).toBe(Math.round((MATCH_WEIGHTS.skills * 0.5 + MATCH_WEIGHTS.nearby * 0.6) * 1000) / 1000);
    expect(matchShift({ ...empty, homeGeohash: "9v1aa" }, shift).score).toBe(Math.round(MATCH_WEIGHTS.nearby * 0.3 * 1000) / 1000);
    expect(matchShift({ ...empty, homeGeohash: "dr5re" }, shift).score).toBe(0);
  });

  it("treats virtual shifts as close to everyone and unknown places as unknown", () => {
    expect(matchShift(empty, { ...shift, isVirtual: true }).reasons).toEqual([{ kind: "virtual" }]);
    expect(matchShift({ ...empty, homeGeohash: "9v1zv" }, { ...shift, geohash: null }).score).toBe(0);
  });

  it("ignores availability on other days or blocks", () => {
    expect(matchShift({ ...empty, availability: availability({ sat: { ...none, evening: true } }) }, shift).score).toBe(0);
  });
});

describe("zone-aware calendar helpers", () => {
  it("reads weekday and block in the shift's zone", () => {
    expect(weekdayKeyOf(SAT_9AM, "America/Chicago")).toBe("sat");
    expect(weekdayKeyOf(fromZonedTime("2026-10-19T09:00:00", "America/Chicago").getTime(), "America/Chicago")).toBe("mon");
    expect(weekdayKeyOf(fromZonedTime("2026-10-18T23:30:00", "America/Chicago").getTime(), "America/Chicago")).toBe("sun");
    expect(timeBlockOf(SAT_9AM, "America/Chicago")).toBe("morning");
    expect(timeBlockOf(fromZonedTime("2026-10-17T12:00:00", "America/Chicago").getTime(), "America/Chicago")).toBe("afternoon");
    expect(timeBlockOf(fromZonedTime("2026-10-17T17:00:00", "America/Chicago").getTime(), "America/Chicago")).toBe("evening");
  });

  it("counts a shared geohash prefix", () => {
    expect(sharedGeohashPrefix("9v1zv", "9v1zq")).toBe(4);
    expect(sharedGeohashPrefix("9v1", "9v1zv")).toBe(3);
    expect(sharedGeohashPrefix("", "9v")).toBe(0);
  });
});
