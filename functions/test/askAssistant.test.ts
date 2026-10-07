/**
 * askAssistant.test.ts
 * ai.askAssistant on the emulators (SPEC#fn-askassistant, SPEC 8.4, D7):
 *   - gate: signed in with a complete profile,
 *   - INPUT_TOO_LONG over 2,000 characters,
 *   - the emulator default (AI off) answers deterministically from help articles,
 *   - with a fake model: an "ai" answer citing articles, aiUsage counters,
 *     the personal limit (limited: true) and the global cap, and the
 *     fallback when the model fails.
 * No real LLM API is ever called.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { AI_GLOBAL_USAGE_ID, COLLECTIONS, PATHS, type AiUsageDoc } from "@fbla/shared";
import type { AssistantModel } from "../src/ai/assistantModel";
import { readAiSettings } from "../src/ai/aiSettings";
import { getHelpCorpus } from "../src/ai/helpCorpus";
import { createEndpointHandler } from "../src/lib/defineCallable";
import type { ServerDeps } from "../src/lib/deps";
import { createAskAssistantOp } from "../src/ops/askAssistant";
import { pingOp } from "../src/ops/ping";
import { call, db, expectCode, logLines, makeDeps, resetEmulators, user } from "./harness";
import { ADULT_BIRTH, profile } from "./fixtures";

const QUESTION = "When does check-in open before my shift?";

const seedProfile = async (uid: string, complete = true): Promise<void> => {
  await db.doc(PATHS.privateProfile(uid)).set(profile("Jordan", "Rivera", ADULT_BIRTH, complete));
};

/** Calls askAssistant through a dispatch table whose model is a fake. */
const askWithModel = async (model: AssistantModel, uid: string, deps: ServerDeps = makeDeps()) => {
  const op = createAskAssistantOp({
    settings: () => readAiSettings({ AI_ENABLED: "true", ANTHROPIC_API_KEY: "test-key" }),
    model: () => model,
    corpus: getHelpCorpus
  });
  const handler = createEndpointHandler("ai", [pingOp("ai"), op], () => deps);
  const response = await handler({ data: { op: "askAssistant", question: QUESTION, route: "/me/shifts" }, auth: user(uid) });
  return response.data as { answer: string; source: string; limited: boolean; articles: Array<{ slug: string; title: string }> };
};

const goodModel: AssistantModel = {
  name: "fake:good",
  complete: async () => JSON.stringify({ answer: "Check-in opens 30 minutes before the shift starts.", citedSlugs: ["kiosk-check-in"] })
};

beforeEach(async () => {
  await resetEmulators();
});

describe("ai.askAssistant gate and input", () => {
  it("requires sign-in and a complete profile", async () => {
    await expectCode(call("ai", "askAssistant", { question: QUESTION }, undefined), "AUTH_REQUIRED");
    await seedProfile("half", false);
    await expectCode(call("ai", "askAssistant", { question: QUESTION }, user("half")), "PROFILE_INCOMPLETE");
  });

  it("refuses questions over 2,000 characters with INPUT_TOO_LONG", async () => {
    await seedProfile("vol");
    await expectCode(call("ai", "askAssistant", { question: "a".repeat(2001) }, user("vol")), "INPUT_TOO_LONG");
    await expectCode(call("ai", "askAssistant", { question: "   " }, user("vol")), "INVALID_INPUT");
  });
});

describe("ai.askAssistant with AI off (emulator default)", () => {
  it("answers from the top 3 help articles and counts no AI usage", async () => {
    await seedProfile("vol");
    const result = await call<{ source: string; limited: boolean; articles: Array<{ slug: string }> }>("ai", "askAssistant", { question: QUESTION, route: "/me/shifts" }, user("vol"));
    expect(result).toMatchObject({ source: "help", limited: false });
    expect(result.articles).toHaveLength(3);
    expect(result.articles.map((article) => article.slug)).toContain("kiosk-check-in");
    expect((await db.collection(COLLECTIONS.aiUsage).doc("vol").get()).exists).toBe(false);
    expect(JSON.stringify(logLines)).not.toContain(QUESTION);
  });
});

describe("ai.askAssistant with a model", () => {
  it("returns a cited AI answer and counts the call", async () => {
    await seedProfile("vol");
    const result = await askWithModel(goodModel, "vol");
    expect(result).toMatchObject({ source: "ai", limited: false, answer: "Check-in opens 30 minutes before the shift starts." });
    expect(result.articles.map((article) => article.slug)).toEqual(["kiosk-check-in"]);
    const usage = (await db.collection(COLLECTIONS.aiUsage).doc("vol").get()).data() as AiUsageDoc;
    expect(usage).toMatchObject({ hourCount: 1, dayCount: 1 });
    expect((await db.collection(COLLECTIONS.aiUsage).doc(AI_GLOBAL_USAGE_ID).get()).data()).toMatchObject({ count: 1 });
  });

  it("returns limited help articles once the hourly limit is reached", async () => {
    await seedProfile("vol");
    const deps = makeDeps({ AI_PER_HOUR: "1" });
    await expect(askWithModel(goodModel, "vol", deps)).resolves.toMatchObject({ source: "ai" });
    const limited = await askWithModel(goodModel, "vol", deps);
    expect(limited).toMatchObject({ source: "help", limited: true, answer: "You've reached today's assistant limit; here are matching help articles." });
    expect(limited.articles.length).toBeGreaterThan(0);
  });

  it("turns AI off for everyone at the global daily cap", async () => {
    await seedProfile("a");
    await seedProfile("b");
    const deps = makeDeps({ AI_GLOBAL_DAILY_CAP: "1" });
    await expect(askWithModel(goodModel, "a", deps)).resolves.toMatchObject({ source: "ai" });
    await expect(askWithModel(goodModel, "b", deps)).resolves.toMatchObject({ source: "help", limited: false });
  });

  it("falls back to help articles when the model returns bad JSON or fails", async () => {
    await seedProfile("vol");
    const badJson: AssistantModel = { name: "fake:bad", complete: async () => "not json" };
    await expect(askWithModel(badJson, "vol")).resolves.toMatchObject({ source: "help", limited: false });
    const failing: AssistantModel = { name: "fake:429", complete: async () => Promise.reject(new Error("429")) };
    await expect(askWithModel(failing, "vol")).resolves.toMatchObject({ source: "help" });
    expect(logLines.some((line) => line.message === "ai.askAssistant fallback" && line.fields?.reason === "bad-output")).toBe(true);
  });
});
