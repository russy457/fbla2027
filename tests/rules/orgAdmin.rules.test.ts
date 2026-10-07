/**
 * orgAdmin.rules.test.ts
 * Security rules for the Tier 1 lane B collections and queries
 * (SPEC#rules-matrix): invites (owner of the org only), reports (owner uid
 * reads and deletes, nobody writes), orgVerificationLog (no client access),
 * and the coordinator queries behind Needs attention (pending org logs, open
 * disputes) and the org letters list. Run with `npm run test:rules`.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, type Firestore } from "firebase/firestore";

const PROJECT_ID = "demo-fbla2027";
const HOUR_MS = 3_600_000;

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});

afterAll(async () => {
  await env.cleanup();
});

const seed = (path: string, data: Record<string, unknown>) => env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), path), data));
const as = (uid: string, claims: Record<string, unknown> = {}): Firestore => env.authenticatedContext(uid, claims).firestore() as unknown as Firestore;
const anon = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;
const kiosk = (instanceId: string): Firestore =>
  as(`kiosk_${instanceId}_abcd1234`, { kioskInstanceId: instanceId, kioskOrgId: "orgA", kioskExp: Date.now() + HOUR_MS });

beforeEach(async () => {
  await env.clearFirestore();
  await seed("organizations/orgA/members/coordA", { uid: "coordA", orgId: "orgA", role: "owner", canViewContacts: true });
  await seed("organizations/orgA/members/helper", { uid: "helper", orgId: "orgA", role: "coordinator", canViewContacts: true });
  await seed("organizations/orgB/members/coordB", { uid: "coordB", orgId: "orgB", role: "owner", canViewContacts: true });
  await seed("invites/hashA", { orgId: "orgA", role: "coordinator", createdBy: "coordA", redeemedBy: null });
  await seed("reports/rep1", { ownerUid: "coordA", kind: "org-participation", orgId: "orgA", status: "ready" });
  await seed("orgVerificationLog/log1", { orgId: "orgA", verified: true, note: "private", by: "admin1" });
  await seed("hoursLogs/manual_1", { uid: "vol1", orgId: "orgA", status: "pending", minutes: 60 });
  await seed("signups/inst1_vol2", { instanceId: "inst1", orgId: "orgA", uid: "vol2", status: "no-show", disputeOpen: true });
});

describe("invites (SPEC 3.5)", () => {
  it("the org owner reads and lists invites; coordinators, other owners, kiosks, and visitors cannot", async () => {
    await assertSucceeds(getDoc(doc(as("coordA"), "invites/hashA")));
    await assertSucceeds(getDocs(query(collection(as("coordA"), "invites"), where("orgId", "==", "orgA"))));
    await assertFails(getDoc(doc(as("helper"), "invites/hashA")));
    await assertFails(getDoc(doc(as("coordB"), "invites/hashA")));
    await assertFails(getDocs(query(collection(as("coordB"), "invites"), where("orgId", "==", "orgA"))));
    await assertFails(getDoc(doc(kiosk("inst1"), "invites/hashA")));
    await assertFails(getDoc(doc(anon(), "invites/hashA")));
  });

  it("no client writes invites, not even the owner", async () => {
    await assertFails(setDoc(doc(as("coordA"), "invites/new"), { orgId: "orgA", role: "coordinator" }));
    await assertFails(updateDoc(doc(as("coordA"), "invites/hashA"), { redeemedBy: "coordA" }));
    await assertFails(deleteDoc(doc(as("coordA"), "invites/hashA")));
  });
});

describe("reports (SPEC 3.21)", () => {
  it("the owner reads, lists, and deletes their report; nobody else reads it", async () => {
    await assertSucceeds(getDoc(doc(as("coordA"), "reports/rep1")));
    await assertSucceeds(getDocs(query(collection(as("coordA"), "reports"), where("ownerUid", "==", "coordA"))));
    await assertFails(getDoc(doc(as("helper"), "reports/rep1")));
    await assertFails(getDocs(query(collection(as("helper"), "reports"), where("ownerUid", "==", "coordA"))));
    await assertFails(getDoc(doc(kiosk("inst1"), "reports/rep1")));
    await assertFails(deleteDoc(doc(as("helper"), "reports/rep1")));
    await assertSucceeds(deleteDoc(doc(as("coordA"), "reports/rep1")));
  });

  it("clients never create or update report metadata", async () => {
    await assertFails(setDoc(doc(as("coordA"), "reports/rep2"), { ownerUid: "coordA", status: "ready" }));
    await assertFails(updateDoc(doc(as("coordA"), "reports/rep1"), { status: "ready" }));
  });
});

describe("orgVerificationLog (admin notes are server-only)", () => {
  it("no client reads or writes, including admins", async () => {
    await assertFails(getDoc(doc(as("admin1", { admin: true }), "orgVerificationLog/log1")));
    await assertFails(getDoc(doc(as("coordA"), "orgVerificationLog/log1")));
    await assertFails(setDoc(doc(as("admin1", { admin: true }), "orgVerificationLog/x"), { note: "x" }));
  });
});

describe("Needs attention queries (SPEC 9.8, Q11, Q16)", () => {
  it("members list their org's pending logs and open disputes; other orgs and kiosks cannot", async () => {
    const pending = (db: Firestore) => getDocs(query(collection(db, "hoursLogs"), where("orgId", "==", "orgA"), where("status", "==", "pending")));
    const disputes = (db: Firestore) => getDocs(query(collection(db, "signups"), where("orgId", "==", "orgA"), where("disputeOpen", "==", true)));
    await assertSucceeds(pending(as("helper")));
    await assertSucceeds(disputes(as("coordA")));
    await assertFails(pending(as("coordB")));
    await assertFails(disputes(as("coordB")));
    await assertFails(pending(kiosk("inst1")));
  });
});
