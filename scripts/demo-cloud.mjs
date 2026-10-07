#!/usr/bin/env node
/** Run local callable and file emulators against cloud Auth and Firestore on Spark. */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = "fbla2027-ethanteng";
const envPath = join(ROOT, ".env.production.local");
const accountPath = join(ROOT, ".cloud-demo-accounts.local");

const fail = (message) => {
  console.error(`demo:cloud: ${message}`);
  process.exit(1);
};

if (!existsSync(envPath)) fail(".env.production.local is missing.");
if (!existsSync(accountPath)) fail("Cloud demo accounts are missing. Run npm run seed:cloud -- --yes once.");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
);
if (env.VITE_FIREBASE_PROJECT_ID !== PROJECT_ID || env.VITE_USE_EMULATORS !== "false") {
  fail(`.env.production.local must target ${PROJECT_ID} with VITE_USE_EMULATORS=false.`);
}

const build = spawnSync("node", ["scripts/build-functions.mjs", "--skip-lock"], { cwd: ROOT, stdio: "inherit" });
if (build.status !== 0) fail("Functions build failed.");

console.log(`\ndemo:cloud: browser Auth and Firestore use ${PROJECT_ID}. Trusted actions run on this laptop at localhost:5001; files use the local Storage emulator.\n`);
const child = spawn(
  "npx",
  ["firebase", "emulators:exec", "--project", PROJECT_ID, "--only", "functions,storage", "npm run dev:web -- --mode production"],
  {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      FUNCTIONS_DISCOVERY_TIMEOUT: "60",
      VITE_USE_EMULATORS: "false",
      VITE_FUNCTIONS_EMULATOR: "true",
      VITE_STORAGE_EMULATOR: "true",
      VITE_DEMO_MODE: "false",
      DEMO_MODE: "false",
      STORAGE_BUCKET: env.VITE_FIREBASE_STORAGE_BUCKET,
      APP_BASE_URL: "http://localhost:5173"
    }
  }
);
child.on("error", (error) => fail(error.message));
child.on("exit", (code) => { process.exitCode = code ?? 1; });
