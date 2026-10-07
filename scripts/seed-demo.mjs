#!/usr/bin/env node
/**
 * seed-demo.mjs
 * Seeds the local emulators with the demo described in docs/SPEC.md#demo-accounts
 * (10.7, X5, E1). The seed itself lives in functions/src/seed/ (TypeScript,
 * typed by the shared schemas and unit-tested); this wrapper only:
 *   1. reads --shift-starts-in (default 10 minutes; 10, 10m, 90s, 1h),
 *   2. refuses any project that is not a demo- project and points the Admin
 *      SDK at the emulator hosts, so it can never write to a real project,
 *   3. bundles functions/src/seed/runDemoSeed.ts with esbuild (the same way
 *      the Functions build bundles @fbla/shared) and runs it,
 *   4. prints the credentials table and localhost links it returns.
 *
 * Usage: node scripts/seed-demo.mjs [--shift-starts-in=10m]
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-fbla2027";
/** Fixed password for emulator accounts only; deployed demo accounts use the DEMO_ACCOUNT_PASSWORD secret. */
const DEMO_PASSWORD = "fbla2027-demo-2027";
const APP_URL = "http://localhost:5173";
const EMULATOR_UI_URL = "http://localhost:4000";
const MINUTE_MS = 60_000;
const DEFAULT_SHIFT_STARTS_IN_MIN = 10;
// Inside node_modules so the bundle resolves firebase-admin, pdfkit, and qrcode from the repo's installed packages.
const BUNDLE_DIR = join(ROOT, "node_modules", ".cache", "fbla-seed");
const RUNTIME_PACKAGES = ["firebase-admin", "firebase-functions", "pdfkit", "qrcode"];

const fail = (problem, fix) => {
  console.error(`seed: ${problem}\nFix: ${fix}`);
  process.exit(1);
};

/** Parses "10", "10m", "90s", or "1h" (minutes when no unit). */
const parseDuration = (raw) => {
  const match = /^(\d+(?:\.\d+)?)(s|m|h)?$/.exec(String(raw ?? "").trim());
  if (!match) fail(`could not read --shift-starts-in "${raw}"`, "use minutes like 10, or 10m, 90s, 1h");
  const unitMs = { s: 1_000, m: MINUTE_MS, h: 60 * MINUTE_MS }[match[2] ?? "m"];
  return Math.round(Number(match[1]) * unitMs);
};

const readShiftStartsInMs = (argv) => {
  const index = argv.findIndex((arg) => arg === "--shift-starts-in" || arg.startsWith("--shift-starts-in="));
  if (index === -1) return DEFAULT_SHIFT_STARTS_IN_MIN * MINUTE_MS;
  const arg = argv[index];
  return parseDuration(arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[index + 1]);
};

/** Bundles the TypeScript seed (and @fbla/shared) into one CommonJS file and loads it. */
const loadSeedModule = async () => {
  mkdirSync(BUNDLE_DIR, { recursive: true });
  const outfile = join(BUNDLE_DIR, "runDemoSeed.cjs");
  await build({
    entryPoints: [join(ROOT, "functions", "src", "seed", "runDemoSeed.ts")],
    outfile,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    external: RUNTIME_PACKAGES.flatMap((name) => [name, `${name}/*`]),
    logLevel: "warning"
  });
  return createRequire(import.meta.url)(outfile);
};

if (!PROJECT_ID.startsWith("demo-")) {
  fail(`refusing to seed project "${PROJECT_ID}"`, "the seed only runs against demo- projects on the emulators");
}
// Point the Admin SDK at the emulators even when run outside emulators:exec.
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= "127.0.0.1:9199";
process.env.METADATA_SERVER_DETECTION = "none";

const shiftStartsInMs = readShiftStartsInMs(process.argv.slice(2));

try {
  const { runDemoSeed } = await loadSeedModule();
  const summary = await runDemoSeed({
    projectId: PROJECT_ID,
    nowMs: Date.now(),
    shiftStartsInMs,
    password: DEMO_PASSWORD,
    appUrl: APP_URL,
    emulatorUiUrl: EMULATOR_UI_URL
  });
  console.log(`\n${summary}`);
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(`could not write demo data (${message})`, "start the emulators first: npm run demo (or npm run emulators), then run npm run seed:demo");
}
