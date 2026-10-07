/**
 * secrets.ts
 * Declares Functions secrets (SPEC#env: KIOSK_MASTER_SECRET, TURNSTILE_SECRET)
 * for deployed endpoints only. On the emulator the values come from defaults
 * in lib/env.ts, so a fresh clone runs without a .secret.local file.
 * FUNCTIONS_EMULATOR is set by the emulator during discovery and at runtime.
 */
import { defineSecret } from "firebase-functions/params";

export type SecretName =
  | "KIOSK_MASTER_SECRET"
  | "TURNSTILE_SECRET"
  // Tier 1 lane C: AI provider keys (ai endpoint) and the deployed demo account password (admin.resetDemoData).
  | "ANTHROPIC_API_KEY"
  | "OPENROUTER_API_KEY"
  | "DEMO_ACCOUNT_PASSWORD";

export const deploySecrets = (...names: SecretName[]) =>
  process.env.FUNCTIONS_EMULATOR === "true" ? [] : names.map((name) => defineSecret(name));
