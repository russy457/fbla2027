#!/usr/bin/env node
/**
 * demo.mjs
 * One command to see the app running locally (docs/SPEC.md#demo):
 *   1. runs npm run doctor and stops on a blocking failure (Node, Java, ports),
 *   2. builds the Functions bundle without a deploy lockfile, so this local
 *      run does not need registry access after dependencies are installed,
 *   3. starts the Auth, Firestore, Functions, and Storage emulators for the
 *      "demo-fbla2027" project (no real Firebase project is touched), and
 *      inside them runs the seed (shift starts in 10 minutes) and then Vite,
 *   4. prints localhost links for separate browser profiles on one laptop.
 * Functions on the emulator default to DEMO_MODE on, Turnstile off, and an
 * emulator-only kiosk secret (functions/src/lib/env.ts), so no secret file is needed.
 * Ctrl+C stops everything (firebase emulators:exec shuts the emulators down).
 * FUNCTIONS_DISCOVERY_TIMEOUT=60 is passed in the child environment (no
 * inline VAR=x, so it works on Windows too), as test:e2e:tier0 does: a cold
 * Functions bundle can take longer than the default 10 s to load on first run.
 *
 * Usage: npm run demo [-- --shift-starts-in=10m]
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = "demo-fbla2027";
const APP_URL = "http://localhost:5173";
const EMULATOR_UI_URL = "http://localhost:4000";
/** Seconds the Functions emulator waits to discover exports (default 10 is too short on a cold Windows disk). */
const FUNCTIONS_DISCOVERY_TIMEOUT_SEC = "60";

/** Only a duration like 10, 10m, 90s, or 1h is forwarded, so nothing else reaches the shell. */
const shiftArg = process.argv.slice(2).find((arg) => /^--shift-starts-in=\d+(\.\d+)?[smh]?$/.test(arg)) ?? "--shift-starts-in=10m";

const run = (command, failure) => {
  // Fixed command strings only (no user input), so running them through the shell is safe on every OS.
  const result = spawnSync(command, { cwd: ROOT, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(`demo: ${failure}`);
    process.exit(result.status ?? 1);
  }
};

if (!existsSync(join(ROOT, ".env.local"))) {
  console.warn("demo: .env.local not found. Copy .env.example to .env.local (its values work locally with zero edits).");
}

run("npm run doctor", "doctor found a blocking problem (see Fix lines above). Resolve it, then run npm run demo again.");
run("node scripts/build-functions.mjs --skip-lock", "the Functions build failed. Fix the error above, then run npm run demo again.");

console.log(`
demo: starting emulators for ${PROJECT_ID}. The seed prints demo accounts and links; Vite starts after it.
  App          ${APP_URL}
  Emulator UI  ${EMULATOR_UI_URL}
`);

const inner = `node scripts/seed-demo.mjs ${shiftArg} && npm run dev:web`;
const child = spawn(`npx firebase emulators:exec --ui --project ${PROJECT_ID} --only auth,firestore,functions,storage "${inner}"`, {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: FUNCTIONS_DISCOVERY_TIMEOUT_SEC }
});

child.on("exit", (code) => process.exit(code ?? 0));
