/**
 * inbox.rules.test.ts
 * Rules for the Tier 1 lane A collections (SPEC#rules-matrix):
 * notifications/{uid}/items (owner reads, nobody writes, including the read
 * flag) and users/{uid}/saved/{kind}_{refId} (owner creates with exact
 * shape and server time, deletes, never updates). Also the E3 display
 * preferences the client copies to the private profile.
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
const anon = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;
const kiosk = (): Firestore => as("kiosk_inst1_x", { kioskInstanceId: "inst1", kioskOrgId: "orgA", kioskExp: Date.now() + 3_600_000 });

beforeEach(async () => {
  await env.clearFirestore();
  await seed("notifications/vol1/items/n1", { type: "waitlist-promoted", title: "You're in!", read: false, createdAt: Timestamp.now() });
  await seed("users/vol1/saved/org_orgA", { kind: "org", refId: "orgA", savedAt: Timestamp.now() });
  await seed("users/vol1/private/profile", { firstName: "Jordan", birthDate: "2007-01-01", isMinor: false });
});

describe("notifications/{uid}/items", () => {
  it("the owner reads one item and lists unread items newest first (Q22, Q23)", async () => {
    await assertSucceeds(getDoc(doc(as("vol1"), "notifications/vol1/items/n1")));
    await assertSucceeds(getDocs(query(collection(as("vol1"), "notifications/vol1/items"), orderBy("createdAt", "desc"))));
    await assertSucceeds(getDocs(query(collection(as("vol1"), "notifications/vol1/items"), where("read", "==", false), orderBy("createdAt", "desc"))));
  });

  it("others, visitors, and kiosks cannot read", async () => {
    await assertFails(getDoc(doc(as("vol2"), "notifications/vol1/items/n1")));
    await assertFails(getDocs(collection(as("vol2"), "notifications/vol1/items")));
    await assertFails(getDoc(doc(anon(), "notifications/vol1/items/n1")));
    await assertFails(getDoc(doc(kiosk(), "notifications/vol1/items/n1")));
  });

  it("nobody writes, not even the owner flipping read", async () => {
    await assertFails(updateDoc(doc(as("vol1"), "notifications/vol1/items/n1"), { read: true }));
    await assertFails(setDoc(doc(as("vol1"), "notifications/vol1/items/n2"), { type: "hours-approved", read: false }));
    await assertFails(deleteDoc(doc(as("vol1"), "notifications/vol1/items/n1")));
    await assertFails(setDoc(doc(as("vol2"), "notifications/vol1/items/n3"), { type: "waitlist-promoted" }));
  });
});

describe("users/{uid}/saved", () => {
  const saved = (db: Firestore, id: string) => doc(db, `users/vol1/saved/${id}`);

  it("the owner saves with the exact id and shape, reads, and deletes", async () => {
    await assertSucceeds(setDoc(saved(as("vol1"), "opportunity_opp1"), { kind: "opportunity", refId: "opp1", savedAt: serverTimestamp() }));
    await assertSucceeds(getDocs(query(collection(as("vol1"), "users/vol1/saved"), orderBy("savedAt", "desc"))));
    await assertSucceeds(deleteDoc(saved(as("vol1"), "org_orgA")));
  });

  it("rejects a wrong id, kind, extra key, missing key, or client time", async () => {
    const db = as("vol1");
    await assertFails(setDoc(saved(db, "opportunity_other"), { kind: "opportunity", refId: "opp1", savedAt: serverTimestamp() }));
    await assertFails(setDoc(saved(db, "user_vol2"), { kind: "user", refId: "vol2", savedAt: serverTimestamp() }));
    await assertFails(setDoc(saved(db, "org_orgB"), { kind: "org", refId: "orgB", savedAt: serverTimestamp(), note: "x" }));
    await assertFails(setDoc(saved(db, "org_orgB"), { kind: "org", refId: "orgB" }));
    await assertFails(setDoc(saved(db, "org_orgB"), { kind: "org", refId: "orgB", savedAt: Timestamp.fromMillis(0) }));
  });

  it("no updates; others and kiosks cannot read or write", async () => {
    await assertFails(updateDoc(saved(as("vol1"), "org_orgA"), { savedAt: serverTimestamp() }));
    await assertFails(getDoc(saved(as("vol2"), "org_orgA")));
    await assertFails(setDoc(saved(as("vol2"), "org_orgB"), { kind: "org", refId: "orgB", savedAt: serverTimestamp() }));
    await assertFails(deleteDoc(saved(as("vol2"), "org_orgA")));
    await assertFails(getDoc(saved(kiosk(), "org_orgA")));
    await assertFails(getDoc(saved(anon(), "org_orgA")));
  });
});

describe("E3 preferences on the private profile", () => {
  it("accepts the values the display controls write, and rejects bad ones", async () => {
    const profile = doc(as("vol1"), "users/vol1/private/profile");
    await assertSucceeds(updateDoc(profile, { textSize: 150, contrast: "high", reducedMotion: true }));
    await assertSucceeds(updateDoc(profile, { milestonesSeen: [25] }));
    await assertFails(updateDoc(profile, { textSize: 175 }));
    await assertFails(updateDoc(profile, { contrast: "standard" }));
    await assertFails(updateDoc(profile, { milestonesSeen: [30] }));
  });
});
