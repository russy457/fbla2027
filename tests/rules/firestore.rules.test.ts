/**
 * firestore.rules.test.ts
 * Firestore security rules tests (SPEC#rules-matrix, SPEC#tests 12.1). Every
 * Tier 0 row gets allowed and denied cases, including the private profile
 * allowlist (extra key, isMinor, birthDate), client writes of server-owned
 * counters, and kiosk tokens reading another instance or contact data.
 * Run with `npm run test:rules` (Firestore + Storage emulators).
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, type Firestore } from "firebase/firestore";

const PROJECT_ID = "demo-fbla2027";
const HOUR_MS = 3_600_000;

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8") }
  });
});

afterAll(async () => {
  await env.cleanup();
});

/** Writes a doc with rules disabled, the way Functions and the seed do. */
const seed = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), path), data));

// rules-unit-testing bundles its own copy of the web SDK types; the instances are the same at runtime.
const as = (uid: string, claims: Record<string, unknown> = {}): Firestore =>
  env.authenticatedContext(uid, claims).firestore() as unknown as Firestore;
const anon = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;
const kiosk = (instanceId: string, expMs = Date.now() + HOUR_MS): Firestore =>
  as(`kiosk_${instanceId}_abcd1234`, { kioskInstanceId: instanceId, kioskOrgId: "orgA", kioskExp: expMs });

beforeEach(async () => {
  await env.clearFirestore();
  await seed("organizations/orgA", { name: "Alamo Community Pantry", verified: true });
  await seed("organizations/orgB", { name: "Other Org", verified: true });
  await seed("organizations/orgA/members/coordA", { uid: "coordA", orgId: "orgA", role: "owner", canViewContacts: true });
  await seed("organizations/orgA/members/minorCoord", { uid: "minorCoord", orgId: "orgA", role: "coordinator", canViewContacts: false });
  await seed("organizations/orgB/members/coordB", { uid: "coordB", orgId: "orgB", role: "owner", canViewContacts: true });
  await seed("organizations/orgA/letterRefs/letter1", { letterId: "letter1", uid: "vol1", minutesForOrg: 120, status: "valid" });
  await seed("opportunities/opp1", { orgId: "orgA", title: "Sort food" });
  await seed("instances/inst1", { orgId: "orgA", title: "Sort food", signupCount: 1, capacity: 3 });
  await seed("instances/inst2", { orgId: "orgA", title: "Other shift", signupCount: 0, capacity: 3 });
  await seed("instanceSecrets/inst1", { salt: "c2FsdA==", keyVersion: 1 });
  await seed("signups/inst1_vol1", { instanceId: "inst1", orgId: "orgA", uid: "vol1", displayName: "Jordan R.", status: "confirmed" });
  await seed("signups/inst2_vol2", { instanceId: "inst2", orgId: "orgA", uid: "vol2", displayName: "Sam L.", status: "confirmed" });
  await seed("signupContacts/inst1_vol1", { instanceId: "inst1", orgId: "orgA", uid: "vol1", hidden: false, fullName: "Jordan Rivera", email: "j@example.test" });
  await seed("hoursLogs/inst1_vol1", { uid: "vol1", orgId: "orgA", minutes: 120, status: "approved" });
  await seed("letters/letter1", { uid: "vol1", verifyCode: "CODE1", status: "valid" });
  await seed("letterVerifications/CODE1", { displayName: "Jordan R.", totalMinutes: 120, status: "valid" });
  await seed("users/vol1", { displayName: "Jordan R.", totalApprovedHours: 2 });
  await seed("users/vol1/private/profile", { firstName: "Jordan", birthDate: "2007-01-01", isMinor: false, textSize: 100 });
  await seed("jobRuns/run1", { outcome: "ok" });
  await seed("demoClock/global", { offsetMs: 0 });
  await seed("rateLimits/vol1_checkin", { count: 1 });
  await seed("jobLeases/runDueJobs", { holder: "x" });
  await seed("contactRefreshJobs/orgA", { orgId: "orgA", token: "t" });
});

