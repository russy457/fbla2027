/**
 * aiSettings.ts
 * Reads the AI configuration once per instance (SPEC 8.4, SPEC#env 10.6).
 *
 *   AI_ENABLED          "true" turns the model on (default false, so the
 *                       emulator and every test use the deterministic help
 *                       article fallback)
 *   AI_PROVIDER         "anthropic" (default, SPEC) or "openrouter"
 *   AI_MODEL            model id; blank uses the provider default below
 *   ANTHROPIC_API_KEY   Functions secret for the anthropic provider
 *   OPENROUTER_API_KEY  Functions secret for the openrouter provider
 *   AI_TIMEOUT_MS       per-request timeout (default 10,000 ms, SPEC 8.4)
 *
 * Keys are secrets (lib/secrets.ts), never VITE_ variables. When AI is on but
 * the key or model is missing, `unavailableReason` says why and askAssistant
 * logs one line and serves the fallback (SPEC#dx-failure X10).
 */
import type { EnvSource } from "@fbla/shared";

export const AI_PROVIDERS = ["anthropic", "openrouter"] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

/** Model used when AI_MODEL is blank. OpenRouter has no default: its ids are provider-prefixed. */
export const DEFAULT_MODEL_BY_PROVIDER: Readonly<Record<AiProviderName, string | null>> = Object.freeze({
  anthropic: "claude-opus-5",
  openrouter: null
});

/** SPEC 8.4: request timeout 10 s. */
export const DEFAULT_AI_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 25_000;

export type AiUnavailableReason = "disabled" | "unknown-provider" | "missing-key" | "missing-model";

export interface AiSettings {
  readonly provider: AiProviderName;
  readonly model: string | null;
  readonly apiKey: string | null;
  readonly timeoutMs: number;
  /** null when the model may be called; otherwise why the fallback is used. */
  readonly unavailableReason: AiUnavailableReason | null;
}

const nonEmpty = (value: string | undefined): string | null => (value && value.trim() !== "" ? value.trim() : null);

const isProvider = (value: string): value is AiProviderName => (AI_PROVIDERS as readonly string[]).includes(value);

const readTimeout = (raw: string | undefined): number => {
  const value = Number(raw);
  if (raw === undefined || !Number.isFinite(value)) return DEFAULT_AI_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(value)));
};

const keyVariable: Readonly<Record<AiProviderName, string>> = { anthropic: "ANTHROPIC_API_KEY", openrouter: "OPENROUTER_API_KEY" };

/** Name of the secret the configured provider needs (used for deploy-time secret binding). */
export const secretNameFor = (provider: AiProviderName): "ANTHROPIC_API_KEY" | "OPENROUTER_API_KEY" =>
  provider === "openrouter" ? "OPENROUTER_API_KEY" : "ANTHROPIC_API_KEY";

export const readAiSettings = (env: EnvSource): AiSettings => {
  const rawProvider = nonEmpty(env.AI_PROVIDER)?.toLowerCase() ?? "anthropic";
  const provider: AiProviderName = isProvider(rawProvider) ? rawProvider : "anthropic";
  const model = nonEmpty(env.AI_MODEL) ?? DEFAULT_MODEL_BY_PROVIDER[provider];
  const apiKey = nonEmpty(env[keyVariable[provider]]);
  const enabled = nonEmpty(env.AI_ENABLED) === "true";

  const unavailableReason = ((): AiUnavailableReason | null => {
    if (!enabled) return "disabled";
    if (!isProvider(rawProvider)) return "unknown-provider";
    if (apiKey === null) return "missing-key";
    if (model === null) return "missing-model";
    return null;
  })();

  return { provider, model, apiKey, timeoutMs: readTimeout(env.AI_TIMEOUT_MS), unavailableReason };
};
