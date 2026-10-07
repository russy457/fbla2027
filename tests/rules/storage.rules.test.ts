/**
 * storage.rules.test.ts
 * Storage security rules tests (SPEC 3.22, G17): owner-only letter and report
 * PDFs that no client can write, image-only uploads under 5 MB, and org
 * photo uploads limited to that org's coordinators (cross-service members
 * lookup). Run with `npm run test:rules` (Firestore + Storage emulators).
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { getMetadata, ref, uploadBytes, type FirebaseStorage } from "firebase/storage";

const PROJECT_ID = "demo-fbla2027";
const SMALL = new Uint8Array([1, 2, 3]);
const OVER_5_MB = new Uint8Array(5 * 1024 * 1024 + 1);

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") }
  });
});

afterAll(async () => {
  await env.cleanup();
});

const storageAs = (uid: string, claims: Record<string, unknown> = {}): FirebaseStorage => env.authenticatedContext(uid, claims).storage();
const anonStorage = (): FirebaseStorage => env.unauthenticatedContext().storage();

/** Uploads with rules disabled, the way Functions write letters and reports. */
const seedFile = (path: string, contentType: string) =>
  env.withSecurityRulesDisabled(async (context) => {
    await uploadBytes(ref(context.storage(), path), SMALL, { contentType });
  });

beforeEach(async () => {
  await env.clearStorage();
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((context) =>
    setDoc(doc(context.firestore(), "organizations/orgA/members/coordA"), { uid: "coordA", orgId: "orgA", role: "owner", canViewContacts: true })
  );
  await seedFile("letters/vol1/letter1.pdf", "application/pdf");
  await seedFile("reports/vol1/report1.pdf", "application/pdf");
  await seedFile("orgs/orgA/photos/front.jpg", "image/jpeg");
  await seedFile("avatars/vol1/me.png", "image/png");
});

describe("letters/{uid}/*.pdf", () => {
  it("only the owner reads", async () => {
    await assertSucceeds(getMetadata(ref(storageAs("vol1"), "letters/vol1/letter1.pdf")));
    await assertFails(getMetadata(ref(storageAs("vol2"), "letters/vol1/letter1.pdf")));
    await assertFails(getMetadata(ref(anonStorage(), "letters/vol1/letter1.pdf")));
    await assertFails(getMetadata(ref(storageAs("kiosk_i1", { kioskInstanceId: "i1" }), "letters/vol1/letter1.pdf")));
  });

  it("no client writes, not even the owner", async () => {
    await assertFails(uploadBytes(ref(storageAs("vol1"), "letters/vol1/forged.pdf"), SMALL, { contentType: "application/pdf" }));
  });
});

describe("reports/{uid}/*.pdf", () => {
  it("owner reads; nobody writes", async () => {
    await assertSucceeds(getMetadata(ref(storageAs("vol1"), "reports/vol1/report1.pdf")));
    await assertFails(getMetadata(ref(storageAs("vol2"), "reports/vol1/report1.pdf")));
    await assertFails(uploadBytes(ref(storageAs("vol1"), "reports/vol1/new.pdf"), SMALL, { contentType: "application/pdf" }));
  });
});

describe("avatars/{uid}/*", () => {
  it("signed-in users read; the owner uploads small images", async () => {
    await assertSucceeds(getMetadata(ref(storageAs("vol2"), "avatars/vol1/me.png")));
    await assertFails(getMetadata(ref(anonStorage(), "avatars/vol1/me.png")));
    await assertSucceeds(uploadBytes(ref(storageAs("vol1"), "avatars/vol1/new.png"), SMALL, { contentType: "image/png" }));
  });

  it("rejects other users' paths, non-images, and files of 5 MB or more", async () => {
    await assertFails(uploadBytes(ref(storageAs("vol2"), "avatars/vol1/evil.png"), SMALL, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(storageAs("vol1"), "avatars/vol1/doc.pdf"), SMALL, { contentType: "application/pdf" }));
    await assertFails(uploadBytes(ref(storageAs("vol1"), "avatars/vol1/huge.png"), OVER_5_MB, { contentType: "image/png" }));
  });
});

describe("orgs/{orgId}/photos/*", () => {
  it("anyone reads; the org's coordinators upload images", async () => {
    await assertSucceeds(getMetadata(ref(anonStorage(), "orgs/orgA/photos/front.jpg")));
    await assertSucceeds(uploadBytes(ref(storageAs("coordA"), "orgs/orgA/photos/new.jpg"), SMALL, { contentType: "image/jpeg" }));
  });

  it("non-members, non-images, and unknown paths are refused", async () => {
    await assertFails(uploadBytes(ref(storageAs("vol1"), "orgs/orgA/photos/x.jpg"), SMALL, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(storageAs("coordA"), "orgs/orgA/photos/x.txt"), SMALL, { contentType: "text/plain" }));
    await assertFails(uploadBytes(ref(storageAs("coordA"), "random/x.jpg"), SMALL, { contentType: "image/jpeg" }));
  });
});
