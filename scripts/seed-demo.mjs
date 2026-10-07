#!/usr/bin/env node
/**
 * seed-demo.mjs
 * Seeds the local emulators with the Tier 0 demo (docs/SPEC.md#demo-accounts, X5, E1):
 *   - four accounts with a fixed EMULATOR-ONLY password: admin (custom claim
 *     admin: true), the org owner/coordinator, an adult volunteer (19), and a
 *     minor volunteer (15), all with verified email and complete profiles,
 *   - one verified San Antonio nonprofit (fictional) with its owner,
 *   - one opportunity and one shift instance that starts N minutes from now
 *     (default 10; --shift-starts-in=10m, --shift-starts-in 10, 90s, 1h),
 *     with 3 seats and a confirmed signup for the adult volunteer,
 *   - meta/seed.schemaVersion so demo:reset can tell when to rebuild.
 * Then prints a credentials table and localhost links.
 *
 * Safety: it refuses any project id that does not start with "demo-", and it
 * talks only to emulator hosts (defaults 127.0.0.1:8080 and :9099), so it can
 * never write to a real Firebase project.
 *
 * Usage: node scripts/seed-demo.mjs [--shift-starts-in=10m]
 */
import { randomBytes } from "node:crypto";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-fbla2027";
const SCHEMA_VERSION = 1;
/** Fixed password for emulator accounts only; deployed demo accounts use the DEMO_ACCOUNT_PASSWORD secret. */
const DEMO_PASSWORD = "pitchin-demo-2027";
const APP_URL = "http://localhost:5173";
const EMULATOR_UI_URL = "http://localhost:4000";
const TIME_ZONE = "America/Chicago";
const MINUTE_MS = 60_000;
const SHIFT_LENGTH_MIN = 120;
const WAITLIST_CUTOFF_MIN = 120;
const FINALIZE_AFTER_END_MIN = 30;

const ORG_ID = "alamo-community-pantry";
const OPPORTUNITY_ID = "pantry-sort-and-pack";
const INSTANCE_ID = "demo-shift";

const fail = (problem, fix) => {
  console.error(`seed: ${problem}\nFix: ${fix}`);
  process.exit(1);
};

/** Parses "10", "10m", "90s", or "1h" (minutes when no unit). */
const parseDuration = (raw) => {
  const match = /^(\d+(?:\.\d+)?)(s|m|h)?$/.exec(String(raw).trim());
  if (!match) fail(`could not read --shift-starts-in "${raw}"`, "use minutes like 10, or 10m, 90s, 1h");
  const value = Number(match[1]);
  const unit = match[2] ?? "m";
  return Math.round(value * { s: 1_000, m: MINUTE_MS, h: 60 * MINUTE_MS }[unit]);
};

const readShiftStartsInMs = (argv) => {
  const index = argv.findIndex((arg) => arg === "--shift-starts-in" || arg.startsWith("--shift-starts-in="));
  if (index === -1) return 10 * MINUTE_MS;
  const arg = argv[index];
  return parseDuration(arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[index + 1]);
};

if (!PROJECT_ID.startsWith("demo-")) {
  fail(`refusing to seed project "${PROJECT_ID}"`, "the seed only runs against demo- projects on the emulators");
}
// Point the Admin SDK at the emulators even when run outside emulators:exec.
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
process.env.METADATA_SERVER_DETECTION = "none";

const { initializeApp } = await import("firebase-admin/app");
const { getAuth } = await import("firebase-admin/auth");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");

const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);
const auth = getAuth(app);

const shiftStartsInMs = readShiftStartsInMs(process.argv.slice(2));
const nowMs = Date.now();
const at = (ms) => Timestamp.fromMillis(ms);
const NOW = at(nowMs);

/** A birth date `years` years before today, minus a month so the age is stable all month. */
const birthDateYearsAgo = (years) => {
  const date = new Date(nowMs);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 10);
};

const ACCOUNTS = [
  { uid: "demo-admin", role: "Admin", email: "admin@demo.fbla2027.test", first: "Ada", last: "Admin", years: 30, admin: true },
  { uid: "demo-coordinator", role: "Owner / coordinator", email: "coordinator@demo.fbla2027.test", first: "Olivia", last: "Ortiz", years: 34 },
  { uid: "demo-volunteer", role: "Adult volunteer (19)", email: "volunteer@demo.fbla2027.test", first: "Jordan", last: "Rivera", years: 19 },
  { uid: "demo-minor", role: "Minor volunteer (15)", email: "minor@demo.fbla2027.test", first: "Sam", last: "Lee", years: 15 }
];

