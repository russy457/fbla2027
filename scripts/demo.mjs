#!/usr/bin/env node
/**
 * demo.mjs
 * One command to see the app running locally (docs/SPEC.md#demo):
 *   0. runs npm run doctor and stops on a blocking failure (Node, Java, ports),
 *   1. builds the Functions bundle (functions-dist/),
 *   2. starts the Auth, Firestore, Functions, and Storage emulators for the
 *      "demo-fbla2027" project (no real Firebase project is touched),
 *   3. inside the emulators, runs the seed and the Vite dev server together
 *      (concurrently),
 *   4. prints localhost links only (no LAN URL or QR; phones use the deployed site).
 * Ctrl+C stops everything (firebase emulators:exec shuts the emulators down).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = "demo-fbla2027";
const APP_URL = "http://localhost:5173";
const EMULATOR_UI_URL = "http://localhost:4000";

if (!existsSync(join(ROOT, ".env.local"))) {
  console.warn("demo: .env.local not found. Using defaults is fine, but copy .env.example to .env.local to silence this.");
}

const doctor = spawnSync("npm run doctor", { cwd: ROOT, stdio: "inherit", shell: true });
if (doctor.status !== 0) {
  console.error("demo: doctor found a blocking problem (see Fix lines above). Resolve it, then run npm run demo again.");
  process.exit(doctor.status ?? 1);
}

const build = spawnSync("npm run build:functions", { cwd: ROOT, stdio: "inherit", shell: true });
if (build.status !== 0) {
  console.error("demo: the Functions build failed. Fix the error above, then run npm run demo again.");
  process.exit(build.status ?? 1);
}

console.log(`
demo: starting emulators. When Vite is ready, open:
  App            ${APP_URL}
  Coordinator    ${APP_URL}/org/demo-org/dashboard
  Kiosk          ${APP_URL}/org/demo-org/kiosk/demo-shift
  Emulator UI    ${EMULATOR_UI_URL}
(Demo accounts are printed by the seed step once Tier 0 adds them.)
`);

const inner = 'concurrently --names seed,web --prefix-colors gray,blue \\"node scripts/seed-demo.mjs\\" \\"npm run dev\\"';
// Fixed command strings only (no user input), so passing them through the shell is safe.
const child = spawn(
  `npx firebase emulators:exec --project ${PROJECT_ID} --only auth,firestore,functions,storage "${inner}"`,
  { cwd: ROOT, stdio: "inherit", shell: true }
);

child.on("exit", (code) => process.exit(code ?? 0));
