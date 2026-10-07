/**
 * orgAdmin.test.ts
 * Organization administration ops (SPEC 5.2, 5.8, 3.5): registerOrganization,
 * updateOrganization (update / archive / delete), createInvite, redeemInvite,
 * removeMember, and admin.verifyOrganization. Each coordinator op is checked
 * for cross-org denial (an owner of org B targeting org A) and kiosk-token
 * denial (SPEC 4.4).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  COLLECTIONS,
  PATHS,
  type InviteDoc,
  type MemberDoc,
  type OpportunityDoc,
  type OrganizationDoc,
  type SignupContactDoc
} from "@fbla/shared";
import { BASE_MS, HOUR, adminUser, call, db, expectCode, kioskUser, resetEmulators, testClock, tsAt, user } from "./harness";
import { MINOR_BIRTH, profile, seedInstance, seedSignup, seedWorld } from "./fixtures";

const NONCE = "33333333-3333-4333-8333-333333333333";
const DAY = 24 * HOUR;

const registration = {
  name: "Southside Tool Library",
  mission: "Lends tools to neighbors.",
  causeAreas: ["community-development"],
  ein: "74-7654321",
  address: { line1: "9 Elm St", city: "San Antonio", state: "TX", zip: "78210" },
  contactEmail: "hello@tools.example.test",
  timeZone: "America/Chicago",
  requestNonce: NONCE
};

const orgDoc = async (orgId: string) => (await db.collection(COLLECTIONS.organizations).doc(orgId).get()).data() as OrganizationDoc;
const memberDoc = async (orgId: string, uid: string) => (await db.doc(PATHS.member(orgId, uid)).get()).data() as MemberDoc | undefined;

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
});

describe("coordinator.registerOrganization", () => {
  it("writes an unverified org and an owner membership; the same nonce returns the same org", async () => {
    const { orgId } = await call<{ orgId: string }>("coordinator", "registerOrganization", registration, user("vol1"));
    expect(await orgDoc(orgId)).toMatchObject({ name: "Southside Tool Library", verified: false, hasActivity: false, archived: false, ownerUid: "vol1" });
    expect(await memberDoc(orgId, "vol1")).toMatchObject({ role: "owner", canViewContacts: true, displayName: "Volunteer1 R." });
    const again = await call<{ orgId: string }>("coordinator", "registerOrganization", registration, user("vol1"));
    expect(again.orgId).toBe(orgId);
    expect((await db.collection(COLLECTIONS.organizations).get()).size).toBe(4);
  });

  it("refuses minors, bad EINs, unverified emails, incomplete profiles, and kiosk tokens", async () => {
    await expectCode(call("coordinator", "registerOrganization", registration, user("minor")), "ADULT_REQUIRED");
    await expectCode(call("coordinator", "registerOrganization", { ...registration, ein: "741234567" }, user("vol1")), "EIN_INVALID");
    await expectCode(call("coordinator", "registerOrganization", registration, user("vol2", { email_verified: false })), "EMAIL_NOT_VERIFIED");
    await expectCode(call("coordinator", "registerOrganization", registration, user("incomplete")), "PROFILE_INCOMPLETE");
    await expectCode(call("coordinator", "registerOrganization", registration, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "registerOrganization", { ...registration, timeZone: "Mars/Base" }, user("vol1")), "INVALID_INPUT");
  });
});

describe("coordinator.updateOrganization", () => {
  it("a name change resets verification and refreshes listings and T4 contact hiding", async () => {
    await seedInstance("inst1", { startMs: BASE_MS + 5 * DAY });
    await db.collection(COLLECTIONS.opportunities).doc("opp1").set({ orgId: "orgA", orgName: "Alamo Community Pantry", orgVerified: true } as Partial<OpportunityDoc>);
    await db.collection(COLLECTIONS.signupContacts).doc("inst1_minor").set({
      orgId: "orgA", instanceId: "inst1", uid: "minor", hidden: false, fullName: "Sam Lee", email: "sam@example.test", phone: null,
      isMinor: true, frozen: false, refreshedAt: tsAt(BASE_MS), createdAt: tsAt(BASE_MS), updatedAt: tsAt(BASE_MS)
    } as unknown as SignupContactDoc);

    const result = await call("coordinator", "updateOrganization", { orgId: "orgA", action: "update", patch: { name: "Alamo Pantry" } }, user("coordA"));
    expect(result).toEqual({ orgId: "orgA", verified: false, archived: false, deleted: false });
    expect(await orgDoc("orgA")).toMatchObject({ name: "Alamo Pantry", verified: false, verifiedBy: null });
    expect((await db.collection(COLLECTIONS.instances).doc("inst1").get()).data()).toMatchObject({ orgName: "Alamo Pantry", orgVerified: false });
    expect((await db.collection(COLLECTIONS.opportunities).doc("opp1").get()).data()).toMatchObject({ orgName: "Alamo Pantry", orgVerified: false });
    const contact = (await db.collection(COLLECTIONS.signupContacts).doc("inst1_minor").get()).data() as SignupContactDoc;
    expect(contact.hidden).toBe(true);
    expect(contact.fullName).toBeUndefined();
  });

  it("a mission edit keeps verification; a bad EIN is EIN_INVALID", async () => {
    await call("coordinator", "updateOrganization", { orgId: "orgA", action: "update", patch: { mission: "New mission" } }, user("coordA"));
    expect(await orgDoc("orgA")).toMatchObject({ mission: "New mission", verified: true });
    await expectCode(call("coordinator", "updateOrganization", { orgId: "orgA", action: "update", patch: { ein: "12" } }, user("coordA")), "EIN_INVALID");
    await expectCode(call("coordinator", "updateOrganization", { orgId: "orgA", action: "update", patch: { verified: true } }, user("coordA")), "INVALID_INPUT");
  });

  it("archive is refused while a future shift has volunteers, then allowed and one-way", async () => {
    await seedInstance("inst1", { startMs: BASE_MS + DAY, signupCount: 1 });
    await expectCode(call("coordinator", "updateOrganization", { orgId: "orgA", action: "archive" }, user("coordA")), "ORG_HAS_UPCOMING_SHIFTS");
    await db.collection(COLLECTIONS.instances).doc("inst1").update({ signupCount: 0 });
    await expect(call("coordinator", "updateOrganization", { orgId: "orgA", action: "archive" }, user("coordA"))).resolves.toMatchObject({ archived: true });
    expect((await orgDoc("orgA")).archivedAt).not.toBeNull();
    await expect(call("coordinator", "updateOrganization", { orgId: "orgA", action: "archive" }, user("coordA"))).resolves.toMatchObject({ archived: true });
  });

  it("delete is allowed only without activity and removes the org's documents", async () => {
    await db.collection(COLLECTIONS.organizations).doc("orgA").update({ hasActivity: true });
    await expectCode(call("coordinator", "updateOrganization", { orgId: "orgA", action: "delete" }, user("coordA")), "ORG_HAS_ACTIVITY");
    await seedInstance("instB", { orgId: "orgB" });
    await expect(call("coordinator", "updateOrganization", { orgId: "orgB", action: "delete" }, user("coordB"))).resolves.toMatchObject({ deleted: true });
    expect((await db.collection(COLLECTIONS.organizations).doc("orgB").get()).exists).toBe(false);
    expect((await db.collection(COLLECTIONS.instances).doc("instB").get()).exists).toBe(false);
    expect(await memberDoc("orgB", "coordB")).toBeUndefined();
  });

  it("denies other orgs' owners, non-owner coordinators, and kiosk tokens", async () => {
    await db.doc(PATHS.member("orgA", "vol1")).set({ uid: "vol1", orgId: "orgA", role: "coordinator", displayName: "V", canViewContacts: true, invitedBy: "coordA", joinedAt: tsAt(BASE_MS), createdAt: tsAt(BASE_MS), updatedAt: tsAt(BASE_MS) });
    const archive = { orgId: "orgA", action: "archive" };
    await expectCode(call("coordinator", "updateOrganization", archive, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "updateOrganization", archive, user("vol1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "updateOrganization", archive, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "updateOrganization", { orgId: "nope", action: "archive" }, user("coordA")), "NOT_FOUND");
  });
});

describe("invites and members", () => {
  it("creates a one-time code, stores only its hash, and redeems it into a coordinator membership", async () => {
    const { code, expiresAt } = await call<{ code: string; expiresAt: string }>("coordinator", "createInvite", { orgId: "orgA" }, user("coordA"));
    expect(code).toMatch(/^[A-Z2-7]{10}$/);
    expect(Date.parse(expiresAt)).toBe(BASE_MS + 7 * DAY);
    const invites = await db.collection(COLLECTIONS.invites).get();
    expect(invites.size).toBe(1);
    expect(invites.docs[0]?.id).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(invites.docs[0]?.data())).not.toContain(code);

    const typed = `${code.slice(0, 5).toLowerCase()}-${code.slice(5)}`;
    await expect(call("coordinator", "redeemInvite", { code: typed }, user("vol1"))).resolves.toEqual({ orgId: "orgA", role: "coordinator" });
    expect(await memberDoc("orgA", "vol1")).toMatchObject({ role: "coordinator", canViewContacts: true, invitedBy: "coordA" });
    const redeemed = (await db.collection(COLLECTIONS.invites).get()).docs[0]?.data() as InviteDoc;
    expect(redeemed.redeemedBy).toBe("vol1");
    // Redeeming again as the same person is ok; anyone else gets INVITE_INVALID.
    await expect(call("coordinator", "redeemInvite", { code }, user("vol1"))).resolves.toMatchObject({ orgId: "orgA" });
    await expectCode(call("coordinator", "redeemInvite", { code }, user("vol2")), "INVITE_INVALID");
  });

  it("refuses expired and unknown codes, existing members, and gives minors no contact access", async () => {
    const { code } = await call<{ code: string }>("coordinator", "createInvite", { orgId: "orgA" }, user("coordA"));
    await expectCode(call("coordinator", "redeemInvite", { code }, user("coordA")), "ALREADY_MEMBER");
    await expectCode(call("coordinator", "redeemInvite", { code: "AAAAAAAAAA" }, user("vol1")), "INVITE_INVALID");
    await expectCode(call("coordinator", "redeemInvite", { code: "not a code!" }, user("vol1")), "INVITE_INVALID");
    await call("coordinator", "redeemInvite", { code }, user("minor"));
    expect(await memberDoc("orgA", "minor")).toMatchObject({ canViewContacts: false });

    const second = await call<{ code: string }>("coordinator", "createInvite", { orgId: "orgA" }, user("coordA"));
    testClock.advance(8 * DAY);
    await expectCode(call("coordinator", "redeemInvite", { code: second.code }, user("vol2")), "INVITE_INVALID");
  });

  it("only the owner invites and removes; the owner cannot be removed", async () => {
    await expectCode(call("coordinator", "createInvite", { orgId: "orgA" }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "createInvite", { orgId: "orgA" }, kioskUser("inst1")), "PERMISSION_DENIED");
    const { code } = await call<{ code: string }>("coordinator", "createInvite", { orgId: "orgA" }, user("coordA"));
    await call("coordinator", "redeemInvite", { code }, user("vol1"));
    await expectCode(call("coordinator", "createInvite", { orgId: "orgA" }, user("vol1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "removeMember", { orgId: "orgA", uid: "vol1" }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "removeMember", { orgId: "orgA", uid: "coordA" }, user("coordA")), "CANNOT_REMOVE_OWNER");
    await expect(call("coordinator", "removeMember", { orgId: "orgA", uid: "vol1" }, user("coordA"))).resolves.toEqual({ removed: true });
    await expect(call("coordinator", "removeMember", { orgId: "orgA", uid: "vol1" }, user("coordA"))).resolves.toEqual({ removed: false });
    expect(await memberDoc("orgA", "vol1")).toBeUndefined();
  });
});

describe("admin.verifyOrganization", () => {
  it("verifies, keeps the note private, unhides minors' contacts, and refuses non-admins", async () => {
    await seedInstance("instU", { orgId: "orgU", startMs: BASE_MS + DAY });
    await db.doc(PATHS.privateProfile("minor")).set({ ...profile("Sam", "Lee", MINOR_BIRTH), isMinor: true });
    await seedSignup("instU", "minor", "confirmed");
    await db.collection(COLLECTIONS.signupContacts).doc("instU_minor").set({
      orgId: "orgU", instanceId: "instU", uid: "minor", hidden: true, isMinor: true, frozen: false,
      refreshedAt: tsAt(BASE_MS), createdAt: tsAt(BASE_MS), updatedAt: tsAt(BASE_MS)
    } as unknown as SignupContactDoc);

    await expectCode(call("admin", "verifyOrganization", { orgId: "orgU", verified: true }, user("coordU")), "PERMISSION_DENIED");
    await expect(call("admin", "verifyOrganization", { orgId: "orgU", verified: true, note: "EIN checked" }, adminUser())).resolves.toEqual({ orgId: "orgU", verified: true });
    expect(await orgDoc("orgU")).toMatchObject({ verified: true, verifiedBy: "admin1" });
    expect(JSON.stringify(await orgDoc("orgU"))).not.toContain("EIN checked");
    expect((await db.collection(COLLECTIONS.orgVerificationLog).get()).docs[0]?.data()).toMatchObject({ note: "EIN checked", verified: true });
    expect((await db.collection(COLLECTIONS.instances).doc("instU").get()).data()).toMatchObject({ orgVerified: true });
    expect((await db.collection(COLLECTIONS.signupContacts).doc("instU_minor").get()).data()).toMatchObject({ hidden: false, fullName: "Sam Lee" });

    await call("admin", "verifyOrganization", { orgId: "orgU", verified: false }, adminUser());
    expect(await orgDoc("orgU")).toMatchObject({ verified: false, verifiedAt: null });
    await expectCode(call("admin", "verifyOrganization", { orgId: "missing", verified: true }, adminUser()), "NOT_FOUND");
  });
});
