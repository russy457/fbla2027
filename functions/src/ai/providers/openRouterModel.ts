/**
 * openRouterModel.ts
 * Optional alternative provider (AI_PROVIDER=openrouter), kept because the
 * old Trove app used OpenRouter and a team may want to try other models.
 * Calls OpenRouter's chat completions endpoint with a JSON schema response
 * format. Unlike the old app, the key is a Functions secret and the call is
 * made server-side only.
 *
 * `fetchImpl` is injectable so tests never touch the network.
 */
import { ASSISTANT_REPLY_JSON_SCHEMA, AssistantModelError, type AssistantModel, type AssistantModelRequest } from "../assistantModel";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterModelOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly fetchImpl?: typeof fetch;
}

interface ChatCompletion {
  readonly choices?: ReadonlyArray<{ readonly finish_reason?: string | null; readonly message?: { readonly content?: string | null; readonly refusal?: string | null } }>;
}

const statusError = (status: number): AssistantModelError =>
  status === 429 ? new AssistantModelError("rate-limited") : new AssistantModelError("http-error", String(status));

const isAbort = (error: unknown): boolean => error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

export const createOpenRouterModel = (options: OpenRouterModelOptions): AssistantModel => {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    name: `openrouter:${options.model}`,
    complete: async (request: AssistantModelRequest): Promise<string> => {
      let response: Response;
      try {
        response = await fetchImpl(OPENROUTER_URL, {
          method: "POST",
          signal: AbortSignal.timeout(request.timeoutMs),
          headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model: options.model,
            max_tokens: request.maxOutputTokens,
            messages: [
              { role: "system", content: request.system },
              { role: "user", content: request.question }
            ],
            response_format: {
              type: "json_schema",
              json_schema: { name: request.output?.name ?? "assistant_answer", strict: true, schema: request.output?.schema ?? ASSISTANT_REPLY_JSON_SCHEMA }
            }
          })
        });
      } catch (error) {
        throw new AssistantModelError(isAbort(error) ? "timeout" : "network");
      }
      if (!response.ok) throw statusError(response.status);
      const body = (await response.json().catch(() => null)) as ChatCompletion | null;
      const choice = body?.choices?.[0];
      if (choice?.message?.refusal) throw new AssistantModelError("refusal");
      if (choice?.finish_reason === "length") throw new AssistantModelError("truncated");
      const text = choice?.message?.content ?? "";
      if (text.trim() === "") throw new AssistantModelError("bad-output", "empty reply");
      return text;
    }
  };
};
