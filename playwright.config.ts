/**
 * playwright.config.ts
 * End-to-end tests in e2e/. Starts the Vite dev server with the values from
 * .env.example (so CI needs no .env.local) and runs Chromium. Emulators are not
 * required for the smoke test. The Tier 0 gate (e2e/tier0.spec.ts) needs them:
 * `npm run test:e2e:tier0` wraps seed + this runner in firebase emulators:exec,
 * and the spec skips itself when FIRESTORE_EMULATOR_HOST is not set.
 * E2E uses its own port (5174, override with E2E_PORT) and never reuses a
 * running server, so it cannot accidentally test another app on 5173.
 */
import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = Number(process.env.E2E_PORT ?? 5174);
const E2E_URL = `http://localhost:${E2E_PORT}`;

/** Reads KEY=value lines from .env.example, ignoring comments and blanks. */
const readExampleEnv = (): Record<string, string> =>
  Object.fromEntries(
    readFileSync(new URL("./.env.example", import.meta.url), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      })
  );

/** "127.0.0.1:18080" -> "18080"; undefined when the variable is not set. */
const portOf = (hostAndPort: string | undefined): string | undefined => hostAndPort?.split(":").pop();

/**
 * Inside `firebase emulators:exec` (npm run test:e2e:tier0) the emulators may
 * run on non-default ports (firebase.e2e.json). Firebase exports where each
 * one listens; the app is told the same ports through VITE_EMULATOR_*_PORT.
 * Outside the emulators this is empty and the app uses the defaults.
 */
const emulatorPortEnv = (): Record<string, string> =>
  Object.fromEntries(
    [
      ["VITE_EMULATOR_AUTH_PORT", portOf(process.env.FIREBASE_AUTH_EMULATOR_HOST)],
      ["VITE_EMULATOR_FIRESTORE_PORT", portOf(process.env.FIRESTORE_EMULATOR_HOST)],
      ["VITE_EMULATOR_STORAGE_PORT", portOf(process.env.FIREBASE_STORAGE_EMULATOR_HOST)],
      ["VITE_EMULATOR_FUNCTIONS_PORT", process.env.E2E_FUNCTIONS_PORT]
    ].filter((pair): pair is [string, string] => typeof pair[1] === "string" && pair[1].length > 0)
  );

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_URL,
    trace: "on-first-retry"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev:web -- --port ${E2E_PORT} --strictPort`,
    url: E2E_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...readExampleEnv(), ...emulatorPortEnv() }
  }
});
