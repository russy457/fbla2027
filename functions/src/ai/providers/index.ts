/**
 * providers/index.ts
 * Picks the AssistantModel for the configured provider (aiSettings.ts), or
 * null when AI is off or misconfigured (askAssistant then uses the fallback).
 */
import type { AssistantModel } from "../assistantModel";
import type { AiSettings } from "../aiSettings";
import { createAnthropicModel } from "./anthropicModel";
import { createOpenRouterModel } from "./openRouterModel";

export const modelFromSettings = (settings: AiSettings): AssistantModel | null => {
  if (settings.unavailableReason !== null || settings.apiKey === null || settings.model === null) return null;
  const options = { apiKey: settings.apiKey, model: settings.model };
  return settings.provider === "openrouter" ? createOpenRouterModel(options) : createAnthropicModel(options);
};
