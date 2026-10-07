/**
 * assistantAnswer.test.ts
 * The askAssistant decision flow (SPEC 8.4) with a fake model: grounding,
 * citations limited to retrieved articles, plain-text answers, and every
 * fallback path (AI off, no match, personal limit, global cap, 429, timeout,
 * refusal, bad JSON). The system prompt must carry article text and the
 * route only.
 */
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FALLBACK_ANSWER, LIMITED_ANSWER, NO_MATCH_ANSWER, answerQuestion, toPlainAnswer, type AnswerParams } from "./assistantAnswer";
import { AssistantModelError, parseAssistantReply, type AssistantModel, type AssistantModelRequest } from "./assistantModel";
import { createHelpCorpus, helpContentCandidates, readHelpArticles } from "./helpCorpus";

const corpus = createHelpCorpus(readHelpArticles(join(process.cwd(), "src", "content", "help")));
const QUESTION = "When does check-in open before my shift?";

const fakeModel = (complete: (request: AssistantModelRequest) => Promise<string>): AssistantModel & { complete: ReturnType<typeof vi.fn> } => ({
  name: "fake:model",
  complete: vi.fn(complete)
});

const params = (overrides: Partial<AnswerParams> = {}): AnswerParams => ({
  question: QUESTION,
  route: "/me/shifts",
  corpus,
  model: null,
  maxOutputTokens: 1024,
  timeoutMs: 1_000,
  consumeUsage: async () => "ok",
  ...overrides
});

describe("answerQuestion fallbacks", () => {
  it("answers from the top 3 help articles when AI is off, without counting usage", async () => {
    const consumeUsage = vi.fn(async () => "ok" as const);
    const onFallback = vi.fn();
    const result = await answerQuestion(params({ consumeUsage, onFallback }));
    expect(result).toMatchObject({ source: "help", limited: false, answer: FALLBACK_ANSWER });
    expect(result.articles).toHaveLength(3);
    expect(result.articles.map((article) => article.slug)).toContain("kiosk-check-in");
    expect(consumeUsage).not.toHaveBeenCalled();
    expect(onFallback).toHaveBeenCalledWith("ai-off");
  });

  it("does not ask the model when no article matches", async () => {
    const model = fakeModel(async () => "{}");
    const result = await answerQuestion(params({ question: "zzzz qqqq", model }));
    expect(result).toEqual({ answer: NO_MATCH_ANSWER, source: "help", limited: false, articles: [] });
    expect(model.complete).not.toHaveBeenCalled();
  });

  it("returns limited articles over the personal limit and plain help over the global cap", async () => {
    const model = fakeModel(async () => "{}");
    expect(await answerQuestion(params({ model, consumeUsage: async () => "user-limit" }))).toMatchObject({ source: "help", limited: true, answer: LIMITED_ANSWER });
    expect(await answerQuestion(params({ model, consumeUsage: async () => "global-cap" }))).toMatchObject({ source: "help", limited: false });
    expect(model.complete).not.toHaveBeenCalled();
  });

  it.each([
    ["rate-limited", async () => Promise.reject(new AssistantModelError("rate-limited"))],
    ["refusal", async () => Promise.reject(new AssistantModelError("refusal"))],
    ["bad-output", async () => "Sure! Check-in opens 30 minutes early."],
    ["bad-output", async () => '{"answer": 42}'],
    ["bad-output", async () => '{"answer":"<b></b>","citedSlugs":[]}'],
    ["network", async () => Promise.reject(new Error("socket hang up"))],
    ["timeout", () => new Promise<string>(() => undefined)]
  ])("falls back on %s", async (reason, complete) => {
    const onFallback = vi.fn();
    const result = await answerQuestion(params({ model: fakeModel(complete), timeoutMs: 20, onFallback }));
    expect(result.source).toBe("help");
    expect(result.articles.length).toBeGreaterThan(0);
    expect(onFallback).toHaveBeenCalledWith(reason);
  });
});

describe("answerQuestion with the model", () => {
  it("grounds the prompt on retrieved articles and the route, and keeps only real citations", async () => {
    const model = fakeModel(async () => JSON.stringify({ answer: "Check-in opens 30 minutes before the start.", citedSlugs: ["made-up", "kiosk-check-in", "kiosk-check-in"] }));
    const result = await answerQuestion(params({ model }));
    expect(result).toEqual({
      answer: "Check-in opens 30 minutes before the start.",
      source: "ai",
      limited: false,
      articles: [{ slug: "kiosk-check-in", title: corpus.getArticle("kiosk-check-in")?.title }]
    });
    const request = model.complete.mock.calls[0]?.[0] as AssistantModelRequest;
    expect(request.question).toBe(QUESTION);
    expect(request.system).toContain('<article slug="kiosk-check-in"');
    expect(request.system).toContain("The user is on the page: /me/shifts");
    expect(request.system).not.toContain(QUESTION);
  });

  it("cites the top article when the model cites nothing valid, and strips HTML", async () => {
    const model = fakeModel(async () => '```json\n{"answer":"<script>x</script>Open **My Shifts**.","citedSlugs":[]}\n```');
    const result = await answerQuestion(params({ model, route: null }));
    expect(result.answer).toBe("xOpen **My Shifts**.");
    expect(result.articles).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("toPlainAnswer removes control characters, collapses blank runs, and clips", () => {
    expect(toPlainAnswer("a\u0007b\n\n\n\nc")).toBe("ab\n\nc");
    expect(toPlainAnswer("x".repeat(5000))).toHaveLength(4000);
  });

  it("parseAssistantReply rejects non-JSON and wrong shapes", () => {
    expect(() => parseAssistantReply("nope")).toThrow(AssistantModelError);
    expect(() => parseAssistantReply('{"answer":""}')).toThrow(/schema/);
    expect(parseAssistantReply('{"answer":"ok","citedSlugs":["a"]}')).toEqual({ answer: "ok", citedSlugs: ["a"] });
  });

  it("looks for articles in the override, the bundle dir, and the repo", () => {
    const dirs = helpContentCandidates({ HELP_CONTENT_DIR: "/custom" }, "/repo", "/deploy/lib");
    expect(dirs[0]).toBe("/custom");
    expect(dirs).toHaveLength(4);
    expect(helpContentCandidates({}, "/repo", null)).toHaveLength(2);
  });
});
