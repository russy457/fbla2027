/**
 * series.rules.test.ts
 * Rules for the Tier 2 lane A collections (SPEC#rules-matrix):
 * series/{seriesId} (public read, Function-only writes), seriesSignups
 * (the volunteer reads their own coverage record; nobody else, kiosks
 * included; nobody writes), and the shift-invite alert landing in the
 * existing owner-only notifications rule.
 * Run with `npm run test:rules`.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, type Firestore } from "firebase/firestore";

const PROJECT_ID = "demo-fbla2027";
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});

afterAll(async () => {
  await env.cleanup();
});

const seed = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), path), data));
const as = (uid: string, claims: Record<string, unknown> = {}): Firestore => env.authenticatedContext(uid, claims).firestore() as unknown as Firestore;
const anon = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;
const kiosk = (): Firestore => as("kiosk_inst1_x", { kioskInstanceId: "inst1", kioskOrgId: "orgA", kioskExp: Date.now() + 3_600_000 });

const SERIES = { orgId: "orgA", opportunityId: "opp1", capacity: 5, startsOn: "2026-10-17", endsOn: null, status: "active" };

beforeEach(async () => {
  await env.clearFirestore();
  await seed("organizations/orgA/members/coordA", { uid: "coordA", orgId: "orgA", role: "owner", canViewContacts: true });
  await seed("series/s1", SERIES);
  await seed("seriesSignups/s1_vol1", { seriesId: "s1", orgId: "orgA", uid: "vol1", coversThrough: "2026-12-12", createdAt: Timestamp.now() });
  await seed("notifications/vol1/items/shift-invite_inst1_vol1", { type: "shift-invite", title: "Invited", read: false, createdAt: Timestamp.now() });
});

describe("series", () => {
  it("anyone reads a series, signed out included", async () => {
    await assertSucceeds(getDoc(doc(anon(), "series/s1")));
    await assertSucceeds(getDoc(doc(as("vol1"), "series/s1")));
    await assertSucceeds(getDocs(collection(anon(), "series")));
  });

  it("no client writes a series, not even the org's coordinator", async () => {
    await assertFails(setDoc(doc(as("coordA"), "series/s2"), SERIES));
    await assertFails(updateDoc(doc(as("coordA"), "series/s1"), { capacity: 50 }));
    await assertFails(deleteDoc(doc(as("coordA"), "series/s1")));
    await assertFails(setDoc(doc(as("admin1", { admin: true }), "series/s3"), SERIES));
  });
});

describe("seriesSignups", () => {
  it("the volunteer reads their own record (even before it exists) and queries by uid", async () => {
    await assertSucceeds(getDoc(doc(as("vol1"), "seriesSignups/s1_vol1")));
    await assertSucceeds(getDoc(doc(as("vol1"), "seriesSignups/s2_vol1")));
    await assertFails(getDoc(doc(as("vol2"), "seriesSignups/s2_vol1")));
    await assertFails(getDoc(doc(kiosk(), "seriesSignups/s2_kiosk_inst1_x")));
    await assertSucceeds(getDocs(query(collection(as("vol1"), "seriesSignups"), where("uid", "==", "vol1"))));
  });

  it("other volunteers, coordinators, visitors, and kiosks cannot read it", async () => {
    await assertFails(getDoc(doc(as("vol2"), "seriesSignups/s1_vol1")));
    await assertFails(getDoc(doc(as("coordA"), "seriesSignups/s1_vol1")));
    await assertFails(getDoc(doc(anon(), "seriesSignups/s1_vol1")));
    await assertFails(getDoc(doc(kiosk(), "seriesSignups/s1_vol1")));
    await assertFails(getDocs(collection(as("vol2"), "seriesSignups")));
  });

  it("nobody writes it, the owner included (coversThrough is server-owned)", async () => {
    await assertFails(updateDoc(doc(as("vol1"), "seriesSignups/s1_vol1"), { coversThrough: "2027-12-31" }));
    await assertFails(setDoc(doc(as("vol1"), "seriesSignups/s2_vol1"), { seriesId: "s2", orgId: "orgA", uid: "vol1", coversThrough: null }));
    await assertFails(deleteDoc(doc(as("vol1"), "seriesSignups/s1_vol1")));
  });
});

describe("shift-invite alerts", () => {
  it("only the invited volunteer reads it; the inviting coordinator cannot, and nobody writes", async () => {
    await assertSucceeds(getDoc(doc(as("vol1"), "notifications/vol1/items/shift-invite_inst1_vol1")));
    await assertFails(getDoc(doc(as("coordA"), "notifications/vol1/items/shift-invite_inst1_vol1")));
    await assertFails(setDoc(doc(as("coordA"), "notifications/vol1/items/shift-invite_inst2_vol1"), { type: "shift-invite", read: false }));
  });
});