const NEW_RELIABILITY = { attended: 0, noShows: 0, lateCancels: 0, total: 0, score: null, isNew: true };
const displayNameOf = (account) => `${account.first} ${account.last.charAt(0)}.`;

const upsertAccount = async (account) => {
  const record = { email: account.email, password: DEMO_PASSWORD, displayName: displayNameOf(account), emailVerified: true };
  try {
    await auth.updateUser(account.uid, record);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    await auth.createUser({ uid: account.uid, ...record });
  }
  await auth.setCustomUserClaims(account.uid, account.admin ? { admin: true } : null);
};

const profileOf = (account) => {
  const birthDate = birthDateYearsAgo(account.years);
  return {
    firstName: account.first,
    lastName: account.last,
    fullName: `${account.first} ${account.last}`,
    email: account.email,
    phone: null,
    birthDate,
    isMinor: account.years < 18,
    interests: ["hunger-food-security"],
    skills: [],
    availability: null,
    zip: "78204",
    homeGeohash: null,
    profileComplete: true,
    profileCompletedAt: NOW,
    turnstileVerifiedAt: null,
    reliability: { ...NEW_RELIABILITY, windowFrom: null },
    createdAt: NOW,
    updatedAt: NOW
  };
};

const publicUserOf = (account) => ({
  displayName: displayNameOf(account),
  avatarPath: null,
  badges: [],
  totalApprovedHours: 0,
  orgsHelpedCount: 0,
  streakWeeks: 0,
  createdAt: NOW,
  updatedAt: NOW
});

const organization = {
  name: "Alamo Community Pantry",
  mission: "We sort, pack, and share donated groceries with San Antonio families every week. (Fictional demo organization.)",
  causeAreas: ["hunger-food-security", "community-development"],
  ein: "74-5550123",
  address: { line1: "418 Mission Commons Dr", city: "San Antonio", state: "TX", zip: "78204" },
  geo: null,
  contactEmail: "hello@alamopantry.demo.fbla2027.test",
  contactPhone: null,
  website: null,
  timeZone: TIME_ZONE,
  photoPaths: [],
  ownerUid: "demo-coordinator",
  verified: true,
  verifiedAt: NOW,
  verifiedBy: "demo-admin",
  hasActivity: true,
  archived: false,
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW
};

const startMs = nowMs + shiftStartsInMs;
const endMs = startMs + SHIFT_LENGTH_MIN * MINUTE_MS;
const cutoffMs = startMs - WAITLIST_CUTOFF_MIN * MINUTE_MS;
const finalizeMs = endMs + FINALIZE_AFTER_END_MIN * MINUTE_MS;

const instance = {
  orgId: ORG_ID,
  opportunityId: OPPORTUNITY_ID,
  seriesId: null,
  title: "Sort and pack food boxes",
  orgName: organization.name,
  orgVerified: true,
  minAge: 13,
  timeZone: TIME_ZONE,
  start: at(startMs),
  end: at(endMs),
  capacity: 3,
  signupCount: 1,
  waitlist: [],
  waitlistSeq: 0,
  checkedInCount: 0,
  status: "scheduled",
  cutoffAt: at(cutoffMs),
  finalizeAt: at(finalizeMs),
  cutoffDoneAt: null,
  finalizedAt: null,
  nextActionAt: at(cutoffMs),
  sequence: 0,
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
  createdAt: NOW,
  updatedAt: NOW
};

const volunteer = ACCOUNTS[2];
const signupId = `${INSTANCE_ID}_${volunteer.uid}`;

