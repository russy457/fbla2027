/**
 * plannerOps.test.ts
 * ai.shiftPlannerParse schemas (SPEC 5.2, Tier 2): the op is in the shared
 * op map, input is strict and needs an org id and text, and the output holds
 * the same draft shape the deterministic parser produces.
 */
import { describe, expect, it } from "vitest";
import { OPS, OP_NAMES } from "./ops";
import { parsePlannerText } from "./plannerParse";
import { PLANNER_TEXT_HARD_CAP, shiftPlannerParseInput, shiftPlannerParseOutput } from "./schemas/ops/plannerOps";

describe("ai.shiftPlannerParse schemas", () => {
  it("is registered on the ai endpoint", () => {
    expect(OP_NAMES.ai).toContain("shiftPlannerParse");
    expect(OPS.ai.shiftPlannerParse.input).toBe(shiftPlannerParseInput);
  });

  it("accepts an org id and text; rejects blanks, bad ids, huge text, extra keys", () => {
    expect(shiftPlannerParseInput.safeParse({ orgId: "orgA", text: "need 12 people Sat 9-1" }).success).toBe(true);
    expect(shiftPlannerParseInput.safeParse({ orgId: "orgA", text: "   " }).success).toBe(false);
    expect(shiftPlannerParseInput.safeParse({ orgId: "a/b", text: "x" }).success).toBe(false);
    expect(shiftPlannerParseInput.safeParse({ orgId: "orgA", text: "x".repeat(PLANNER_TEXT_HARD_CAP + 1) }).success).toBe(false);
    expect(shiftPlannerParseInput.safeParse({ orgId: "orgA", text: "x", referenceDate: "2026-10-17" }).success).toBe(false);
  });

  it("wraps a parser draft", () => {
    const draft = parsePlannerText("need 12 people Sat 9-1 sorting at the food bank", { referenceDate: "2026-10-14" });
    expect(shiftPlannerParseOutput.safeParse({ draft, description: null, source: "parser", limited: false }).success).toBe(true);
    expect(shiftPlannerParseOutput.safeParse({ draft, description: "", source: "ai", limited: false }).success).toBe(false);
  });
});