describe("organizations, opportunities, instances (public catalog)", () => {
  it("anyone can read", async () => {
    await assertSucceeds(getDoc(doc(anon(), "organizations/orgA")));
    await assertSucceeds(getDoc(doc(anon(), "opportunities/opp1")));
    await assertSucceeds(getDoc(doc(anon(), "instances/inst1")));
  });

  it("no client can write, including the org owner and counters", async () => {
    await assertFails(setDoc(doc(as("coordA"), "organizations/orgA"), { name: "Renamed", verified: true }));
    await assertFails(setDoc(doc(as("coordA"), "organizations/new"), { name: "Mine" }));
    await assertFails(deleteDoc(doc(as("coordA"), "organizations/orgA")));
    await assertFails(setDoc(doc(as("coordA"), "opportunities/opp2"), { orgId: "orgA" }));
    await assertFails(updateDoc(doc(as("vol1"), "instances/inst1"), { signupCount: 0 }));
    await assertFails(updateDoc(doc(as("coordA"), "instances/inst1"), { capacity: 99 }));
  });
});

describe("organizations/{id}/members", () => {
  it("members of the org and the member themself can read", async () => {
    await assertSucceeds(getDoc(doc(as("coordA"), "organizations/orgA/members/minorCoord")));
    await assertSucceeds(getDoc(doc(as("minorCoord"), "organizations/orgA/members/minorCoord")));
  });

  it("other orgs, volunteers, and kiosks cannot read; nobody writes", async () => {
    await assertFails(getDoc(doc(as("coordB"), "organizations/orgA/members/coordA")));
    await assertFails(getDoc(doc(as("vol1"), "organizations/orgA/members/coordA")));
    await assertFails(getDoc(doc(kiosk("inst1"), "organizations/orgA/members/coordA")));
    await assertFails(setDoc(doc(as("vol1"), "organizations/orgA/members/vol1"), { role: "owner", canViewContacts: true }));
  });
});

describe("collection group members (org switcher, SPEC Q27)", () => {
  const membersOf = (db: Firestore, uid: string) =>
    getDocs(query(collectionGroup(db, "members"), where("uid", "==", uid)));

  it("a signed-in user can query their own memberships across orgs", async () => {
    await assertSucceeds(membersOf(as("coordA"), "coordA"));
    await assertSucceeds(membersOf(as("vol1"), "vol1"));
  });

  it("querying another user's memberships, unfiltered, anonymously, or as a kiosk is denied", async () => {
    await assertFails(membersOf(as("coordA"), "coordB"));
    await assertFails(membersOf(as("coordA"), "minorCoord"));
    await assertFails(getDocs(collectionGroup(as("coordA"), "members")));
    await assertFails(membersOf(anon(), "coordA"));
    await assertFails(membersOf(kiosk("inst1"), `kiosk_inst1_abcd1234`));
  });
});

describe("organizations/{id}/letterRefs", () => {
  it("org members read; others cannot", async () => {
    await assertSucceeds(getDoc(doc(as("coordA"), "organizations/orgA/letterRefs/letter1")));
    await assertFails(getDoc(doc(as("coordB"), "organizations/orgA/letterRefs/letter1")));
    await assertFails(getDoc(doc(as("vol1"), "organizations/orgA/letterRefs/letter1")));
    await assertFails(setDoc(doc(as("coordA"), "organizations/orgA/letterRefs/x"), { status: "valid" }));
  });
});

describe("instanceSecrets", () => {
  it("is never readable or writable by any client", async () => {
    await assertFails(getDoc(doc(as("coordA"), "instanceSecrets/inst1")));
    await assertFails(getDoc(doc(as("admin1", { admin: true }), "instanceSecrets/inst1")));
    await assertFails(getDoc(doc(kiosk("inst1"), "instanceSecrets/inst1")));
    await assertFails(setDoc(doc(as("coordA"), "instanceSecrets/inst9"), { salt: "x" }));
  });
});

