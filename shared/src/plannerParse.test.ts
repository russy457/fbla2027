/**
 * plannerParse.test.ts
 * Table tests for the deterministic shift-planner parser (SPEC#ai 8.4).
 * The reference date is Tuesday 2026-10-06, so "Sat" resolves to 2026-10-10.
 */
import { describe, expect, it } from "vitest";
import { PLANNER_FIELDS, parsePlannerText, plannerDraftSchema, type PlannerDraft } from "./plannerParse";

const REF = "2026-10-06"; // a Tuesday
const parse = (text: string, extra: Partial<{ maxInputChars: number; defaultDurationMinutes: number; referenceDate: string }> = {}): PlannerDraft =>
  parsePlannerText(text, { referenceDate: REF, ...extra });

describe("SPEC example sentences", () => {
  it("Food sort every Saturday 9-12 at Alamo pantry, 8 volunteers", () => {
    expect(parse("Food sort every Saturday 9-12 at Alamo pantry, 8 volunteers")).toEqual({
      title: "Food sort",
      volunteersNeeded: 8,
      date: "2026-10-10",
      weekday: 6,
      recurrence: "weekly",
      startTime: "09:00",
      endTime: "12:00",
      durationMinutes: 180,
      location: "Alamo pantry",
      causeArea: "hunger-food-security",
      matched: [...PLANNER_FIELDS],
      warnings: ["time-assumed"]
    });
  });

  it("need 12 people Sat 9-1 sorting at the food bank", () => {
    expect(parse("need 12 people Sat 9-1 sorting at the food bank")).toEqual({
      title: "Sorting",
      volunteersNeeded: 12,
      date: "2026-10-10",
      weekday: 6,
      recurrence: null,
      startTime: "09:00",
      endTime: "13:00",
      durationMinutes: 240,
      location: "the food bank",
      causeArea: "hunger-food-security",
      matched: PLANNER_FIELDS.filter((field) => field !== "recurrence"),
      warnings: ["time-assumed"]
    });
  });
});

describe("time ranges", () => {
  it.each([
    ["9am-1pm", "09:00", "13:00", 240, []],
    ["9:30-11:45", "09:30", "11:45", 135, ["time-assumed"]],
    ["2-5pm", "14:00", "17:00", 180, []],
    ["9-1pm", "09:00", "13:00", 240, []],
    ["8-5pm", "08:00", "17:00", 540, []],
    ["noon-3", "12:00", "15:00", 180, []],
    ["from 9 to 12", "09:00", "12:00", 180, ["time-assumed"]],
    ["10a-2p", "10:00", "14:00", 240, []],
    ["18:00-20:00", "18:00", "20:00", 120, []],
    ["08:00 to 10:00", "08:00", "10:00", 120, []],
    ["9 a.m. - 1 p.m.", "09:00", "13:00", 240, []],
    ["9am – 1pm", "09:00", "13:00", 240, []],
    ["2-5", "14:00", "17:00", 180, ["time-assumed"]],
    ["6-8", "18:00", "20:00", 120, ["time-assumed"]],
    ["12-3", "12:00", "15:00", 180, ["time-assumed"]],
    ["11-1", "11:00", "13:00", 120, ["time-assumed"]],
    ["7 until 9", "07:00", "09:00", 120, ["time-assumed"]],
    ["1 till 3", "13:00", "15:00", 120, ["time-assumed"]],
    ["9 thru 11", "09:00", "11:00", 120, ["time-assumed"]],
    ["9 through 11", "09:00", "11:00", 120, ["time-assumed"]],
    ["9-18:00", "09:00", "18:00", 540, []],
    ["11pm-2", "23:00", "02:00", 180, ["ends-next-day"]],
    ["10pm-2am", "22:00", "02:00", 240, ["ends-next-day"]],
    ["11-00:30", "23:00", "00:30", 90, ["ends-next-day"]]
  ] as const)("%s -> %s to %s", (text, startTime, endTime, durationMinutes, warnings) => {
    expect(parse(text)).toMatchObject({ startTime, endTime, durationMinutes, warnings });
  });

  it("drops the end when it equals the start", () => {
    expect(parse("9am-9am")).toMatchObject({ startTime: "09:00", endTime: null, durationMinutes: null, warnings: ["time-range-invalid"] });
  });

  it.each([
    ["13pm-2pm"],
    ["0am-2am"],
    ["25-26"],
    ["need 2-3 people"],
    ["bring 5 boxes"],
    ["at 13pm"],
    ["18 boxes"]
  ])("%s has no time", (text) => {
    expect(parse(text)).toMatchObject({ startTime: null, endTime: null, durationMinutes: null });
  });
});

