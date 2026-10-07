/**
 * contactRefresh.test.ts
 * Durable T4 contact hiding (SPEC 3.21 contactRefreshJobs, Appendix B 49):
 * an org's verified change is written together with a pending
 * contactRefreshJobs entry; the op's immediate pass clears it; a pass that
 * fails partway (an injected failing chunk) leaves the job, and runDueJobs
 * finishes the repair idempotently. A pass overtaken by a newer change stops
 * without writing the outdated state and leaves the newer job pending.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS, type ContactRefreshJobDoc, type SignupContactDoc } from "@fbla/shared";
import { runContactRefresh, writeVerifiedChange } from "../src/orgs/contactRefreshJob";
import { BASE_MS, adminUser, call, db, resetEmulators, tsAt, user } from "./harness";
import { seedWorld } from "./fixtures";

const MINORS = 5;
const minorIds = Array.from({ length: MINORS }, (_unused, index) => `inst${index}_minor`);

const contact = (instanceId: string, uid: string, isMinor: boolean): SignupContactDoc =>
  ({
    orgId: "orgA", instanceId, uid, hidden: false, fullName: "Sam Lee", email: "sam@example.test", phone: null,
    isMinor, frozen: false, refreshedAt: tsAt(BASE_MS), createdAt: tsAt(BASE_MS), updatedAt: tsAt(BASE_MS)
  }) as unknown as SignupContactDoc;

const seedContacts = async (): Promise<void> => {
  const batch = db.batch();
  minorIds.forEach((id, index) => batch.set(db.collection(COLLECTIONS.signupContacts).doc(id), contact(`inst${index}`, "minor", true)));
  batch.set(db.collection(COLLECTIONS.signupContacts).doc("inst0_vol1"), contact("inst0", "vol1", false));
  await batch.commit();
};

const contactDoc = async (id: string) => (await db.collection(COLLECTIONS.signupContacts).doc(id).get()).data() as SignupContactDoc;
const hiddenMinors = async (): Promise<number> => (await Promise.all(minorIds.map(contactDoc))).filter((doc) => doc.hidden).length;
const job = async (orgId: string) => (await db.collection(COLLECTIONS.contactRefreshJobs).doc(orgId).get()).data() as ContactRefreshJobDoc | undefined;
const unverify = { verified: false, verifiedAt: null, verifiedBy: null, updatedAt: tsAt(BASE_MS) };

const failSecondChunk = { chunkSize: 2, beforeContactChunk: (index: number) => {
  if (index === 1) throw new Error("injected batch failure");
} };

type RunResult = { outcome: string; processed: { contactRefreshes?: number } };

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
  await seedContacts();
});

describe("contact refresh jobs", () => {
  it("a pass that fails after its first chunk stays pending, and runDueJobs completes the repair", async () => {
    const token = await writeVerifiedChange(db, "orgA", unverify, BASE_MS);
    expect(await job("orgA")).toMatchObject({ orgId: "orgA", token });

    await expect(runContactRefresh(db, "orgA", token, BASE_MS, failSecondChunk)).rejects.toThrow("injected batch failure");
    // Only the first chunk landed; the rest of the minors are still visible, and the job is still pending.
    expect(await hiddenMinors()).toBe(2);
    expect(await job("orgA")).toMatchObject({ token });

    const run = await call<RunResult>("admin", "runDueJobs", {}, adminUser());
    expect(run).toMatchObject({ outcome: "ok", processed: { contactRefreshes: 1 } });
    expect(await hiddenMinors()).toBe(MINORS);
    for (const id of minorIds) {
      const repaired = await contactDoc(id);
      expect(repaired.fullName).toBeUndefined();
      expect(repaired.email).toBeUndefined();
    }
    // Adults are never hidden by T4.
    expect(await contactDoc("inst0_vol1")).toMatchObject({ hidden: false, fullName: "Sam Lee" });
    expect(await job("orgA")).toBeUndefined();

    const again = await call<RunResult>("admin", "runDueJobs", {}, adminUser());
    expect(again).toMatchObject({ outcome: "ok", processed: { contactRefreshes: 0 } });
  });

  it("a pass overtaken by a newer verified change stops and leaves the newer job to runDueJobs", async () => {
    const first = await writeVerifiedChange(db, "orgA", unverify, BASE_MS);
    let second = "";
    const overtake = {
      chunkSize: 2,
      beforeContactChunk: async (index: number) => {
        // The admin re-verifies while the hiding pass is between chunks.
        if (index === 1) second = await writeVerifiedChange(db, "orgA", { verified: true, updatedAt: tsAt(BASE_MS) }, BASE_MS);
      }
    };
    await expect(runContactRefresh(db, "orgA", first, BASE_MS, overtake)).resolves.toBe(false);
    expect(await hiddenMinors()).toBe(2);
    expect(await job("orgA")).toMatchObject({ token: second });

    await expect(call<RunResult>("admin", "runDueJobs", {}, adminUser())).resolves.toMatchObject({ processed: { contactRefreshes: 1 } });
    expect(await hiddenMinors()).toBe(0);
    expect(await contactDoc(minorIds[0] ?? "")).toMatchObject({ hidden: false, fullName: "Sam Lee" });
    expect(await job("orgA")).toBeUndefined();
  });

  it("verifyOrganization and updateOrganization finish their pass immediately and leave no job", async () => {
    await call("admin", "verifyOrganization", { orgId: "orgA", verified: false }, adminUser());
    expect(await hiddenMinors()).toBe(MINORS);
    expect(await job("orgA")).toBeUndefined();

    await call("admin", "verifyOrganization", { orgId: "orgA", verified: true }, adminUser());
    expect(await hiddenMinors()).toBe(0);
    await call("coordinator", "updateOrganization", { orgId: "orgA", action: "update", patch: { name: "Common Table Pantry" } }, user("coordA"));
    expect(await hiddenMinors()).toBe(MINORS);
    expect(await job("orgA")).toBeUndefined();
  });
});
