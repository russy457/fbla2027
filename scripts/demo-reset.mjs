#!/usr/bin/env node
/**
 * demo-reset.mjs
 * Clears the running emulators and reseeds (docs/SPEC.md#scripts, X18). Use
 * it while `npm run demo` is running in another terminal, for example after a
 * rehearsal or when meta/seed.schemaVersion changed:
 *   1. deletes every Firestore document and every Auth account in the
 *      demo-fbla2027 emulators (their REST reset endpoints; nothing real is touched),
 *   2. runs scripts/seed-demo.mjs again (extra args such as
 *      --shift-starts-in=10m are passed through).
 * Storage files (letter PDFs) are left in place; new letters get new paths.
 * The child gets FUNCTIONS_DISCOVERY_TIMEOUT=60 like npm run demo, so any
 * emulator process it starts uses the same discovery timeout on every OS.
 *
 * Usage: npm run demo:reset [-- --shift-starts-in=10m]
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = "demo-fbla2027";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FUNCTIONS_DISCOVERY_TIMEOUT_SEC = "60";

const clear = async (label, url) => {
  try {
    const response = await fetch(url, { method: "DELETE" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`demo:reset: cleared ${label}`);
  } catch (error) {
    console.error(`demo:reset: could not clear ${label} (${error instanceof Error ? error.message : String(error)}).`);
    console.error("Fix: start the emulators first with npm run demo, then run npm run demo:reset in a second terminal.");
    process.exit(1);
  }
};

await clear("Firestore", `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`);
await clear("Auth accounts", `http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`);

const passThrough = process.argv.slice(2).filter((arg) => /^--shift-starts-in(=\d+(\.\d+)?[smh]?)?$|^\d+(\.\d+)?[smh]?$/.test(arg));
const seed = spawnSync(process.execPath, [join(ROOT, "scripts", "seed-demo.mjs"), ...passThrough], {
  cwd: ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    FIRESTORE_EMULATOR_HOST: FIRESTORE_HOST,
    FIREBASE_AUTH_EMULATOR_HOST: AUTH_HOST,
    GCLOUD_PROJECT: PROJECT_ID,
    FUNCTIONS_DISCOVERY_TIMEOUT: FUNCTIONS_DISCOVERY_TIMEOUT_SEC
  }
});
process.exit(seed.status ?? 1);