describe("single start times", () => {
  it.each([
    ["at 9am", "09:00", []],
    ["at 9", "09:00", ["time-assumed"]],
    ["starting 10:30", "10:30", ["time-assumed"]],
    ["begins at 3", "15:00", ["time-assumed"]],
    ["kickoff 18:30", "18:30", []],
    ["lunch at noon", "12:00", []],
    ["10:15 sharp", "10:15", ["time-assumed"]]
  ] as const)("%s -> %s", (text, startTime, warnings) => {
    expect(parse(text)).toMatchObject({ startTime, endTime: null, durationMinutes: null, warnings });
  });

  it("applies defaultDurationMinutes, wrapping past midnight", () => {
    expect(parse("at 9am", { defaultDurationMinutes: 120 })).toMatchObject({ startTime: "09:00", endTime: "11:00", durationMinutes: 120 });
    expect(parse("at 11pm", { defaultDurationMinutes: 120 })).toMatchObject({ startTime: "23:00", endTime: "01:00", durationMinutes: 120 });
  });
});

describe("volunteer count", () => {
  it.each([
    ["8 volunteers", 8, []],
    ["12 helpers", 12, []],
    ["a dozen volunteers", 12, []],
    ["dozen people", 12, []],
    ["two volunteers", 2, []],
    ["Seventeen helpers", 17, []],
    ["8 spots", 8, []],
    ["10 adult volunteers", 10, []],
    ["need 5", 5, []],
    ["needs about 6", 6, []],
    ["need at least twenty", 20, []],
    ["0 volunteers", null, ["count-invalid"]],
    ["500 volunteers", 200, ["count-capped"]],
    ["someone volunteers", null, []]
  ] as const)("%s -> %s", (text, volunteersNeeded, warnings) => {
    expect(parse(text)).toMatchObject({ volunteersNeeded, warnings });
  });
});

describe("dates and weekdays", () => {
  it.each([
    ["2026-10-12", "2026-10-12", 1],
    ["2026-02-30", null, null],
    ["10/12", "2026-10-12", 1],
    ["10/1", "2027-10-01", 5],
    ["10/12/2027", "2027-10-12", 2],
    ["10/12/27", "2027-10-12", 2],
    ["2/30/2027", null, null],
    ["2/29", null, null],
    ["Oct 12", "2026-10-12", 1],
    ["October 12th, 2027", "2027-10-12", 2],
    ["Sept. 3", "2027-09-03", 5],
    ["may 5", "2027-05-05", 3],
    ["today", "2026-10-06", 2],
    ["tonight", "2026-10-06", 2],
    ["tomorrow", "2026-10-07", 3],
    ["Sun", "2026-10-11", 0],
    ["Mon", "2026-10-12", 1],
    ["Tue", "2026-10-13", 2],
    ["Wed", "2026-10-07", 3],
    ["Thurs.", "2026-10-08", 4],
    ["Fri", "2026-10-09", 5],
    ["next Saturday", "2026-10-10", 6],
    ["Sat Oct 17", "2026-10-17", 6]
  ] as const)("%s -> %s", (text, date, weekday) => {
    expect(parse(text)).toMatchObject({ date, weekday, warnings: [] });
  });

  it.each([
    ["every Saturday", 6],
    ["each Sat", 6],
    ["Saturdays", 6],
    ["weekly on Tues", 2],
    ["every week", null]
  ] as const)("%s is weekly", (text, weekday) => {
    expect(parse(text)).toMatchObject({ recurrence: "weekly", weekday });
  });

  it("derives the weekday from an explicit weekly date", () => {
    expect(parse("Oct 12 weekly")).toMatchObject({ date: "2026-10-12", weekday: 1, recurrence: "weekly" });
  });

  it("keeps the explicit date and warns when the weekday disagrees", () => {
    expect(parse("Fri Oct 17")).toMatchObject({ date: "2026-10-17", weekday: 6, warnings: ["weekday-mismatch"] });
  });

  it.each([
    ["Sat 9-1", null, 6],
    ["tomorrow", null, null],
    ["Oct 12", null, null],
    ["10/12/2027", "2027-10-12", 2],
    ["2026-10-12", "2026-10-12", 1]
  ] as const)("invalid reference date: %s -> %s", (text, date, weekday) => {
    const draft = parse(text, { referenceDate: "not-a-date" });
    expect(draft).toMatchObject({ date, weekday });
    expect(draft.warnings).toContain("reference-date-invalid");
  });
});

