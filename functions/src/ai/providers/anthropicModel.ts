/**
 * anthropicModel.ts
 * The default askAssistant provider (SPEC 8.4: "Provider: Anthropic, model id
 * from env AI_MODEL"), using the official Anthropic SDK.
 *
 * One non-streaming Messages API call per question:
 *   - structured output (output_config.format json_schema) so the reply is
 *     the {answer, citedSlugs} JSON the caller validates,
 *   - effort "low": short grounded Q&A does not need deep reasoning and must
 *     finish inside the 10 s timeout,
 *   - maxRetries 0: a 429 or timeout goes straight to the help-article
 *     fallback instead of making the user wait for retries.
 * Failures map to AssistantModelError kinds; refusal and max_tokens stop
 * reasons are failures too, because the text would be unusable.
 */
import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_REPLY_JSON_SCHEMA, AssistantModelError, type AssistantModel, type AssistantModelRequest } from "../assistantModel";

export interface AnthropicModelOptions {
  readonly apiKey: string;
  readonly model: string;
  /** Injected in tests; production builds the SDK client from the key. */
  readonly client?: Pick<Anthropic, "messages">;
}

const toModelError = (error: unknown): AssistantModelError => {
  if (error instanceof AssistantModelError) return error;
  if (error instanceof Anthropic.RateLimitError) return new AssistantModelError("rate-limited");
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new AssistantModelError("timeout");
  if (error instanceof Anthropic.APIConnectionError) return new AssistantModelError("network");
  if (error instanceof Anthropic.APIError) return new AssistantModelError("http-error", String(error.status));
  return new AssistantModelError("network", error instanceof Error ? error.name : "unknown");
};

export const createAnthropicModel = (options: AnthropicModelOptions): AssistantModel => {
  const client = options.client ?? new Anthropic({ apiKey: options.apiKey, maxRetries: 0 });
  return {
    name: `anthropic:${options.model}`,
    complete: async (request: AssistantModelRequest): Promise<string> => {
      try {
        const response = await client.messages.create(
          {
            model: options.model,
            max_tokens: request.maxOutputTokens,
            system: request.system,
            messages: [{ role: "user", content: request.question }],
            output_config: { effort: "low", format: { type: "json_schema", schema: { ...ASSISTANT_REPLY_JSON_SCHEMA } } }
          },
          { timeout: request.timeoutMs }
        );
        if (response.stop_reason === "refusal") throw new AssistantModelError("refusal");
        if (response.stop_reason === "max_tokens") throw new AssistantModelError("truncated");
        const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
        if (text.trim() === "") throw new AssistantModelError("bad-output", "empty reply");
        return text;
      } catch (error) {
        throw toModelError(error);
      }
    }
  };
};
