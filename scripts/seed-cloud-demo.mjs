#!/usr/bin/env node
/** One-time fictional presentation seed for the pinned Spark cloud project. */
import { randomBytes } from "node:crypto";
import { build } from "esbuild";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = "fbla2027-ethanteng";
const ACCOUNT_FILE = join(ROOT, ".cloud-demo-accounts.local");
const BUNDLE_DIR = join(ROOT, "node_modules", ".cache", "fbla-seed");
const require = createRequire(import.meta.url);
const ACCOUNT_UIDS = ["demo-admin", "demo-coordinator", "demo-volunteer", "demo-minor"];

const fail = (message) => {
  console.error(`seed:cloud: ${message}`);
  process.exit(1);
};

const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env.production.local"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
);

if (env.VITE_FIREBASE_PROJECT_ID !== PROJECT_ID) fail(`.env.production.local must target ${PROJECT_ID}.`);
if (env.VITE_USE_EMULATORS !== "false") fail(".env.production.local must have VITE_USE_EMULATORS=false.");
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  fail("Run outside the emulator suite so the seed reaches cloud Firestore and Auth.");
}
if (!process.argv.includes("--yes")) {
  console.log(`seed:cloud: this will create fictional demo users and documents in ${PROJECT_ID}. Re-run with --yes to seed the empty project.`);
  process.exit(0);
}

const { getProjectDefaultAccount } = require(join(ROOT, "node_modules", "firebase-tools", "lib", "auth.js"));
const { getCredentialPathAsync } = require(join(ROOT, "node_modules", "firebase-tools", "lib", "defaultCredentials.js"));
const account = getProjectDefaultAccount(ROOT);
if (!account) fail("No Firebase CLI account is signed in. Run npx firebase login first.");
process.env.GOOGLE_APPLICATION_CREDENTIALS = await getCredentialPathAsync(account);
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) fail("Could not prepare Firebase CLI credentials for the Admin SDK.");

const app = initializeApp({ projectId: PROJECT_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET });
const db = getFirestore(app);
const auth = getAuth(app);
if ((await db.listCollections()).length > 0 || (await auth.listUsers(1)).users.length > 0) {
  fail("Cloud Firestore or Auth already has data. Refusing to overwrite existing presentation data.");
}
if (existsSync(ACCOUNT_FILE)) fail("The private cloud demo account file already exists. Refusing to replace it.");

mkdirSync(BUNDLE_DIR, { recursive: true });
const outfile = join(BUNDLE_DIR, "applyCloudDemoSeed.cjs");
await build({
  entryPoints: [join(ROOT, "functions", "src", "seed", "applyDemoSeed.ts")],
  outfile,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  external: ["firebase-admin", "firebase-admin/*", "firebase-functions", "firebase-functions/*", "pdfkit", "qrcode"],
  logLevel: "warning"
});
const { applyDemoSeed } = require(outfile);
const accountPasswords = Object.fromEntries(ACCOUNT_UIDS.map((uid) => [uid, randomBytes(24).toString("base64url")]));

// Save the passwords before changing cloud state, so an interrupted seed can be repaired.
writeFileSync(ACCOUNT_FILE, JSON.stringify({ projectId: PROJECT_ID, accountPasswords }, null, 2), { flag: "wx", mode: 0o600 });

try {
  const { seed } = await applyDemoSeed({
    db,
    auth,
    storage: getStorage(app),
    bucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    log: console,
    nowMs: Date.now(),
    shiftStartsInMs: 7 * 24 * 60 * 60 * 1000,
    password: "unused-cloud-seed-password",
    accountPasswords,
    appBaseUrl: "http://localhost:5173",
    renderLetterPdf: false
  });
  console.log(`seed:cloud: wrote ${seed.writes.length} fictional documents and ${seed.accounts.length} Auth accounts to ${PROJECT_ID}.`);
  console.log(`seed:cloud: private sign-in credentials are in ${ACCOUNT_FILE} (gitignored).`);
} catch (error) {
  fail(`stopped after saving credentials. Inspect the cloud state before retrying: ${error instanceof Error ? error.message : String(error)}`);
}