describe("location", () => {
  it.each([
    ["@ Alamo pantry", "Alamo pantry"],
    ["@Alamo", "Alamo"],
    ["at Alamo pantry 8 volunteers", "Alamo pantry"],
    ["at the library starting soon", "the library"],
    ["At Main St. Church", "Main St"],
    ["meet at the park.", "the park"],
    ["at 9", null],
    ["at   9am", null],
    ["at ###, at the gym", "the gym"],
    ["5 at volunteers", null],
    ["at", null]
  ] as const)("%s -> %s", (text, location) => {
    expect(parse(text).location).toBe(location);
  });

  it("caps the location length", () => {
    expect(parse(`at ${"x".repeat(200)}`).location).toHaveLength(120);
  });
});

describe("cause area", () => {
  it.each([
    ["tutoring kids", "education-youth"],
    ["blood drive", "health-wellness"],
    ["park cleanup", "environment"],
    ["dog walking", "animal-welfare"],
    ["shelter help", "animal-welfare"],
    ["homeless shelter meals", "housing-homelessness"],
    ["visit seniors", "seniors"],
    ["museum tour", "arts-culture"],
    ["hurricane relief", "disaster-relief"],
    ["neighborhood mural", "community-development"],
    ["food drive at the school", "hunger-food-security"],
    ["stuff envelopes", null]
  ] as const)("%s -> %s", (text, causeArea) => {
    expect(parse(text).causeArea).toBe(causeArea);
  });
});

describe("title", () => {
  it.each([
    ["help with sorting", "Sorting"],
    ["need 12 people, sorting cans", "Sorting cans"],
    ["Coat drive - need 5", "Coat drive"],
    ["8 volunteers", null],
    ["need volunteers!", null]
  ] as const)("%s -> %s", (text, title) => {
    expect(parse(text).title).toBe(title);
  });

  it("cuts a long title at a word boundary", () => {
    const title = parse(`${"word ".repeat(30)}`).title;
    expect(title).toBe(`Word${" word".repeat(15)}`);
  });

  it("hard-cuts a long title with no spaces", () => {
    expect(parse("a".repeat(100)).title).toBe(`A${"a".repeat(79)}`);
  });
});

describe("input limit and robustness", () => {
  it("truncates input over the default 2,000 characters", () => {
    const draft = parse(`${"a".repeat(2000)} 8 volunteers`);
    expect(draft.warnings).toEqual(["input-truncated"]);
    expect(draft.volunteersNeeded).toBeNull();
  });

  it("honors maxInputChars", () => {
    expect(parse("Sat 9-1 at the food bank", { maxInputChars: 7 })).toMatchObject({
      weekday: 6,
      startTime: "09:00",
      location: null,
      warnings: ["input-truncated", "time-assumed"]
    });
  });

  it.each([
    [""],
    ["\u{1F642}\u{1F642}\u{1F642}"],
    ["1234567890"],
    ["!!!"],
    ["-:-:-"],
    ["@"],
    ["\u0000\u0001"],
    ["9-9-9-9-9 at at at @@@ 1/1/1/1"],
    ["İstanbul at İzmir 3 helpers"],
    ["x".repeat(10_000)]
  ])("never throws and stays schema-valid: %#", (text) => {
    const draft = parse(text);
    expect(plannerDraftSchema.safeParse(draft).success).toBe(true);
    expect(parse(text)).toEqual(draft);
  });

  it("an empty string yields an empty draft", () => {
    expect(parse("")).toMatchObject({ title: null, matched: [], warnings: [] });
  });
});
