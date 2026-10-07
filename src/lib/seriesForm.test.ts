/**
 * seriesForm.test.ts
 * Series form conversion (the same SERIES_RULE_INVALID checks as the
 * server, with each message next to its field), round-trip from a saved
 * series, whole-series result chips, and ranking "why" text.
 */
import { describe, expect, it } from "vitest";
import { rankReasonText, seriesFormFromDoc, seriesOutcomeView, toSeriesInput, type SeriesFormValues } from "./seriesForm";

const values = (overrides: Partial<SeriesFormValues> = {}): SeriesFormValues => ({
  frequency: "weekly",
  weekdays: [6],
  monthWeek: 1,
  startTime: "09:00",
  endTime: "13:00",
  capacity: "10",
  startsOn: "2026-10-17",
  endsOn: "",
  ...overrides
});

describe("toSeriesInput", () => {
  it("builds the upsertSeries input with sorted weekdays and no end date", () => {
    expect(toSeriesInput(values({ weekdays: [6, 1] }))).toEqual({
      ok: true,
      input: { rule: { frequency: "weekly", weekdays: [1, 6], startTime: "09:00", endTime: "13:00" }, capacity: 10, startsOn: "2026-10-17", endsOn: null }
    });
  });

  it("keeps the month week only for monthly series", () => {
    const result = toSeriesInput(values({ frequency: "monthly", monthWeek: -1, endsOn: "2027-03-01" }));
    expect(result).toMatchObject({ ok: true, input: { rule: { frequency: "monthly", monthWeek: -1 }, endsOn: "2027-03-01" } });
  });

  it.each([
    [{ weekdays: [] }, "weekdays", "Pick at least one day."],
    [{ startTime: "9" }, "startTime", "Enter a start time like 09:00."],
    [{ endTime: "" }, "endTime", "Enter an end time like 13:00."],
    [{ capacity: "0" }, "capacity", "Enter a whole number from 1 to 200."],
    [{ capacity: "2.5" }, "capacity", "Enter a whole number from 1 to 200."],
    [{ startsOn: "" }, "startsOn", "Pick the first date."],
    [{ endsOn: "2026-13-01" }, "endsOn", "Pick a last date, or leave it empty."],
    [{ endTime: "08:00" }, "endTime", "The end time must be after the start time on the same day."],
    [{ endsOn: "2026-10-01" }, "endsOn", "The last date must be on or after the first date."],
    [{ weekdays: [6, 6] }, "weekdays", "Pick each weekday once."]
  ] as const)("refuses %j", (overrides, field, message) => {
    expect(toSeriesInput(values(overrides as Partial<SeriesFormValues>))).toEqual({ ok: false, field, message });
  });

  it("round-trips a saved series", () => {
    const saved = { rule: { frequency: "biweekly" as const, weekdays: [2], startTime: "17:00", endTime: "19:00" }, capacity: 4, startsOn: "2026-11-03", endsOn: null };
    expect(seriesFormFromDoc(saved)).toEqual(values({ frequency: "biweekly", weekdays: [2], startTime: "17:00", endTime: "19:00", capacity: "4", startsOn: "2026-11-03" }));
    expect(seriesFormFromDoc({ ...saved, rule: { ...saved.rule, frequency: "monthly", monthWeek: 3 }, endsOn: "2027-01-01" })).toMatchObject({ monthWeek: 3, endsOn: "2027-01-01" });
  });
});

describe("seriesOutcomeView", () => {
  it.each([
    [{ outcome: "confirmed" }, { tone: "success", label: "Signed up" }],
    [{ outcome: "waitlisted" }, { tone: "warning", label: "Waitlisted" }],
    [{ outcome: "skipped", reason: "SHIFT_FULL" }, { tone: "neutral", label: "Skipped: Full" }],
    [{ outcome: "skipped", reason: "AGE_BELOW_MIN" }, { tone: "neutral", label: "Skipped: Below the minimum age" }],
    [{ outcome: "skipped", reason: "SOMETHING_NEW" }, { tone: "neutral", label: "Skipped: Not available" }],
    [{ outcome: "skipped" }, { tone: "neutral", label: "Skipped: Not available" }]
  ] as const)("%j", (result, expected) => {
    expect(seriesOutcomeView(result)).toEqual(expected);
  });
});

describe("rankReasonText", () => {
  it.each([
    [{ kind: "interest", causeArea: "hunger-food-security" }, "Cares about hunger and food"],
    [{ kind: "skills", skills: ["Lifting", "Spanish"] }, "Skills: Lifting, Spanish"],
    [{ kind: "availability", weekday: "sat", block: "morning" }, "Free Saturday mornings"],
    [{ kind: "nearby" }, "Lives nearby"],
    [{ kind: "virtual" }, "Virtual shift"],
    [{ kind: "past-volunteer" }, "Volunteered with you"]
  ] as const)("%j", (reason, text) => {
    expect(rankReasonText(reason)).toBe(text);
  });
});
