/**
 * shiftPlannerParse.test.ts
 * ai.shiftPlannerParse on the emulators (SPEC 5.2, SPEC 8.4, Tier 2):
 *   - gate: coordinatorOfOrg(orgId); cross-org denial, volunteers, kiosk
 *     tokens, unknown orgs, signed out,
 *   - INPUT_TOO_LONG over 2,000 characters,
 *   - AI off (emulator default): the deterministic parser, no AI usage,
 *   - with a fake model: an "ai" draft and usage counted; the personal limit
 *     (limited: true), the global cap, and bad output fall back to the parser,
 *   - "today" is the request clock's date in the org's zone.
 * No real LLM API is ever called, and the text never reaches the logs.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS, parsePlannerText, type AiUsageDoc } from "@fbla/shared";
import type { AssistantModel } from "../src/ai/assistantModel";
import { readAiSettings } from "../src/ai/aiSettings";
import { createEndpointHandler } from "../src/lib/defineCallable";
import type { ServerDeps } from "../src/lib/deps";
import { createShiftPlannerParseOp } from "../src/ops/shiftPlannerParse";
import { aiOps } from "../src/endpoints/ai";
import { BASE_MS, HOUR, call, db, expectCode, kioskUser, logLines, makeDeps, resetEmulators, testClock, user } from "./harness";
import { seedWorld } from "./fixtures";

const TEXT = "need 12 people Sat 9-1 sorting at the food bank";
/** BASE_MS is Saturday 2026-10-17 08:00 CDT, so "Sat" means the next Saturday, Oct 24. */
const REFERENCE = "2026-10-17";

const reply = (date = "2026-10-24") =>
  JSON.stringify({
    title: "Sort food donations",
    volunteersNeeded: 12,
    date,
    startTime: "09:00",
    endTime: "13:00",
    location: "the food bank",
    causeArea: "hunger-food-security",
    weekly: false,
    description: "Help sort donated food."
  });

const fakeModel = (text: string): AssistantModel => ({ name: "fake", complete: async () => text });

type Output = { draft: { title: string | null; date: string | null }; description: string | null; source: string; limited: boolean };

const planWithModel = async (model: AssistantModel, uid: string, orgId = "orgA", deps: ServerDeps = makeDeps()): Promise<Output> => {
  const op = createShiftPlannerParseOp({ settings: () => readAiSettings({ AI_ENABLED: "true", ANTHROPIC_API_KEY: "test-key" }), model: () => model });
  const handler = createEndpointHandler("ai", aiOps.map((entry) => (entry.op === "shiftPlannerParse" ? op : entry)), () => deps);
  const response = await handler({ data: { op: "shiftPlannerParse", orgId, text: TEXT }, auth: user(uid) });
  return response.data as Output;
};

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
});

describe("ai.shiftPlannerParse gate", () => {
  it("requires a coordinator of the named org", async () => {
    await expectCode(call("ai", "shiftPlannerParse", { orgId: "orgA", text: TEXT }, undefined), "AUTH_REQUIRED");
    await expectCode(call("ai", "shiftPlannerParse", { orgId: "orgA", text: TEXT }, user("vol1")), "PERMISSION_DENIED");
    // Cross-org: the coordinator of org B cannot draft for org A.
    await expectCode(call("ai", "shiftPlannerParse", { orgId: "orgA", text: TEXT }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("ai", "shiftPlannerParse", { orgId: "missing", text: TEXT }, user("coordA")), "NOT_FOUND");
  });

  it("refuses kiosk tokens", async () => {
    await expectCode(call("ai", "shiftPlannerParse", { orgId: "orgA", text: TEXT }, kioskUser("inst1")), "PERMISSION_DENIED");
  });

  it("refuses text over 2,000 characters and blank text", async () => {
    await expectCode(call("ai", "shiftPlannerParse", { orgId: "orgA", text: "a".repeat(2001) }, user("coordA")), "INPUT_TOO_LONG");
    await expectCode(call("ai", "shiftPlannerParse", { orgId: "orgA", text: "  " }, user("coordA")), "INVALID_INPUT");
  });
});

describe("ai.shiftPlannerParse with AI off (emulator default)", () => {
  it("answers with the deterministic parser for today in the org zone", async () => {
    const result = await call<Output>("ai", "shiftPlannerParse", { orgId: "orgA", text: TEXT }, user("coordA"));
    expect(result).toEqual({ draft: parsePlannerText(TEXT, { referenceDate: REFERENCE }), description: null, source: "parser", limited: false });
    expect(JSON.stringify(logLines)).not.toContain("food bank");
  });

  it("uses the clock's date, not the wall clock", async () => {
    testClock.set(BASE_MS + 24 * HOUR);
    const result = await call<Output>("ai", "shiftPlannerParse", { orgId: "orgA", text: "Sat 9-1" }, user("coordA"));
    expect(result.draft.date).toBe(parsePlannerText("Sat 9-1", { referenceDate: "2026-10-18" }).date);
  });
});

describe("ai.shiftPlannerParse with a model", () => {
  it("returns the AI draft and counts the call", async () => {
    const result = await planWithModel(fakeModel(reply()), "coordA");
    expect(result).toMatchObject({ source: "ai", limited: false, description: "Help sort donated food.", draft: { title: "Sort food donations", date: "2026-10-24" } });
    const usage = (await db.collection(COLLECTIONS.aiUsage).doc("coordA").get()).data() as AiUsageDoc;
    expect(usage).toMatchObject({ hourCount: 1, dayCount: 1 });
  });

  it("falls back to the parser on bad output and past dates", async () => {
    await expect(planWithModel(fakeModel("not json"), "coordA")).resolves.toMatchObject({ source: "parser", limited: false, description: null });
    await expect(planWithModel(fakeModel(reply("2026-10-01")), "coordA")).resolves.toMatchObject({ source: "parser" });
    expect(logLines.some((line) => line.message === "ai.shiftPlannerParse fallback" && line.fields?.reason === "bad-output")).toBe(true);
  });

  it("shares the AI limits with the assistant: personal limit, then global cap", async () => {
    const perUser = makeDeps({ AI_PER_HOUR: "1" });
    await expect(planWithModel(fakeModel(reply()), "coordA", "orgA", perUser)).resolves.toMatchObject({ source: "ai" });
    await expect(planWithModel(fakeModel(reply()), "coordA", "orgA", perUser)).resolves.toMatchObject({ source: "parser", limited: true });
    const capped = makeDeps({ AI_GLOBAL_DAILY_CAP: "1" });
    await expect(planWithModel(fakeModel(reply()), "coordB", "orgB", capped)).resolves.toMatchObject({ source: "parser", limited: false });
  });

  it("denies cross-org even with a model configured", async () => {
    await expectCode(planWithModel(fakeModel(reply()), "coordB", "orgA"), "PERMISSION_DENIED");
  });
});
