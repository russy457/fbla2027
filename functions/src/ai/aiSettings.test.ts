/**
 * aiSettings.test.ts
 * AI configuration (SPEC 8.4, 10.6): off by default (emulator and tests use
 * the fallback), provider and model configurable, and a missing key or model
 * is reported instead of calling the provider.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_AI_TIMEOUT_MS, readAiSettings, secretNameFor } from "./aiSettings";
import { modelFromSettings } from "./providers";

describe("readAiSettings", () => {
  it("is off by default with the SPEC provider and timeout", () => {
    const settings = readAiSettings({});
    expect(settings).toMatchObject({ provider: "anthropic", model: "claude-opus-5", apiKey: null, timeoutMs: DEFAULT_AI_TIMEOUT_MS, unavailableReason: "disabled" });
    expect(modelFromSettings(settings)).toBeNull();
  });

  it("enables the anthropic provider when the key is present", () => {
    const settings = readAiSettings({ AI_ENABLED: "true", ANTHROPIC_API_KEY: "k", AI_MODEL: "claude-sonnet-5" });
    expect(settings).toMatchObject({ provider: "anthropic", model: "claude-sonnet-5", apiKey: "k", unavailableReason: null });
    expect(modelFromSettings(settings)?.name).toBe("anthropic:claude-sonnet-5");
  });

  it("reports a missing key, a missing OpenRouter model, and an unknown provider", () => {
    expect(readAiSettings({ AI_ENABLED: "true" }).unavailableReason).toBe("missing-key");
    expect(readAiSettings({ AI_ENABLED: "true", AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "k" }).unavailableReason).toBe("missing-model");
    expect(readAiSettings({ AI_ENABLED: "true", AI_PROVIDER: "gemini", ANTHROPIC_API_KEY: "k" }).unavailableReason).toBe("unknown-provider");
  });

  it("builds the OpenRouter model when configured", () => {
    const settings = readAiSettings({ AI_ENABLED: "true", AI_PROVIDER: "OpenRouter", OPENROUTER_API_KEY: "k", AI_MODEL: "vendor/model" });
    expect(modelFromSettings(settings)?.name).toBe("openrouter:vendor/model");
    expect(secretNameFor(settings.provider)).toBe("OPENROUTER_API_KEY");
    expect(secretNameFor("anthropic")).toBe("ANTHROPIC_API_KEY");
  });

  it("clamps the timeout and ignores garbage", () => {
    expect(readAiSettings({ AI_TIMEOUT_MS: "50" }).timeoutMs).toBe(1_000);
    expect(readAiSettings({ AI_TIMEOUT_MS: "999999" }).timeoutMs).toBe(25_000);
    expect(readAiSettings({ AI_TIMEOUT_MS: "soon" }).timeoutMs).toBe(DEFAULT_AI_TIMEOUT_MS);
  });
});
