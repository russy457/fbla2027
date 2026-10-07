/**
 * assistantModel.ts
 * The provider-neutral contract between askAssistant and an LLM provider
 * (SPEC 8.4). A provider turns {system, question} into raw reply text; the
 * caller validates that text with `assistantReplySchema` so every provider is
 * held to the same output contract and "bad JSON" always means fallback.
 *
 * Providers report failures as AssistantModelError with a `kind` so logs can
 * say why the fallback was used (429, timeout, refusal, ...) without leaking
 * provider messages to the browser.
 */
import { z } from "zod";

export interface AssistantModelRequest {
  readonly system: string;
  readonly question: string;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
  /**
   * Tier 2 lane B: the JSON Schema the reply must follow, for ops other than
   * askAssistant (shiftPlannerParse). Omitted means ASSISTANT_REPLY_JSON_SCHEMA.
   */
  readonly output?: { readonly name: string; readonly schema: Readonly<Record<string, unknown>> };
}

export interface AssistantModel {
  /** "provider:model", for logs. */
  readonly name: string;
  /** Resolves to the model's raw text reply (expected to be JSON). */
  complete(request: AssistantModelRequest): Promise<string>;
}

export const MODEL_FAILURE_KINDS = ["rate-limited", "timeout", "refusal", "truncated", "bad-output", "http-error", "network"] as const;
export type ModelFailureKind = (typeof MODEL_FAILURE_KINDS)[number];

export class AssistantModelError extends Error {
  constructor(
    readonly kind: ModelFailureKind,
    detail?: string
  ) {
    super(detail ? `${kind}: ${detail}` : kind);
    this.name = "AssistantModelError";
  }
}

/** What the model must return. Lengths are generous; the answer is clipped later. */
export const assistantReplySchema = z.object({
  answer: z.string().trim().min(1).max(6_000),
  citedSlugs: z.array(z.string().max(100)).max(10)
});
export type AssistantReply = z.infer<typeof assistantReplySchema>;

/** The same contract as a JSON Schema, for providers' structured output modes. */
export const ASSISTANT_REPLY_JSON_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    answer: { type: "string", description: "Plain-text answer for the user." },
    citedSlugs: { type: "array", items: { type: "string" }, description: "Slugs of the help articles used." }
  },
  required: ["answer", "citedSlugs"],
  additionalProperties: false
});

/** Parses raw model text into a reply, or throws bad-output. Tolerates a ```json fence. */
export const parseAssistantReply = (raw: string): AssistantReply => {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let json: unknown;
  try {
    json = JSON.parse(unfenced);
  } catch {
    throw new AssistantModelError("bad-output", "reply is not JSON");
  }
  const parsed = assistantReplySchema.safeParse(json);
  if (!parsed.success) throw new AssistantModelError("bad-output", "reply does not match the schema");
  return parsed.data;
};
