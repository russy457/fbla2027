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
  VITE_TURNSTILE_SITE_KEY: optionalEnvString(),
  VITE_MAPBOX_TOKEN: optionalEnvString(),
  VITE_APPCHECK_SITE_KEY: optionalEnvString(),
  VITE_APPCHECK_DEBUG_TOKEN: optionalEnvString()
});

export type ClientEnv = z.output<typeof clientEnvSchema>;

export type ClientEnvResult = { ok: true; env: ClientEnv } | { ok: false; error: Error };

/** Parses an env record (import.meta.env in the app, a plain object in tests). Throws on failure. */
export const parseClientEnv = (source: EnvRecord): ClientEnv =>
  parseEnv(clientEnvSchema, source, { exampleFile: ".env.example" });

/** Non-throwing variant for UI that wants to show the problem instead of crashing. */
export const readClientEnv = (source: EnvRecord = import.meta.env): ClientEnvResult => {
  try {
    return { ok: true, env: parseClientEnv(source) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
};