describe("signups (SPEC#rules-signups)", () => {
  it("the volunteer, the org's coordinators, and the instance's kiosk can read", async () => {
    await assertSucceeds(getDoc(doc(as("vol1"), "signups/inst1_vol1")));
    await assertSucceeds(getDoc(doc(as("coordA"), "signups/inst1_vol1")));
    await assertSucceeds(getDoc(doc(as("minorCoord"), "signups/inst1_vol1")));
    await assertSucceeds(getDoc(doc(kiosk("inst1"), "signups/inst1_vol1")));
    await assertSucceeds(getDocs(query(collection(kiosk("inst1"), "signups"), where("instanceId", "==", "inst1"))));
  });

  it("another volunteer, another org, another instance's kiosk, and an expired kiosk cannot", async () => {
    await assertFails(getDoc(doc(as("vol2"), "signups/inst1_vol1")));
    await assertFails(getDoc(doc(as("coordB"), "signups/inst1_vol1")));
    await assertFails(getDoc(doc(kiosk("inst1"), "signups/inst2_vol2")));
    await assertFails(getDocs(query(collection(kiosk("inst1"), "signups"), where("instanceId", "==", "inst2"))));
    await assertFails(getDoc(doc(kiosk("inst1", Date.now() - 1000), "signups/inst1_vol1")));
    await assertFails(getDoc(doc(anon(), "signups/inst1_vol1")));
  });

  it("no client writes, even the volunteer on their own signup", async () => {
    await assertFails(updateDoc(doc(as("vol1"), "signups/inst1_vol1"), { status: "completed" }));
    await assertFails(setDoc(doc(as("vol1"), "signups/inst2_vol1"), { instanceId: "inst2", orgId: "orgA", uid: "vol1", status: "confirmed" }));
    await assertFails(deleteDoc(doc(as("coordA"), "signups/inst1_vol1")));
  });
});

describe("signupContacts (SPEC#rules-signupcontacts)", () => {
  it("coordinators who may view contacts can read", async () => {
    await assertSucceeds(getDoc(doc(as("coordA"), "signupContacts/inst1_vol1")));
  });

  it("minor coordinators, other orgs, kiosks, and the volunteer cannot", async () => {
    await assertFails(getDoc(doc(as("minorCoord"), "signupContacts/inst1_vol1")));
    await assertFails(getDoc(doc(as("coordB"), "signupContacts/inst1_vol1")));
    await assertFails(getDoc(doc(kiosk("inst1"), "signupContacts/inst1_vol1")));
    await assertFails(getDoc(doc(as("vol1"), "signupContacts/inst1_vol1")));
    await assertFails(updateDoc(doc(as("coordA"), "signupContacts/inst1_vol1"), { email: "x@example.test" }));
  });
});

describe("hoursLogs", () => {
  it("the volunteer and the org's coordinators read", async () => {
    await assertSucceeds(getDoc(doc(as("vol1"), "hoursLogs/inst1_vol1")));
    await assertSucceeds(getDoc(doc(as("coordA"), "hoursLogs/inst1_vol1")));
  });

  it("others cannot read and nobody writes", async () => {
    await assertFails(getDoc(doc(as("vol2"), "hoursLogs/inst1_vol1")));
    await assertFails(getDoc(doc(as("coordB"), "hoursLogs/inst1_vol1")));
    await assertFails(setDoc(doc(as("vol1"), "hoursLogs/fake"), { uid: "vol1", orgId: "orgA", minutes: 720, status: "approved" }));
    await assertFails(updateDoc(doc(as("coordA"), "hoursLogs/inst1_vol1"), { minutes: 720 }));
  });
});

describe("letters and letterVerifications", () => {
  it("letters: owner and admin read; coordinators and others cannot; nobody writes", async () => {
    await assertSucceeds(getDoc(doc(as("vol1"), "letters/letter1")));
    await assertSucceeds(getDoc(doc(as("admin1", { admin: true }), "letters/letter1")));
    await assertFails(getDoc(doc(as("coordA"), "letters/letter1")));
    await assertFails(getDoc(doc(as("vol2"), "letters/letter1")));
    await assertFails(updateDoc(doc(as("vol1"), "letters/letter1"), { status: "valid" }));
  });

  it("verifications: get by exact code is public; list and writes are denied", async () => {
    await assertSucceeds(getDoc(doc(anon(), "letterVerifications/CODE1")));
    await assertFails(getDocs(collection(anon(), "letterVerifications")));
    await assertFails(getDocs(collection(as("vol1"), "letterVerifications")));
    await assertFails(setDoc(doc(as("vol1"), "letterVerifications/FAKE"), { status: "valid", totalMinutes: 9999 }));
  });
});

describe("users/{uid} (public projection)", () => {
  it("self and admin read; others cannot", async () => {
    await assertSucceeds(getDoc(doc(as("vol1"), "users/vol1")));
    await assertSucceeds(getDoc(doc(as("admin1", { admin: true }), "users/vol1")));
    await assertFails(getDoc(doc(as("vol2"), "users/vol1")));
    await assertFails(getDoc(doc(anon(), "users/vol1")));
  });

  it("no client writes of server-owned stats", async () => {
    await assertFails(updateDoc(doc(as("vol1"), "users/vol1"), { totalApprovedHours: 500 }));
    await assertFails(setDoc(doc(as("vol2"), "users/vol2"), { displayName: "Me", totalApprovedHours: 0 }));
  });
});

