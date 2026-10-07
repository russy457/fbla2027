/**
 * collections.test.ts
 * Curated collection ops (SPEC 3.19, Tier 2 lane B review fix): clients no
 * longer write collections/{id}; coordinators use coordinator.upsertCollection,
 * publishCollection, and deleteCollection for their org, and admins use the
 * admin.* ops of the same names for app-wide collections (orgId null).
 * Checks: deterministic create ids (retry-safe), the injected clock on
 * updatedAt, the author and org never changing, cross-org denial (org
 * derived from the stored collection), kiosk denial, strict item shapes, and
 * that non-admins cannot write org-less collections.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS, type CuratedCollectionDoc } from "@fbla/shared";
import { BASE_MS, MINUTE, adminUser, call, db, expectCode, kioskUser, resetEmulators, testClock, user } from "./harness";
import { seedWorld } from "./fixtures";

const NONCE = "44444444-4444-4444-8444-444444444444";
const OTHER_NONCE = "55555555-5555-4555-8555-555555555555";

const fields = (extra: Record<string, unknown> = {}) => ({
  title: "Weekend food drives",
  description: "Hands-on shifts for new volunteers.",
  items: [
    { kind: "opportunity", refId: "opp1" },
    { kind: "org", refId: "orgA" }
  ],
  published: false,
  ...extra
});

type Upserted = { collectionId: string; created: boolean };

const stored = async (collectionId: string) =>
  (await db.collection(COLLECTIONS.curatedCollections).doc(collectionId).get()).data() as CuratedCollectionDoc | undefined;

const count = async () => (await db.collection(COLLECTIONS.curatedCollections).get()).size;

const createOrgCollection = (uid = "coordA", orgId = "orgA") =>
  call<Upserted>("coordinator", "upsertCollection", { orgId, requestNonce: NONCE, fields: fields() }, user(uid));

const createAdminCollection = () => call<Upserted>("admin", "upsertCollection", { requestNonce: NONCE, fields: fields() }, adminUser());

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
});

describe("coordinator collection ops", () => {
  it("creates at a deterministic id with the request clock; a retried nonce rewrites the same document", async () => {
    const first = await createOrgCollection();
    expect(first.created).toBe(true);
    const doc = await stored(first.collectionId);
    expect(doc).toMatchObject({ ...fields(), orgId: "orgA", authorUid: "coordA" });
    expect(doc?.updatedAt.toMillis()).toBe(BASE_MS);

    const retry = await createOrgCollection();
    expect(retry).toEqual({ collectionId: first.collectionId, created: false });
    expect(await count()).toBe(1);

    const second = await call<Upserted>("coordinator", "upsertCollection", { orgId: "orgA", requestNonce: OTHER_NONCE, fields: fields() }, user("coordA"));
    expect(second.collectionId).not.toBe(first.collectionId);
  });

  it("updates fields and publishes; the author and org never change", async () => {
    const { collectionId } = await createOrgCollection();
    testClock.advance(5 * MINUTE);
    const updated = await call<Upserted>("coordinator", "upsertCollection", { collectionId, fields: fields({ title: "Saturday sorting", items: [] }) }, user("coordA"));
    expect(updated).toEqual({ collectionId, created: false });
    const doc = await stored(collectionId);
    expect(doc).toMatchObject({ title: "Saturday sorting", items: [], orgId: "orgA", authorUid: "coordA", published: false });
    expect(doc?.updatedAt.toMillis()).toBe(BASE_MS + 5 * MINUTE);

    testClock.advance(MINUTE);
    await expect(call("coordinator", "publishCollection", { collectionId, published: true }, user("coordA"))).resolves.toEqual({ collectionId, published: true });
    const published = await stored(collectionId);
    expect(published).toMatchObject({ published: true, title: "Saturday sorting" });
    expect(published?.updatedAt.toMillis()).toBe(BASE_MS + 6 * MINUTE);
  });

  it("deletes; a missing collection or org is NOT_FOUND", async () => {
    const { collectionId } = await createOrgCollection();
    await expect(call("coordinator", "deleteCollection", { collectionId }, user("coordA"))).resolves.toEqual({ collectionId, deleted: true });
    expect(await stored(collectionId)).toBeUndefined();
    await expectCode(call("coordinator", "deleteCollection", { collectionId }, user("coordA")), "NOT_FOUND");
    await expectCode(call("coordinator", "publishCollection", { collectionId: "nope", published: true }, user("coordA")), "NOT_FOUND");
    await expectCode(createOrgCollection("coordA", "noSuchOrg"), "NOT_FOUND");
  });

  it("denies other orgs' coordinators: the org comes from the stored collection, not the input", async () => {
    const { collectionId } = await createOrgCollection();
    await expectCode(call("coordinator", "upsertCollection", { collectionId, fields: fields({ title: "Taken over" }) }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "publishCollection", { collectionId, published: true }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "deleteCollection", { collectionId }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(createOrgCollection("coordB", "orgA"), "PERMISSION_DENIED");
    // An update cannot move a collection to another org: orgId is not an update field.
    await expectCode(call("coordinator", "upsertCollection", { collectionId, orgId: "orgB", fields: fields() }, user("coordB")), "INVALID_INPUT");
    await expectCode(createOrgCollection("vol1", "orgA"), "PERMISSION_DENIED");
    expect(await stored(collectionId)).toMatchObject({ title: "Weekend food drives", orgId: "orgA", published: false });
  });

  it("refuses kiosk tokens for every op", async () => {
    const { collectionId } = await createOrgCollection();
    await expectCode(call("coordinator", "upsertCollection", { orgId: "orgA", requestNonce: OTHER_NONCE, fields: fields() }, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "upsertCollection", { collectionId, fields: fields() }, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "publishCollection", { collectionId, published: true }, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "deleteCollection", { collectionId }, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("admin", "deleteCollection", { collectionId }, kioskUser("inst1")), "PERMISSION_DENIED");
  });

  it("rejects malformed items and fields before anything is written", async () => {
    const malformed: Array<Record<string, unknown>> = [
      { items: [{ kind: "script", refId: "opp1" }] },
      { items: [{ kind: "org", refId: "orgA", label: "<b>extra</b>" }] },
      { items: [{ kind: "org", refId: "x".repeat(201) }] },
      { items: [{ kind: "org", refId: "orgs/orgA" }] },
      { items: [{ kind: "org" }] },
      { items: ["orgA"] },
      { items: [{ kind: "org", refId: "orgA" }, { kind: "org", refId: "orgA" }] },
      { items: Array.from({ length: 31 }, (_, index) => ({ kind: "org", refId: `o${index}` })) },
      { title: "abc" },
      { description: "x".repeat(501) },
      { published: "yes" },
      { featured: true }
    ];
    for (const extra of malformed) {
      await expectCode(call("coordinator", "upsertCollection", { orgId: "orgA", requestNonce: NONCE, fields: fields(extra) }, user("coordA")), "INVALID_INPUT");
      await expectCode(call("admin", "upsertCollection", { requestNonce: NONCE, fields: fields(extra) }, adminUser()), "INVALID_INPUT");
    }
    await expectCode(call("coordinator", "upsertCollection", { orgId: "orgA", requestNonce: "not-a-uuid", fields: fields() }, user("coordA")), "INVALID_INPUT");
    expect(await count()).toBe(0);
  });
});

describe("admin collection ops (orgId null)", () => {
  it("admins create, update, publish, and delete app-wide collections", async () => {
    const { collectionId, created } = await createAdminCollection();
    expect(created).toBe(true);
    expect(await stored(collectionId)).toMatchObject({ orgId: null, authorUid: "admin1", published: false });
    await call("admin", "upsertCollection", { collectionId, fields: fields({ title: "Team picks" }) }, adminUser("admin2"));
    expect(await stored(collectionId)).toMatchObject({ title: "Team picks", authorUid: "admin1", orgId: null });
    await call("admin", "publishCollection", { collectionId, published: true }, adminUser());
    expect(await stored(collectionId)).toMatchObject({ published: true });
    await call("admin", "deleteCollection", { collectionId }, adminUser());
    expect(await stored(collectionId)).toBeUndefined();
  });

  it("non-admins cannot write org-less collections on either endpoint", async () => {
    await expectCode(call("admin", "upsertCollection", { requestNonce: NONCE, fields: fields() }, user("coordA")), "PERMISSION_DENIED");
    await expectCode(call("admin", "upsertCollection", { requestNonce: NONCE, fields: fields() }, user("vol1")), "PERMISSION_DENIED");
    const { collectionId } = await createAdminCollection();
    await expectCode(call("admin", "publishCollection", { collectionId, published: true }, user("coordA")), "PERMISSION_DENIED");
    await expectCode(call("admin", "deleteCollection", { collectionId }, user("coordA")), "PERMISSION_DENIED");
    // The coordinator endpoint refuses app-wide collections (no org to be a coordinator of).
    await expectCode(call("coordinator", "upsertCollection", { collectionId, fields: fields({ title: "Not mine" }) }, user("coordA")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "publishCollection", { collectionId, published: true }, user("coordA")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "deleteCollection", { collectionId }, user("coordA")), "PERMISSION_DENIED");
    // A coordinator create must name an org; without one it is not a valid coordinator input.
    await expectCode(call("coordinator", "upsertCollection", { requestNonce: OTHER_NONCE, fields: fields() }, user("coordA")), "INVALID_INPUT");
    expect(await stored(collectionId)).toMatchObject({ published: false, title: "Weekend food drives" });
  });

  it("the admin endpoint does not edit org collections", async () => {
    const { collectionId } = await createOrgCollection();
    await expectCode(call("admin", "upsertCollection", { collectionId, fields: fields({ title: "Admin edit" }) }, adminUser()), "PERMISSION_DENIED");
    await expectCode(call("admin", "publishCollection", { collectionId, published: true }, adminUser()), "PERMISSION_DENIED");
    await expectCode(call("admin", "deleteCollection", { collectionId }, adminUser()), "PERMISSION_DENIED");
    expect(await stored(collectionId)).toMatchObject({ orgId: "orgA", published: false });
  });
});
