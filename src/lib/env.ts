/**
 * env.ts
 * Typed, validated access to the web app's VITE_* environment variables
 * (plan X4). .env.example ships working emulator defaults, so a fresh clone
 * only needs to copy it to .env.local. Missing values produce one clear error
 * naming each variable instead of a cryptic Firebase SDK failure.
 */
import { z } from "zod";
import { envFlag, optionalEnvString, parseEnv, type EnvRecord } from "@fbla/shared";

const required = () => z.string().trim().min(1);

export const clientEnvSchema = z.object({
  VITE_FIREBASE_API_KEY: required(),
  VITE_FIREBASE_AUTH_DOMAIN: required(),
  VITE_FIREBASE_PROJECT_ID: required(),
  VITE_FIREBASE_STORAGE_BUCKET: required(),
  VITE_FIREBASE_APP_ID: required(),
  VITE_USE_EMULATORS: envFlag(),
  /** Presentation mode: cloud Auth/Firestore with a local callable server and file emulator. */
  VITE_FUNCTIONS_EMULATOR: envFlag(),
  VITE_STORAGE_EMULATOR: envFlag(),
  /** Demo controls ("Sign in as...", Advance clock, Run due jobs). Unset means: on when using emulators. */
  VITE_DEMO_MODE: z.enum(["true", "false"]).optional(),
  VITE_TURNSTILE_SITE_KEY: optionalEnvString(),
  /** Mirrors the deployed Functions setting when the external human-check provider is unavailable. */
  VITE_TURNSTILE_ENABLED: z.enum(["true", "false"]).optional(),
  VITE_MAPBOX_TOKEN: optionalEnvString(),
  VITE_APPCHECK_SITE_KEY: optionalEnvString(),
  VITE_APPCHECK_DEBUG_TOKEN: optionalEnvString()
});

export type ClientEnv = z.output<typeof clientEnvSchema>;

export type ClientEnvResult = { ok: true; env: ClientEnv } | { ok: false; error: Error };

/** Parses an env record (import.meta.env in the app, a plain object in tests). Throws on failure. */
export const parseClientEnv = (source: EnvRecord): ClientEnv =>
  parseEnv(clientEnvSchema, source, { exampleFile: ".env.example" });

/**
 * True when demo-only UI may render (SPEC#clock, X5, X12). An explicit
 * VITE_DEMO_MODE wins; otherwise demo mode follows VITE_USE_EMULATORS, so a
 * local run shows the controls and a deployed build hides them by default.
 */
export const isDemoModeEnv = (env: ClientEnv): boolean =>
  env.VITE_DEMO_MODE === undefined ? env.VITE_USE_EMULATORS : env.VITE_DEMO_MODE === "true";

/** Non-throwing variant for UI that wants to show the problem instead of crashing. */
export const readClientEnv = (source: EnvRecord = import.meta.env): ClientEnvResult => {
  try {
    return { ok: true, env: parseClientEnv(source) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
};
