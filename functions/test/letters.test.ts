/**
 * letters.test.ts
 * volunteer.issueLetter and coordinator.revokeLetter (SPEC#fn-issueletter,
 * SPEC#fn-revokeletter, G19): evidence snapshot, public projection, letterRefs,
 * the PDF in Storage, same-nonce idempotency, NO_APPROVED_HOURS, unverified
 * exclusion, reissue supersedes, snapshot frozen against later log edits,
 * and revocation permissions.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  COLLECTIONS,
  PATHS,
  type HoursLogDoc,
  type LetterDoc,
  type LetterRefDoc,
  type LetterVerificationDoc
} from "@fbla/shared";
import { BASE_MS, adminUser, call, db, expectCode, kioskUser, resetEmulators, storage, tsAt, user } from "./harness";
import { seedWorld } from "./fixtures";

const NONCE_1 = "11111111-1111-4111-8111-111111111111";
const NONCE_2 = "22222222-2222-4222-8222-222222222222";
const SCOPE = { orgId: "ALL", from: "2026-01-01", to: "2026-10-17" };
const DAY = 86_400_000;

const seedLog = (id: string, uid: string, orgId: string, minutes: number, status: HoursLogDoc["status"] = "approved") => {
  const log: HoursLogDoc = {
    uid,
    orgId,
    instanceId: null,
    signupId: null,
    source: "kiosk",
    date: tsAt(BASE_MS - 10 * DAY),
    minutes,
    status,
    needsReview: false,
    description: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectReason: null,
    createdAt: tsAt(BASE_MS),
    updatedAt: tsAt(BASE_MS)
  };
  return db.collection(COLLECTIONS.hoursLogs).doc(id).set(log);
};

const letter = async (id: string) => (await db.collection(COLLECTIONS.letters).doc(id).get()).data() as LetterDoc;
const verification = async (code: string) => (await db.collection(COLLECTIONS.letterVerifications).doc(code).get()).data() as LetterVerificationDoc;

type IssueResult = { letterId: string; verifyCode: string; pdfStatus: string; totalMinutes: number; excludedUnverifiedMinutes: number };

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
  await seedLog("logA1", "vol1", "orgA", 240);
  await seedLog("logA2", "vol1", "orgA", 495);
  await seedLog("logB1", "vol1", "orgB", 360);
  await seedLog("logU1", "vol1", "orgU", 120); // unverified org: excluded
  await seedLog("logP1", "vol1", "orgA", 60, "pending"); // not approved: ignored
});

describe("volunteer.issueLetter", () => {
  it("freezes the evidence, writes the public projection and refs, and stores the PDF", async () => {
    const result = await call<IssueResult>("volunteer", "issueLetter", { scope: SCOPE, requestNonce: NONCE_1 }, user("vol1"));
    expect(result).toMatchObject({ pdfStatus: "ready", totalMinutes: 1095, excludedUnverifiedMinutes: 120 });
    expect(result.letterId).toMatch(/^[0-9a-f]{32}$/);
    expect(result.verifyCode).toMatch(/^[A-Z2-7]{26}$/);

    const saved = await letter(result.letterId);
    expect(saved).toMatchObject({ uid: "vol1", displayName: "Volunteer1 R.", status: "valid", scopeKey: "ALL:2026-01-01:2026-10-17", pdfStatus: "ready" });
    expect(saved.evidence.logIds).toEqual(["logA1", "logA2", "logB1"]);
    expect(saved.evidence).toMatchObject({ totalMinutes: 1095, excludedUnverifiedMinutes: 120, excludedUnverifiedCount: 1 });
    expect(saved.orgIds.sort()).toEqual(["orgA", "orgB"]);

    expect(await verification(result.verifyCode)).toMatchObject({
      displayName: "Volunteer1 R.",
      orgNames: ["Common Table Pantry", "Open Book Bank"],
      totalMinutes: 1095,
      status: "valid",
      revokeReasonLabel: null
    });
    const ref = (await db.doc(PATHS.letterRef("orgA", result.letterId)).get()).data() as LetterRefDoc;
    expect(ref).toMatchObject({ uid: "vol1", minutesForOrg: 735, status: "valid" });
    expect((await db.doc(PATHS.letterRef("orgU", result.letterId)).get()).exists).toBe(false);

    const [bytes] = await storage.bucket("demo-fbla2027.appspot.com").file(saved.pdfPath).download();
    expect(saved.pdfPath).toBe(`letters/vol1/${result.letterId}.pdf`);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("the same nonce returns the same letter (one letter, one projection)", async () => {
    const first = await call<IssueResult>("volunteer", "issueLetter", { scope: SCOPE, requestNonce: NONCE_1 }, user("vol1"));
    const again = await call<IssueResult>("volunteer", "issueLetter", { scope: SCOPE, requestNonce: NONCE_1 }, user("vol1"));
    expect(again).toEqual(first);
    expect((await db.collection(COLLECTIONS.letters).where("uid", "==", "vol1").get()).size).toBe(1);
    expect((await db.collection(COLLECTIONS.letterVerifications).get()).size).toBe(1);
  });

  it("a new nonce for the same scope supersedes the older letter", async () => {
    const first = await call<IssueResult>("volunteer", "issueLetter", { scope: SCOPE, requestNonce: NONCE_1 }, user("vol1"));
    const second = await call<IssueResult>("volunteer", "issueLetter", { scope: SCOPE, requestNonce: NONCE_2 }, user("vol1"));
    expect(second.letterId).not.toBe(first.letterId);
    expect(await letter(first.letterId)).toMatchObject({ status: "superseded", supersededBy: second.letterId, supersededReason: "reissued" });
    expect((await verification(first.verifyCode)).status).toBe("superseded");
    expect((await verification(first.verifyCode)).supersededByIssuedAt).not.toBeNull();
    expect(((await db.doc(PATHS.letterRef("orgA", first.letterId)).get()).data() as LetterRefDoc).status).toBe("superseded");
    expect((await letter(second.letterId)).status).toBe("valid");
  });

  it("keeps the snapshot unchanged when a counted log changes later (G19)", async () => {
    const issued = await call<IssueResult>("volunteer", "issueLetter", { scope: SCOPE, requestNonce: NONCE_1 }, user("vol1"));
    await db.collection(COLLECTIONS.hoursLogs).doc("logA1").update({ minutes: 15 });
    expect((await letter(issued.letterId)).evidence.totalMinutes).toBe(1095);
  });

  it("scopes to one org, and refuses a range with no approved verified hours", async () => {
    const scoped = await call<IssueResult>("volunteer", "issueLetter", { scope: { ...SCOPE, orgId: "orgB" }, requestNonce: NONCE_1 }, user("vol1"));
    expect(scoped.totalMinutes).toBe(360);
    await expectCode(call("volunteer", "issueLetter", { scope: { ...SCOPE, orgId: "orgU" }, requestNonce: NONCE_2 }, user("vol1")), "NO_APPROVED_HOURS");
    await expectCode(call("volunteer", "issueLetter", { scope: SCOPE, requestNonce: NONCE_1 }, user("vol2")), "NO_APPROVED_HOURS");
  });

  it("validates the range: ordered, not in the future, at most 4 years", async () => {
    const bad = [
      { ...SCOPE, from: "2026-10-01", to: "2026-09-01" },
      { ...SCOPE, to: "2026-10-18" },
      { ...SCOPE, from: "2022-10-16" }
    ];
    for (const scope of bad) {
      await expectCode(call("volunteer", "issueLetter", { scope, requestNonce: NONCE_1 }, user("vol1")), "INVALID_INPUT");
    }
  });
});

describe("coordinator.revokeLetter", () => {
  const issue = () => call<IssueResult>("volunteer", "issueLetter", { scope: SCOPE, requestNonce: NONCE_1 }, user("vol1"));

  it("an owner of a counted org revokes; /verify shows only the label", async () => {
    const issued = await issue();
    const result = await call("coordinator", "revokeLetter", { letterId: issued.letterId, reason: "hours-disputed", note: "private detail" }, user("coordB"));
    expect(result).toEqual({ letterId: issued.letterId, alreadyRevoked: false });
    expect(await letter(issued.letterId)).toMatchObject({ status: "revoked", revokedBy: "coordB", revokeReason: "hours-disputed", revokeNote: "private detail" });
    const projection = await verification(issued.verifyCode);
    expect(projection).toMatchObject({ status: "revoked", revokeReasonLabel: "Hours disputed" });
    expect(JSON.stringify(projection)).not.toContain("private detail");
    expect(((await db.doc(PATHS.letterRef("orgA", issued.letterId)).get()).data() as LetterRefDoc).status).toBe("revoked");
    await expect(call("coordinator", "revokeLetter", { letterId: issued.letterId, reason: "other" }, adminUser())).resolves.toEqual({
      letterId: issued.letterId,
      alreadyRevoked: true
    });
  });

  it("owners of uncounted orgs, the volunteer, and kiosk tokens are denied; admins may revoke", async () => {
    const issued = await issue();
    await expectCode(call("coordinator", "revokeLetter", { letterId: issued.letterId, reason: "other" }, user("coordU")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "revokeLetter", { letterId: issued.letterId, reason: "other" }, user("vol1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "revokeLetter", { letterId: issued.letterId, reason: "other" }, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "revokeLetter", { letterId: "0".repeat(32), reason: "other" }, adminUser()), "NOT_FOUND");
    await expect(call("coordinator", "revokeLetter", { letterId: issued.letterId, reason: "duplicate" }, adminUser())).resolves.toMatchObject({ alreadyRevoked: false });
  });
});