const seedFirestore = async () => {
  const batch = db.batch();
  for (const account of ACCOUNTS) {
    batch.set(db.doc(`users/${account.uid}`), publicUserOf(account));
    batch.set(db.doc(`users/${account.uid}/private/profile`), profileOf(account));
  }
  batch.set(db.doc(`organizations/${ORG_ID}`), organization);
  batch.set(db.doc(`organizations/${ORG_ID}/members/demo-coordinator`), {
    uid: "demo-coordinator",
    orgId: ORG_ID,
    role: "owner",
    displayName: "Olivia O.",
    canViewContacts: true,
    invitedBy: null,
    joinedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW
  });
  batch.set(db.doc(`opportunities/${OPPORTUNITY_ID}`), {
    orgId: ORG_ID,
    orgName: organization.name,
    orgVerified: true,
    title: "Sort and pack food boxes",
    description: "Help sort donated groceries and pack family food boxes. Closed-toe shoes, please.",
    causeArea: "hunger-food-security",
    type: "one-time",
    skills: [],
    minAge: 13,
    location: { address: organization.address, geo: null },
    seriesId: null,
    status: "active",
    nextInstanceStart: at(startMs),
    createdBy: "demo-coordinator",
    createdAt: NOW,
    updatedAt: NOW
  });
  batch.set(db.doc(`instances/${INSTANCE_ID}`), instance);
  batch.set(db.doc(`instanceSecrets/${INSTANCE_ID}`), { salt: randomBytes(32).toString("base64"), keyVersion: 1, createdAt: NOW, updatedAt: NOW });
  batch.set(db.doc(`signups/${signupId}`), {
    instanceId: INSTANCE_ID,
    opportunityId: OPPORTUNITY_ID,
    orgId: ORG_ID,
    uid: volunteer.uid,
    displayName: displayNameOf(volunteer),
    instanceStart: instance.start,
    instanceEnd: instance.end,
    status: "confirmed",
    waitlistSeq: null,
    walkUp: false,
    promotedAt: null,
    lateCancel: false,
    cancelReason: null,
    cancelledAt: null,
    checkInAt: null,
    checkOutAt: null,
    autoCompleted: false,
    excuseReason: null,
    attendance: null,
    disputeOpen: false,
    dispute: null,
    history: [{ from: null, to: "confirmed", actor: volunteer.uid, op: "signup", at: NOW }],
    createdAt: NOW,
    updatedAt: NOW
  });
  batch.set(db.doc(`signupContacts/${signupId}`), {
    orgId: ORG_ID,
    instanceId: INSTANCE_ID,
    uid: volunteer.uid,
    hidden: false,
    fullName: `${volunteer.first} ${volunteer.last}`,
    email: volunteer.email,
    phone: null,
    isMinor: false,
    reliability: NEW_RELIABILITY,
    frozen: false,
    refreshedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW
  });
  batch.set(db.doc("demoClock/global"), { offsetMs: 0, setBy: "seed", setAt: NOW });
  batch.set(db.doc("meta/seed"), { schemaVersion: SCHEMA_VERSION, seededAt: NOW, shiftStartsAt: at(startMs) });
  await batch.commit();
};

const printSummary = () => {
  const startLabel = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(startMs);
  const rows = ACCOUNTS.map((account) => [account.role, account.email, DEMO_PASSWORD]);
  const widths = [0, 1, 2].map((column) => Math.max(...[["Role", "Email", "Password"], ...rows].map((row) => row[column].length)));
  const line = (cells) => `  ${cells.map((cell, column) => cell.padEnd(widths[column])).join("   ")}`;
  console.log(`
seed: demo data ready in project ${PROJECT_ID} (emulators only; password works nowhere else).

${line(["Role", "Email", "Password"])}
${line(widths.map((width) => "-".repeat(width)))}
${rows.map(line).join("\n")}

  Shift "Sort and pack food boxes" starts at ${startLabel} (in ${Math.round(shiftStartsInMs / MINUTE_MS)} min), 3 seats, Jordan already signed up.

  App               ${APP_URL}
  Explore           ${APP_URL}/explore
  Shift page        ${APP_URL}/opportunity/${INSTANCE_ID}
  Coordinator       ${APP_URL}/org/${ORG_ID}/dashboard
  Kiosk             ${APP_URL}/org/${ORG_ID}/kiosk/${INSTANCE_ID}
  Emulator UI       ${EMULATOR_UI_URL}
`);
};

try {
  for (const account of ACCOUNTS) await upsertAccount(account);
  await seedFirestore();
  printSummary();
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(`could not write demo data (${message})`, "start the emulators first: npm run demo (or npm run emulators), then run npm run seed:demo");
}
