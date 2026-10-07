/**
 * curation.rules.test.ts
 * Rules for the Tier 2 lane B curation collections (SPEC#rules-matrix):
 *   collections/{id}  published = public read; drafts for the org's
 *                     coordinators and admins; every client write denied
 *                     (Functions-only: coordinator/admin collection ops,
 *                     covered by functions/test/collections.test.ts).
 *   reviews/{signupId} public read; created only by the author of a completed
 *                     signup at that org (so a second review for one signup
 *                     fails); public name or "A volunteer"; authors edit the
 *                     body with a 30 s cooldown; coordinators set the
 *                     response; authors and admins delete.
 * Run with `npm run test:rules`.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore
} from "firebase/firestore";

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
const admin = (): Firestore => as("admin1", { admin: true });
const anon = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;
const kiosk = (): Firestore => as("kiosk_inst1_x", { kioskInstanceId: "inst1", kioskOrgId: "orgA", kioskExp: Date.now() + 3_600_000 });

const OLD = Timestamp.fromMillis(Date.now() - 10 * 60_000);
const member = (orgId: string, uid: string, role = "coordinator") => seed(`organizations/${orgId}/members/${uid}`, { uid, orgId, role });

const signup = (id: string, uid: string, status: string, orgId = "orgA") => seed(`signups/${id}`, { uid, orgId, status, instanceId: id.split("_")[0] });

beforeEach(async () => {
  await env.clearFirestore();
  await seed("organizations/orgA", { name: "Alamo" });
  await seed("organizations/orgB", { name: "Bexar" });
  await member("orgA", "coordA");
  await member("orgA", "ownerA", "owner");
  await member("orgB", "coordB");
  await seed("users/vol1", { displayName: "Jordan R." });
  await seed("users/vol2", { displayName: "Sam L." });
  await signup("inst1_vol1", "vol1", "completed");
  await signup("inst4_vol1", "vol1", "completed");
  await signup("inst2_vol1", "vol1", "confirmed");
  await signup("inst3_vol2", "vol2", "completed");
  await signup("inst5_vol1", "vol1", "completed", "orgB");
});

// ---------- collections ----------

const fields = (orgId: string | null, authorUid: string, extra: Record<string, unknown> = {}) => ({
  title: "Weekend food drives",
  description: "Hands-on shifts for new volunteers.",
  items: [{ kind: "opportunity", refId: "opp1" }],
  orgId,
  authorUid,
  published: true,
  updatedAt: serverTimestamp(),
  ...extra
});

const seedCollection = (id: string, orgId: string | null, published: boolean) =>
  seed(`collections/${id}`, { ...fields(orgId, orgId === null ? "admin1" : "coordA"), published, updatedAt: OLD });

describe("collections client writes", () => {
  it("denies every client create, even a well-formed one from the org's coordinator or an admin", async () => {
    await assertFails(setDoc(doc(as("coordA"), "collections/c1"), fields("orgA", "coordA")));
    await assertFails(setDoc(doc(admin(), "collections/c2"), fields(null, "admin1")));
    await assertFails(setDoc(doc(as("coordB"), "collections/c1"), fields("orgA", "coordB")));
    await assertFails(setDoc(doc(as("vol1"), "collections/c1"), fields(null, "vol1")));
    await assertFails(setDoc(doc(kiosk(), "collections/c1"), fields("orgA", "kiosk_inst1_x")));
    await assertFails(setDoc(doc(anon(), "collections/c1"), fields("orgA", "nobody")));
  });

  it("denies a malformed item list the rules could never have checked item by item", async () => {
    await assertFails(setDoc(doc(as("coordA"), "collections/c1"), fields("orgA", "coordA", { items: [{ kind: "script", refId: "x".repeat(5000), extra: true }] })));
  });
});

describe("collections read", () => {
  beforeEach(async () => {
    await seedCollection("pubA", "orgA", true);
    await seedCollection("draftA", "orgA", false);
    await seedCollection("draftAdmin", null, false);
  });

  it("anyone reads published ones and lists them (Q34)", async () => {
    await assertSucceeds(getDoc(doc(anon(), "collections/pubA")));
    await assertSucceeds(getDocs(query(collection(anon(), "collections"), where("published", "==", true), orderBy("updatedAt", "desc"))));
  });

  it("drafts are for the org's coordinators and admins only (Q35)", async () => {
    await assertFails(getDoc(doc(anon(), "collections/draftA")));
    await assertFails(getDoc(doc(as("vol1"), "collections/draftA")));
    await assertFails(getDoc(doc(as("coordB"), "collections/draftA")));
    await assertSucceeds(getDoc(doc(as("coordA"), "collections/draftA")));
    await assertSucceeds(getDoc(doc(admin(), "collections/draftA")));
    await assertFails(getDoc(doc(as("coordA"), "collections/draftAdmin")));
    await assertSucceeds(getDocs(query(collection(as("coordA"), "collections"), where("orgId", "==", "orgA"), orderBy("updatedAt", "desc"))));
    await assertFails(getDocs(query(collection(as("coordB"), "collections"), where("orgId", "==", "orgA"), orderBy("updatedAt", "desc"))));
    await assertSucceeds(getDocs(query(collection(admin(), "collections"), where("orgId", "==", null), orderBy("updatedAt", "desc"))));
  });
});

describe("collections update and delete", () => {
  beforeEach(async () => {
    await seedCollection("pubA", "orgA", true);
    await seedCollection("adminC", null, true);
  });

  it("denies client updates and deletes, including the org's coordinators and admins", async () => {
    await assertFails(updateDoc(doc(as("ownerA"), "collections/pubA"), { published: false, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as("coordA"), "collections/pubA"), { title: "Weekend picks", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(admin(), "collections/adminC"), { title: "Admin picks", updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(as("coordA"), "collections/pubA")));
    await assertFails(deleteDoc(doc(admin(), "collections/adminC")));
    await assertFails(deleteDoc(doc(as("vol1"), "collections/pubA")));
  });
});

// ---------- reviews ----------

const review = (uid: string, extra: Record<string, unknown> = {}) => ({
  orgId: "orgA",
  uid,
  displayName: "Jordan R.",
  rating: 5,
  tags: ["welcoming"],
  text: "Well run and friendly.",
  response: null,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra
});

describe("reviews create", () => {
  it("the author of a completed signup reviews it once, with their public name or anonymously", async () => {
    const db = as("vol1");
    await assertSucceeds(setDoc(doc(db, "reviews/inst1_vol1"), review("vol1")));
    // A second review for the same signup is an overwrite, which the rules refuse.
    await assertFails(setDoc(doc(db, "reviews/inst1_vol1"), review("vol1", { rating: 1 })));
    await assertSucceeds(setDoc(doc(db, "reviews/inst4_vol1"), review("vol1", { displayName: "A volunteer" })));
  });

  it("denies signups that are not completed, not theirs, another org, or missing", async () => {
    const db = as("vol1");
    await assertFails(setDoc(doc(db, "reviews/inst2_vol1"), review("vol1")));
    await assertFails(setDoc(doc(db, "reviews/inst3_vol2"), review("vol1")));
    await assertFails(setDoc(doc(db, "reviews/inst5_vol1"), review("vol1")));
    await assertFails(setDoc(doc(db, "reviews/inst9_vol1"), review("vol1")));
    await assertFails(setDoc(doc(as("vol2"), "reviews/inst1_vol1"), review("vol2", { displayName: "Sam L." })));
  });

  it("checks name, rating, tags, text, response, keys, and server time", async () => {
    const db = as("vol1");
    const bad = [
      { displayName: "Jordan Rivera" },
      { uid: "vol2" },
      { rating: 6 },
      { rating: 4.5 },
      { tags: ["friendly"] },
      { tags: ["welcoming", "welcoming"] },
      { text: "x".repeat(1001) },
      { response: { text: "Thanks", by: "vol1", at: serverTimestamp() } },
      { createdAt: OLD },
      { verified: true }
    ];
    for (const extra of bad) await assertFails(setDoc(doc(db, "reviews/inst1_vol1"), review("vol1", extra)));
  });

  it("kiosks and visitors cannot review", async () => {
    await assertFails(setDoc(doc(kiosk(), "reviews/inst1_vol1"), review("kiosk_inst1_x")));
    await assertFails(setDoc(doc(anon(), "reviews/inst1_vol1"), review("vol1")));
  });
});

describe("reviews read, update, delete", () => {
  beforeEach(async () => {
    await seed("reviews/inst1_vol1", { ...review("vol1"), createdAt: OLD, updatedAt: OLD });
  });

  it("is public, including the org list (Q33)", async () => {
    await assertSucceeds(getDoc(doc(anon(), "reviews/inst1_vol1")));
    await assertSucceeds(getDocs(query(collection(anon(), "reviews"), where("orgId", "==", "orgA"), orderBy("createdAt", "desc"))));
  });

  it("authors edit the body only, then wait 30 seconds", async () => {
    const ref = doc(as("vol1"), "reviews/inst1_vol1");
    await assertFails(updateDoc(ref, { displayName: "A volunteer", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { orgId: "orgB", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { rating: 3, updatedAt: OLD }));
    await assertSucceeds(updateDoc(ref, { rating: 3, text: "Good, a bit chaotic.", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { rating: 4, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as("vol2"), "reviews/inst1_vol1"), { rating: 1, updatedAt: serverTimestamp() }));
  });

  it("org coordinators set or clear the response and nothing else", async () => {
    const ref = doc(as("coordA"), "reviews/inst1_vol1");
    await assertSucceeds(updateDoc(ref, { response: { text: "Thank you for coming!", by: "coordA", at: serverTimestamp() } }));
    await assertSucceeds(updateDoc(ref, { response: null }));
    await assertFails(updateDoc(ref, { response: { text: "Hi", by: "ownerA", at: serverTimestamp() } }));
    await assertFails(updateDoc(ref, { response: { text: "", by: "coordA", at: serverTimestamp() } }));
    await assertFails(updateDoc(ref, { rating: 2 }));
    await assertFails(updateDoc(doc(as("coordB"), "reviews/inst1_vol1"), { response: { text: "Hi", by: "coordB", at: serverTimestamp() } }));
  });

  it("authors and admins delete; coordinators and others cannot", async () => {
    await assertFails(deleteDoc(doc(as("coordA"), "reviews/inst1_vol1")));
    await assertFails(deleteDoc(doc(as("vol2"), "reviews/inst1_vol1")));
    await assertSucceeds(deleteDoc(doc(admin(), "reviews/inst1_vol1")));
    await seed("reviews/inst1_vol1", { ...review("vol1"), createdAt: OLD, updatedAt: OLD });
    await assertSucceeds(deleteDoc(doc(as("vol1"), "reviews/inst1_vol1")));
  });

  it("an author cannot delete and recreate to skip the edit cooldown", async () => {
    const db = as("vol1");
    await assertSucceeds(setDoc(doc(db, "reviews/inst4_vol1"), review("vol1")));
    await assertFails(deleteDoc(doc(db, "reviews/inst4_vol1")));
    await assertSucceeds(deleteDoc(doc(admin(), "reviews/inst4_vol1")));
  });
});
