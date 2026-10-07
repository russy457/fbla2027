/**
 * playwright.config.ts
 * End-to-end tests in e2e/. Starts the Vite dev server with the values from
 * .env.example (so CI needs no .env.local) and runs Chromium. Emulators are not
 * required for the smoke test; Tier 0 specs will start them via npm run demo.
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
    command: `npm run dev -- --port ${E2E_PORT} --strictPort`,
    url: E2E_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...readExampleEnv() }
  }
});
