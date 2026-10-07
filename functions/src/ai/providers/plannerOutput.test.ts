/**
 * plannerOutput.test.ts
 * Tier 2 lane B: both providers send the request's own output schema when
 * one is given (ai.shiftPlannerParse), and keep the assistant schema
 * otherwise. Fakes only; no network, never a real LLM API.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { ASSISTANT_REPLY_JSON_SCHEMA, type AssistantModelRequest } from "../assistantModel";
import { PLANNER_REPLY_JSON_SCHEMA } from "../plannerReply";
import { createAnthropicModel } from "./anthropicModel";
import { createOpenRouterModel } from "./openRouterModel";

const BASE: AssistantModelRequest = { system: "S", question: "Q", maxOutputTokens: 1024, timeoutMs: 10_000 };
const PLANNER: AssistantModelRequest = { ...BASE, output: { name: "shift_draft", schema: PLANNER_REPLY_JSON_SCHEMA } };

describe("provider output schema", () => {
  it("anthropic: planner schema when given, assistant schema by default", async () => {
    const create = vi.fn(async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "{}" }] }));
    const model = createAnthropicModel({ apiKey: "k", model: "m", client: { messages: { create } } as unknown as Pick<Anthropic, "messages"> });
    await model.complete(PLANNER);
    await model.complete(BASE);
    const formats = (create.mock.calls as unknown as Array<[{ output_config: { format: { schema: unknown } } }]>).map(([body]) => body.output_config.format.schema);
    expect(formats).toEqual([{ ...PLANNER_REPLY_JSON_SCHEMA }, { ...ASSISTANT_REPLY_JSON_SCHEMA }]);
  });

  it("openrouter: names and sends the planner schema", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "{}" } }] }), { status: 200 }));
    const model = createOpenRouterModel({ apiKey: "k", model: "m", fetchImpl: fetchImpl as unknown as typeof fetch });
    await model.complete(PLANNER);
    await model.complete(BASE);
    const formats = (fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>).map(([, init]) => JSON.parse(String(init.body)).response_format.json_schema.name);
    expect(formats).toEqual(["shift_draft", "assistant_answer"]);
  });
});
