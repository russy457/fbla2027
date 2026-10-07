/**
 * plannerAnswer.test.ts
 * The ai.shiftPlannerParse decision flow and output contract (SPEC 8.4,
 * Tier 2) with fake models only (never a real LLM API): AI off, personal
 * limit, global cap, good reply, and every failure that must fall back to the
 * deterministic parser (bad JSON, extra keys, past date, timeout, refusal).
 */
import { describe, expect, it, vi } from "vitest";
import { parsePlannerText } from "@fbla/shared";
import { AssistantModelError, type AssistantModel, type AssistantModelRequest } from "./assistantModel";
import { planShift, type PlanShiftParams } from "./plannerAnswer";
import { buildPlannerPrompt } from "./plannerPrompt";
import { PLANNER_REPLY_JSON_SCHEMA, cleanDescription, draftFromReply, parsePlannerReply, type PlannerReply } from "./plannerReply";

const TEXT = "need 12 people Sat 9-1 sorting at the food bank";
/** A Wednesday. */
const TODAY = "2026-10-14";

const REPLY: PlannerReply = {
  title: "Sort food donations",
  volunteersNeeded: 12,
  date: "2026-10-17",
  startTime: "09:00",
  endTime: "13:00",
  location: "the food bank",
  causeArea: "hunger-food-security",
  weekly: false,
  description: "Help sort donated food at the food bank."
};

const modelReturning = (reply: unknown): AssistantModel & { calls: AssistantModelRequest[] } => {
  const calls: AssistantModelRequest[] = [];
  return {
    name: "fake",
    calls,
    complete: async (request) => {
      calls.push(request);
      return typeof reply === "string" ? reply : JSON.stringify(reply);
    }
  };
};

const params = (overrides: Partial<PlanShiftParams> = {}): PlanShiftParams => ({
  text: TEXT,
  referenceDate: TODAY,
  timeZone: "America/Chicago",
  model: modelReturning(REPLY),
  maxInputChars: 2000,
  maxOutputTokens: 1024,
  timeoutMs: 1000,
  consumeUsage: async () => "ok",
  ...overrides
});

const parserDraft = parsePlannerText(TEXT, { referenceDate: TODAY });

describe("planShift", () => {
  it("returns the model's draft and description with source ai", async () => {
    const model = modelReturning(REPLY);
    const result = await planShift(params({ model }));
    expect(result).toMatchObject({ source: "ai", limited: false, description: "Help sort donated food at the food bank." });
    expect(result.draft).toMatchObject({ title: "Sort food donations", volunteersNeeded: 12, date: "2026-10-17", weekday: 6, durationMinutes: 240, recurrence: null });
    expect(result.draft.matched).toEqual(["title", "volunteersNeeded", "date", "weekday", "startTime", "endTime", "durationMinutes", "location", "causeArea"]);
    // The prompt carries no user data, and the reply format is the planner schema.
    expect(model.calls[0]?.question).toBe(TEXT);
    expect(model.calls[0]?.system).not.toContain(TEXT);
    expect(model.calls[0]?.output).toEqual({ name: "shift_draft", schema: PLANNER_REPLY_JSON_SCHEMA });
  });

  it("uses the parser when AI is off, without counting usage", async () => {
    const consumeUsage = vi.fn(async () => "ok" as const);
    const onFallback = vi.fn();
    const result = await planShift(params({ model: null, consumeUsage, onFallback }));
    expect(result).toEqual({ draft: parserDraft, description: null, source: "parser", limited: false });
    expect(consumeUsage).not.toHaveBeenCalled();
    expect(onFallback).toHaveBeenCalledWith("ai-off");
  });

  it("marks the personal limit as limited, the global cap as not", async () => {
    await expect(planShift(params({ consumeUsage: async () => "user-limit" }))).resolves.toMatchObject({ source: "parser", limited: true });
    await expect(planShift(params({ consumeUsage: async () => "global-cap" }))).resolves.toMatchObject({ source: "parser", limited: false });
  });

  it.each([
    ["not JSON", "here is your shift"],
    ["extra key", { ...REPLY, notes: "x" }],
    ["wrong type", { ...REPLY, volunteersNeeded: "twelve" }],
    ["past date", { ...REPLY, date: "2026-10-01" }],
    ["unknown cause", { ...REPLY, causeArea: "sports" }]
  ])("falls back to the parser on %s", async (_label, reply) => {
    const onFallback = vi.fn();
    await expect(planShift(params({ model: modelReturning(reply), onFallback }))).resolves.toEqual({ draft: parserDraft, description: null, source: "parser", limited: false });
    expect(onFallback).toHaveBeenCalledWith("bad-output");
  });

  it("falls back on refusal, provider errors, and timeout", async () => {
    const refusing: AssistantModel = { name: "r", complete: async () => Promise.reject(new AssistantModelError("refusal")) };
    const broken: AssistantModel = { name: "b", complete: async () => Promise.reject(new Error("boom")) };
    const slow: AssistantModel = { name: "s", complete: () => new Promise(() => undefined) };
    const reasons: string[] = [];
    const onFallback = (reason: string) => reasons.push(reason);
    for (const model of [refusing, broken, slow]) {
      await expect(planShift(params({ model, timeoutMs: 20, onFallback }))).resolves.toMatchObject({ source: "parser" });
    }
    expect(reasons).toEqual(["refusal", "network", "timeout"]);
  });
});

describe("planner reply contract", () => {
  it("accepts a fenced reply and derives times like the parser", () => {
    expect(parsePlannerReply("```json\n" + JSON.stringify(REPLY) + "\n```").title).toBe("Sort food donations");
    const overnight = draftFromReply({ ...REPLY, startTime: "22:00", endTime: "02:00", weekly: true }, TODAY);
    expect(overnight).toMatchObject({ durationMinutes: 240, warnings: ["ends-next-day"], recurrence: "weekly" });
    const equal = draftFromReply({ ...REPLY, startTime: "09:00", endTime: "09:00" }, TODAY);
    expect(equal).toMatchObject({ endTime: null, durationMinutes: null, warnings: ["time-range-invalid"] });
    const startOnly = draftFromReply({ ...REPLY, date: null, endTime: null }, TODAY);
    expect(startOnly).toMatchObject({ weekday: null, durationMinutes: null, warnings: [] });
    expect(startOnly.matched).not.toContain("date");
  });

  it("cleans descriptions to plain text within the listing limit", () => {
    expect(cleanDescription(null)).toBeNull();
    expect(cleanDescription("  <b>Help</b>   sort\n\nfood. ")).toBe("Help sort food.");
    expect(cleanDescription("<p></p>")).toBeNull();
    const long = cleanDescription("word ".repeat(400)) ?? "";
    expect(long.length).toBe(600);
    expect(long.endsWith("…")).toBe(true);
  });

  it("builds a prompt with today, the zone, and the cause list only", () => {
    const prompt = buildPlannerPrompt(TODAY, "America/Denver");
    expect(prompt).toContain("Wednesday 2026-10-14");
    expect(prompt).toContain("America/Denver");
    expect(prompt).toContain("hunger-food-security");
  });
});
