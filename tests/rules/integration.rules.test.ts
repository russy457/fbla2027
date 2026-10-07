/**
 * integration.rules.test.ts
 * Rules behind the Tier 1 integration screens (SPEC#rules-matrix):
 *   - /organizations/:orgId is public: a signed-out visitor reads the org and
 *     lists its upcoming shifts (Q: instances where orgId == X orderBy start),
 *     but nobody writes either from a client;
 *   - /me/profile: the volunteer may flip notificationPrefs.discoverable on
 *     their own private profile, but the fields volunteer.updateProfile owns
 *     (interests, skills, availability, phone, zip, homeGeohash, names) are
 *     Function-only, and nobody else may touch the toggle.
 * Run with `npm run test:rules`.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Timestamp, collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where, type Firestore } from "firebase/firestore";

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
const as = (uid: string): Firestore => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const anon = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;

beforeEach(async () => {
  await env.clearFirestore();
  await seed("organizations/orgA", { name: "Alamo Community Pantry", verified: true, ownerUid: "coordA" });
  await seed("instances/inst1", { orgId: "orgA", title: "Sort food", start: Timestamp.fromMillis(Date.now() + 86_400_000), status: "scheduled" });
  await seed("users/vol1/private/profile", { firstName: "Jordan", birthDate: "2007-01-01", isMinor: false, interests: [], zip: null, homeGeohash: null });
});

describe("public organization page", () => {
  it("a signed-out visitor reads the organization and lists its shifts by start", async () => {
    await assertSucceeds(getDoc(doc(anon(), "organizations/orgA")));
    await assertSucceeds(getDocs(query(collection(anon(), "instances"), where("orgId", "==", "orgA"), orderBy("start", "asc"))));
  });

  it("no client writes the organization or its shifts, not even the owner", async () => {
    await assertFails(updateDoc(doc(as("coordA"), "organizations/orgA"), { verified: true, name: "Renamed" }));
    await assertFails(updateDoc(doc(as("coordA"), "instances/inst1"), { title: "Renamed" }));
    await assertFails(setDoc(doc(anon(), "organizations/orgX"), { name: "Fake" }));
  });
});

describe("profile page writes", () => {
  it("the volunteer flips notificationPrefs.discoverable on their own profile", async () => {
    await assertSucceeds(updateDoc(doc(as("vol1"), "users/vol1/private/profile"), { notificationPrefs: { discoverable: true } }));
    await assertSucceeds(updateDoc(doc(as("vol1"), "users/vol1/private/profile"), { notificationPrefs: { discoverable: false } }));
  });

  it("refuses a malformed toggle and anyone else's toggle", async () => {
    await assertFails(updateDoc(doc(as("vol1"), "users/vol1/private/profile"), { notificationPrefs: { discoverable: "yes" } }));
    await assertFails(updateDoc(doc(as("vol1"), "users/vol1/private/profile"), { notificationPrefs: { discoverable: true, everyone: true } }));
    await assertFails(updateDoc(doc(as("vol2"), "users/vol1/private/profile"), { notificationPrefs: { discoverable: true } }));
    await assertFails(updateDoc(doc(anon(), "users/vol1/private/profile"), { notificationPrefs: { discoverable: true } }));
  });

  it("fields owned by volunteer.updateProfile are Function-only", async () => {
    const own = doc(as("vol1"), "users/vol1/private/profile");
    await assertFails(updateDoc(own, { interests: ["seniors"] }));
    await assertFails(updateDoc(own, { zip: "78212", homeGeohash: "9v1zw" }));
    await assertFails(updateDoc(own, { firstName: "Jo" }));
    await assertFails(updateDoc(own, { phone: "+12105550100" }));
    await assertFails(updateDoc(own, { birthDate: "2001-01-01" }));
    await assertFails(updateDoc(doc(as("vol1"), "users/vol1"), { displayName: "Jo R." }));
  });
});
