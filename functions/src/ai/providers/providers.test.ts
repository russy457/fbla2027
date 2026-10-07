/**
 * providers.test.ts
 * Both providers against fakes (no network, never a real LLM API): the
 * request carries the system prompt, question, token cap, and JSON schema;
 * 429, timeout, refusal, truncation, and empty replies map to failure kinds.
 */
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { AssistantModelError, type AssistantModelRequest } from "../assistantModel";
import { createAnthropicModel } from "./anthropicModel";
import { OPENROUTER_URL, createOpenRouterModel } from "./openRouterModel";

const REQUEST: AssistantModelRequest = { system: "SYSTEM", question: "When does check-in open?", maxOutputTokens: 1024, timeoutMs: 10_000 };

const failureKind = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
    return "none";
  } catch (error) {
    return error instanceof AssistantModelError ? error.kind : "other";
  }
};

const anthropicWith = (create: (...args: unknown[]) => Promise<unknown>) => {
  const client = { messages: { create: vi.fn(create) } } as unknown as Pick<Anthropic, "messages">;
  return { client, model: createAnthropicModel({ apiKey: "k", model: "claude-opus-5", client }) };
};

describe("anthropic provider", () => {
  it("sends one structured-output request and returns the text", async () => {
    const { client, model } = anthropicWith(async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: '{"answer":"Hi","citedSlugs":[]}' }] }));
    await expect(model.complete(REQUEST)).resolves.toBe('{"answer":"Hi","citedSlugs":[]}');
    const [body, options] = (client.messages.create as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(body).toMatchObject({ model: "claude-opus-5", max_tokens: 1024, system: "SYSTEM", messages: [{ role: "user", content: REQUEST.question }] });
    expect(body.output_config).toMatchObject({ effort: "low", format: { type: "json_schema" } });
    expect(options).toEqual({ timeout: 10_000 });
  });

  it("maps refusals, truncation, and empty replies", async () => {
    expect(await failureKind(anthropicWith(async () => ({ stop_reason: "refusal", content: [] })).model.complete(REQUEST))).toBe("refusal");
    expect(await failureKind(anthropicWith(async () => ({ stop_reason: "max_tokens", content: [] })).model.complete(REQUEST))).toBe("truncated");
    expect(await failureKind(anthropicWith(async () => ({ stop_reason: "end_turn", content: [] })).model.complete(REQUEST))).toBe("bad-output");
  });

  it("maps SDK errors: 429, timeout, connection, other HTTP, unknown", async () => {
    const rateLimited = new Anthropic.RateLimitError(429, undefined, "slow down", new Headers());
    expect(await failureKind(anthropicWith(async () => Promise.reject(rateLimited)).model.complete(REQUEST))).toBe("rate-limited");
    expect(await failureKind(anthropicWith(async () => Promise.reject(new Anthropic.APIConnectionTimeoutError())).model.complete(REQUEST))).toBe("timeout");
    expect(await failureKind(anthropicWith(async () => Promise.reject(new Anthropic.APIConnectionError({ message: "down" }))).model.complete(REQUEST))).toBe("network");
    const serverError = new Anthropic.InternalServerError(500, undefined, "boom", new Headers());
    expect(await failureKind(anthropicWith(async () => Promise.reject(serverError)).model.complete(REQUEST))).toBe("http-error");
    expect(await failureKind(anthropicWith(async () => Promise.reject(new Error("?"))).model.complete(REQUEST))).toBe("network");
  });
});

const jsonResponse = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("openrouter provider", () => {
  it("posts a chat completion with the schema and returns the content", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { choices: [{ finish_reason: "stop", message: { content: '{"answer":"Hi","citedSlugs":[]}' } }] }));
    const model = createOpenRouterModel({ apiKey: "k", model: "vendor/model", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(model.complete(REQUEST)).resolves.toContain('"answer"');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENROUTER_URL);
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer k");
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "vendor/model", max_tokens: 1024, response_format: { type: "json_schema" } });
  });

  it.each([
    ["rate-limited", async () => jsonResponse(429, {})],
    ["http-error", async () => jsonResponse(500, {})],
    ["refusal", async () => jsonResponse(200, { choices: [{ message: { refusal: "no" } }] })],
    ["truncated", async () => jsonResponse(200, { choices: [{ finish_reason: "length", message: { content: "{" } }] })],
    ["bad-output", async () => new Response("not json", { status: 200 })],
    ["timeout", async () => Promise.reject(Object.assign(new Error("t"), { name: "TimeoutError" }))],
    ["network", async () => Promise.reject(new TypeError("fetch failed"))]
  ])("maps %s", async (kind, impl) => {
    const model = createOpenRouterModel({ apiKey: "k", model: "m", fetchImpl: vi.fn(impl) as unknown as typeof fetch });
    expect(await failureKind(model.complete(REQUEST))).toBe(kind);
  });
});
