/**
 * plannerPrefill.test.ts
 * Planner draft to new-shift form values (SPEC#screen-planner 9.14): only
 * recognized fields are filled and listed, an end time is derived from a
 * duration, warnings and weekly recurrence become hints, and the summary
 * names what was filled or explains that nothing was found.
 */
import { describe, expect, it } from "vitest";
import { parsePlannerText, type PlannerDraft } from "@fbla/shared";
import { prefillFromDraft, prefillSummary } from "./plannerPrefill";

const EMPTY: PlannerDraft = {
  title: null, volunteersNeeded: null, date: null, weekday: null, recurrence: null, startTime: null, endTime: null,
  durationMinutes: null, location: null, causeArea: null, matched: [], warnings: []
};

describe("prefillFromDraft", () => {
  it("fills the SPEC example sentence and flags the assumed time", () => {
    const prefill = prefillFromDraft(parsePlannerText("need 12 people Sat 9-1 sorting at the food bank", { referenceDate: "2026-10-14" }));
    expect(prefill).toMatchObject({ title: "Sorting", capacity: 12, date: "2026-10-17", startTime: "09:00", endTime: "13:00", location: "the food bank", causeArea: "hunger-food-security" });
    expect([...prefill.filled].sort()).toEqual(["capacity", "causeArea", "date", "endTime", "location", "startTime", "title"]);
    expect(prefill.hints).toEqual(["No AM or PM was given, so we guessed. Check the times."]);
    expect(prefillSummary(prefill)).toBe("We filled in title, cause area, place, date, start time, end time, and volunteers needed. Check each highlighted field, then save.");
  });

  it("derives the end from a duration and notes weekly repeats", () => {
    const prefill = prefillFromDraft({ ...EMPTY, startTime: "22:30", durationMinutes: 120, recurrence: "weekly" });
    expect(prefill.endTime).toBe("00:30");
    expect(prefill.hints[0]).toMatch(/This repeats every week/);
    expect(prefill.repeatsWeekly).toBe(true);
    expect(prefillSummary(prefill)).toBe("We filled in start time and end time. Check each highlighted field, then save.");
  });

  it("fills nothing it did not recognize", () => {
    const prefill = prefillFromDraft({ ...EMPTY, title: "Garden day" });
    expect(prefill).toEqual({ title: "Garden day", filled: new Set(["title"]), hints: [] });
    expect(prefillSummary(prefill)).toBe("We filled in title. Check each highlighted field, then save.");
    expect(prefillSummary(prefillFromDraft(EMPTY))).toMatch(/^We couldn't find shift details in that/);
  });
});