describe("users/{uid}/private/profile (SPEC#rules-private)", () => {
  const profile = (db: Firestore) => doc(db, "users/vol1/private/profile");

  it("only the owner reads", async () => {
    await assertSucceeds(getDoc(profile(as("vol1"))));
    await assertFails(getDoc(profile(as("vol2"))));
    await assertFails(getDoc(profile(as("admin1", { admin: true }))));
    await assertFails(getDoc(profile(kiosk("inst1"))));
  });

  it("the owner may update allowlisted display preferences with valid types", async () => {
    await assertSucceeds(updateDoc(profile(as("vol1")), { textSize: 150, contrast: "high", reducedMotion: true }));
    await assertSucceeds(updateDoc(profile(as("vol1")), { notificationPrefs: { discoverable: true }, milestonesSeen: [25] }));
  });

  it("rejects bad preference values", async () => {
    await assertFails(updateDoc(profile(as("vol1")), { textSize: 200 }));
    await assertFails(updateDoc(profile(as("vol1")), { contrast: "neon" }));
    await assertFails(updateDoc(profile(as("vol1")), { notificationPrefs: { discoverable: true, spam: 1 } }));
    await assertFails(updateDoc(profile(as("vol1")), { milestonesSeen: [30] }));
  });

  it("rejects extra keys, isMinor, birthDate, and writes by others", async () => {
    await assertFails(updateDoc(profile(as("vol1")), { textSize: 125, favoriteColor: "blue" }));
    await assertFails(updateDoc(profile(as("vol1")), { isMinor: true }));
    await assertFails(updateDoc(profile(as("vol1")), { birthDate: "2015-01-01" }));
    await assertFails(updateDoc(profile(as("vol2")), { textSize: 125 }));
    await assertFails(setDoc(doc(as("vol2"), "users/vol2/private/profile"), { textSize: 100 }));
    await assertFails(deleteDoc(profile(as("vol1"))));
  });
});

describe("system collections", () => {
  it("jobRuns: admin only", async () => {
    await assertSucceeds(getDoc(doc(as("admin1", { admin: true }), "jobRuns/run1")));
    await assertFails(getDoc(doc(as("coordA"), "jobRuns/run1")));
    await assertFails(setDoc(doc(as("admin1", { admin: true }), "jobRuns/run2"), { outcome: "ok" }));
  });

  it("demoClock: any signed-in client including kiosks; never anonymous; never written", async () => {
    await assertSucceeds(getDoc(doc(as("vol1"), "demoClock/global")));
    await assertSucceeds(getDoc(doc(kiosk("inst1"), "demoClock/global")));
    await assertFails(getDoc(doc(anon(), "demoClock/global")));
    await assertFails(setDoc(doc(as("admin1", { admin: true }), "demoClock/global"), { offsetMs: 900000 }));
  });

  it("rateLimits, jobLeases, contactRefreshJobs, and unknown collections: no client access", async () => {
    await assertFails(getDoc(doc(as("vol1"), "rateLimits/vol1_checkin")));
    await assertFails(setDoc(doc(as("vol1"), "rateLimits/vol1_checkin"), { count: 0 }));
    await assertFails(getDoc(doc(as("admin1", { admin: true }), "jobLeases/runDueJobs")));
    await assertFails(setDoc(doc(as("vol1"), "somethingElse/x"), { a: 1 }));
    await assertFails(getDoc(doc(as("vol1"), "turnstileTokens/abc")));
    await assertFails(getDoc(doc(as("coordA"), "contactRefreshJobs/orgA")));
    await assertFails(getDoc(doc(as("admin1", { admin: true }), "contactRefreshJobs/orgA")));
    await assertFails(setDoc(doc(as("coordA"), "contactRefreshJobs/orgA"), { token: "x" }));
  });

  // Tier 1 lane C
  it("aiUsage counters: no client access, not even your own or as admin", async () => {
    await assertFails(getDoc(doc(as("vol1"), "aiUsage/vol1")));
    await assertFails(setDoc(doc(as("vol1"), "aiUsage/vol1"), { hourCount: 0 }));
    await assertFails(getDoc(doc(as("admin1", { admin: true }), "aiUsage/_global")));
  });
});
