#!/usr/bin/env node
/** Add future shifts to the existing fictional cloud demo without resetting its history. */
import { build } from "esbuild";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { planOpenShifts } from "./open-shift-plan.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = "fbla2027-ethanteng";
const require = createRequire(import.meta.url);
const envPath = join(ROOT, ".env.production.local");

const fail = (message) => {
  console.error(`populate: ${message}`);
  process.exit(1);
};

if (!existsSync(envPath)) fail(".env.production.local is missing.");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8").split(/\r?\n/).filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
);
if (env.VITE_FIREBASE_PROJECT_ID !== PROJECT_ID || env.VITE_USE_EMULATORS !== "false") fail(`Cloud config must target ${PROJECT_ID} without emulators.`);
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) fail("Run outside the emulator suite.");

const { getProjectDefaultAccount } = require(join(ROOT, "node_modules", "firebase-tools", "lib", "auth.js"));
const { getCredentialPathAsync } = require(join(ROOT, "node_modules", "firebase-tools", "lib", "defaultCredentials.js"));
const account = getProjectDefaultAccount(ROOT);
if (!account) fail("Sign in to the Firebase CLI first.");
process.env.GOOGLE_APPLICATION_CREDENTIALS = await getCredentialPathAsync(account);
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) fail("Could not prepare Firebase CLI credentials.");

const bundleDir = join(ROOT, "node_modules", ".cache", "fbla-seed");
mkdirSync(bundleDir, { recursive: true });
const outfile = join(bundleDir, "open-shift-records.cjs");
await build({
  entryPoints: [join(ROOT, "scripts", "open-shift-records.ts")], outfile, bundle: true,
  platform: "node", target: "node22", format: "cjs", external: ["firebase-admin", "firebase-admin/*"], logLevel: "warning"
});
const { DEFAULT_CONFIG, instanceDocSchema, newInstanceDoc, newInstanceSecret, refreshNextInstanceStart } = require(outfile);
const nowMs = Date.now();
const db = getFirestore(initializeApp({ projectId: PROJECT_ID }));
const plan = planOpenShifts(nowMs);
const opportunityIds = [...new Set(plan.map((shift) => shift.opportunityId))];
const opportunities = new Map();
const organizations = new Map();
for (const id of opportunityIds) {
  const opportunity = (await db.collection("opportunities").doc(id).get()).data();
  if (!opportunity || opportunity.status !== "active") fail(`Active opportunity ${id} is missing.`);
  opportunities.set(id, opportunity);
  if (!organizations.has(opportunity.orgId)) {
    const org = (await db.collection("organizations").doc(opportunity.orgId).get()).data();
    if (!org || org.archived) fail(`Active organization ${opportunity.orgId} is missing.`);
    organizations.set(opportunity.orgId, org);
  }
}

const existing = await db.getAll(...plan.map((shift) => db.collection("instances").doc(shift.id)));
const missing = plan.filter((shift, index) => !existing[index].exists);
console.log(`populate: ${plan.length} planned dates; ${missing.length} new, ${plan.length - missing.length} already present.`);
for (const shift of missing) console.log(`  ${new Date(shift.startMs).toISOString()}  ${opportunities.get(shift.opportunityId).title}`);
if (!process.argv.includes("--yes")) {
  console.log("populate: dry run. Pass --yes to create the missing shifts.");
  process.exit(0);
}

let created = 0;
for (const shift of missing) {
  const opportunity = opportunities.get(shift.opportunityId);
  const org = organizations.get(opportunity.orgId);
  const instance = instanceDocSchema.parse(newInstanceDoc({
    opportunityId: shift.opportunityId, opportunity, org, seriesId: null,
    times: { startMs: shift.startMs, endMs: shift.endMs }, capacity: shift.capacity,
    config: DEFAULT_CONFIG, nowMs
  }));
  const instanceRef = db.collection("instances").doc(shift.id);
  const didCreate = await db.runTransaction(async (tx) => {
    if ((await tx.get(instanceRef)).exists) return false;
    tx.create(instanceRef, instance);
    tx.create(db.collection("instanceSecrets").doc(shift.id), newInstanceSecret(nowMs));
    return true;
  });
  if (didCreate) created++;
}
for (const id of opportunityIds) await refreshNextInstanceStart(db, id, nowMs);
console.log(`populate: created ${created} signup-ready shifts; refreshed ${opportunityIds.length} opportunity schedules.`);
