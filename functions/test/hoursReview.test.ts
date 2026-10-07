/**
 * hoursReview.test.ts
 * Hours review and attendance (SPEC 5.7, SPEC#fn-supersede, G19):
 * approveHours (bulk, one org, 0-minute needsReview logs), rejectHours,
 * setAttendance (every allowed transition, MINUTES_REQUIRED, disputes),
 * submitManualHours, requestAttendanceReview, and the supersedeLetters
 * trigger turning a letter "superseded" when a counted log changes.
 * Coordinator ops: cross-org and kiosk-token denial (SPEC 4.4).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  COLLECTIONS,
  PATHS,
  type HoursLogDoc,
  type LetterDoc,
  type LetterRefDoc,
  type LetterVerificationDoc,
  type SignupDoc
} from "@fbla/shared";
import { BASE_MS, HOUR, call, db, expectCode, kioskUser, makeDeps, resetEmulators, testClock, tsAt, user } from "./harness";
import { seedInstance, seedSignup, seedWorld } from "./fixtures";
import { countedLogChanged, supersedeLettersForLog } from "../src/triggers/supersedeLetters";

const DAY = 24 * HOUR;
const NONCE = "66666666-6666-4666-8666-666666666666";
const PAST_START = BASE_MS - 3 * DAY;

const seedLog = (id: string, extra: Partial<HoursLogDoc> = {}) => {
  const log: HoursLogDoc = {
    uid: "vol1", orgId: "orgA", instanceId: "past", signupId: id, source: "finalize", date: tsAt(PAST_START), minutes: 120,
    status: "pending", needsReview: true, description: null, reviewedBy: null, reviewedAt: null, rejectReason: null,
    createdAt: tsAt(BASE_MS), updatedAt: tsAt(BASE_MS), ...extra
  };
  return db.collection(COLLECTIONS.hoursLogs).doc(id).set(log);
};
const logDoc = async (id: string) => (await db.collection(COLLECTIONS.hoursLogs).doc(id).get()).data() as HoursLogDoc;
const signupDoc = async (id: string) => (await db.collection(COLLECTIONS.signups).doc(id).get()).data() as SignupDoc;

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
  await seedInstance("past", { startMs: PAST_START, durationMs: 4 * HOUR, status: "finalized" });
});

describe("coordinator.approveHours / rejectHours", () => {
  it("approves pending logs (including 0-minute reviews), skipping approved ones", async () => {
    await seedLog("a", { minutes: 0 });
    await seedLog("b");
    await seedLog("c", { status: "approved", needsReview: false });
    await expect(call("coordinator", "approveHours", { logIds: ["a", "b", "c"] }, user("coordA"))).resolves.toEqual({ approved: 2, skipped: 1 });
    expect(await logDoc("a")).toMatchObject({ status: "approved", needsReview: false, reviewedBy: "coordA" });
  });

  it("refuses rejected logs, mixed orgs, other orgs, and kiosk tokens", async () => {
    await seedLog("a");
    await seedLog("r", { status: "rejected" });
    await seedLog("b", { orgId: "orgB" });
    await expectCode(call("coordinator", "approveHours", { logIds: ["a", "r"] }, user("coordA")), "INVALID_TRANSITION");
    await expectCode(call("coordinator", "approveHours", { logIds: ["a", "b"] }, user("coordA")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "approveHours", { logIds: ["a"] }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "approveHours", { logIds: ["a"] }, kioskUser("past")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "approveHours", { logIds: ["missing"] }, user("coordA")), "NOT_FOUND");
  });

  it("rejects a pending log with a reason; approved logs only change through setAttendance", async () => {
    await seedLog("a");
    await seedLog("ok", { status: "approved" });
    await expect(call("coordinator", "rejectHours", { logId: "a", reason: "Not on the roster" }, user("coordA"))).resolves.toEqual({ logId: "a", alreadyRejected: false });
    expect(await logDoc("a")).toMatchObject({ status: "rejected", rejectReason: "Not on the roster" });
    await expect(call("coordinator", "rejectHours", { logId: "a", reason: "again" }, user("coordA"))).resolves.toMatchObject({ alreadyRejected: true });
    await expectCode(call("coordinator", "rejectHours", { logId: "ok", reason: "nope" }, user("coordA")), "INVALID_TRANSITION");
    await expectCode(call("coordinator", "rejectHours", { logId: "a", reason: "x" }, user("coordA")), "INVALID_INPUT");
    await expectCode(call("coordinator", "rejectHours", { logId: "ok", reason: "nope" }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "rejectHours", { logId: "ok", reason: "nope" }, kioskUser("past")), "PERMISSION_DENIED");
  });
});

describe("coordinator.setAttendance", () => {
  it("no-show -> completed writes an approved coordinator log; completed -> no-show rejects it", async () => {
    await seedSignup("past", "vol1", "no-show");
    await expectCode(call("coordinator", "setAttendance", { signupId: "past_vol1", to: "completed", note: "Was there" }, user("coordA")), "MINUTES_REQUIRED");
    await expectCode(call("coordinator", "setAttendance", { signupId: "past_vol1", to: "completed", minutes: 300, note: "Was there" }, user("coordA")), "INVALID_INPUT");
    const done = await call("coordinator", "setAttendance", { signupId: "past_vol1", to: "completed", minutes: 180, note: "Was there" }, user("coordA"));
    expect(done).toEqual({ status: "completed", logId: "past_vol1", changed: true });
    expect(await logDoc("past_vol1")).toMatchObject({ source: "coordinator", status: "approved", minutes: 180 });
    expect(await signupDoc("past_vol1")).toMatchObject({ status: "completed", attendance: { by: "coordA", note: "Was there" } });

    await call("coordinator", "setAttendance", { signupId: "past_vol1", to: "no-show", note: "Left early, wrong person" }, user("coordA"));
    expect(await logDoc("past_vol1")).toMatchObject({ status: "rejected", rejectReason: "attendance-changed" });
    expect((await signupDoc("past_vol1")).history.map((entry) => entry.to)).toEqual(["completed", "no-show"]);
  });

  it("excuses a no-show, keeps a disputed one, refuses other moves, and is a no-op on the same status", async () => {
    await seedSignup("past", "vol1", "no-show");
    await seedSignup("past", "vol2", "no-show", { disputeOpen: true, dispute: { note: "I was there", openedAt: tsAt(BASE_MS), resolvedAt: null, resolvedBy: null } });
    await seedSignup("past", "vol3", "confirmed");
    await call("coordinator", "setAttendance", { signupId: "past_vol1", to: "excused", note: "Sick" }, user("coordA"));
    expect(await signupDoc("past_vol1")).toMatchObject({ status: "excused", excuseReason: "coordinator" });
    await expectCode(call("coordinator", "setAttendance", { signupId: "past_vol1", to: "keep", note: "n/a" }, user("coordA")), "INVALID_TRANSITION");

    await call("coordinator", "setAttendance", { signupId: "past_vol2", to: "keep", note: "Checked the log" }, user("coordA"));
    expect(await signupDoc("past_vol2")).toMatchObject({ status: "no-show", disputeOpen: false, dispute: { resolvedBy: "coordA" } });
    await expectCode(call("coordinator", "setAttendance", { signupId: "past_vol3", to: "completed", minutes: 60, note: "nope" }, user("coordA")), "INVALID_TRANSITION");
    await expect(call("coordinator", "setAttendance", { signupId: "past_vol2", to: "no-show", note: "same" }, user("coordA"))).resolves.toMatchObject({ changed: false });
    await expectCode(call("coordinator", "setAttendance", { signupId: "past_vol2", to: "excused", note: "x y" }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "setAttendance", { signupId: "past_vol2", to: "excused", note: "x y" }, kioskUser("past")), "PERMISSION_DENIED");
  });
});

describe("volunteer.submitManualHours and requestAttendanceReview", () => {
  const manual = { orgId: "orgB", date: "2026-10-01", minutes: 90, description: "Sorted books at the fair", requestNonce: NONCE };

  it("records a pending manual log once per nonce with the volunteer's display name", async () => {
    const out = await call<{ logId: string }>("volunteer", "submitManualHours", manual, user("vol1"));
    expect(out.logId).toMatch(/^manual_[0-9a-f]{64}$/);
    expect(await logDoc(out.logId)).toMatchObject({ source: "manual", status: "pending", minutes: 90, orgId: "orgB", displayName: "Volunteer1 R.", instanceId: null });
    await expect(call("volunteer", "submitManualHours", manual, user("vol1"))).resolves.toEqual(out);
  });

  it("refuses future and too-old dates, odd minutes, and unknown orgs", async () => {
    await expectCode(call("volunteer", "submitManualHours", { ...manual, date: "2026-10-18" }, user("vol1")), "DATE_OUT_OF_RANGE");
    await expectCode(call("volunteer", "submitManualHours", { ...manual, date: "2025-10-16" }, user("vol1")), "DATE_OUT_OF_RANGE");
    await expectCode(call("volunteer", "submitManualHours", { ...manual, minutes: 20 }, user("vol1")), "INVALID_INPUT");
    await expectCode(call("volunteer", "submitManualHours", { ...manual, orgId: "nope" }, user("vol1")), "NOT_FOUND");
  });

  it("opens a dispute on a recent no-show only, within 30 days", async () => {
    await seedSignup("past", "vol1", "no-show");
    await seedSignup("past", "vol2", "completed");
    await expectCode(call("volunteer", "requestAttendanceReview", { signupId: "past_vol1", note: "I signed the paper list" }, user("vol2")), "PERMISSION_DENIED");
    await expectCode(call("volunteer", "requestAttendanceReview", { signupId: "past_vol2", note: "I signed the paper list" }, user("vol2")), "INVALID_TRANSITION");
    await expect(call("volunteer", "requestAttendanceReview", { signupId: "past_vol1", note: "I signed the paper list" }, user("vol1"))).resolves.toEqual({ disputeOpen: true });
    expect(await signupDoc("past_vol1")).toMatchObject({ disputeOpen: true, dispute: { note: "I signed the paper list", resolvedAt: null } });
    await expect(call("volunteer", "requestAttendanceReview", { signupId: "past_vol1", note: "I signed the paper list" }, user("vol1"))).resolves.toEqual({ disputeOpen: true });

    await seedSignup("past", "vol3", "no-show");
    testClock.advance(40 * DAY);
    await expectCode(call("volunteer", "requestAttendanceReview", { signupId: "past_vol3", note: "Too late to ask now" }, user("vol3")), "DISPUTE_WINDOW_CLOSED");
  });
});

describe("supersedeLetters trigger (SPEC#fn-supersede, G19)", () => {
  const SCOPE = { orgId: "ALL", from: "2026-01-01", to: "2026-10-17" };

  it("only status or minutes changes count", () => {
    const log = { status: "approved" as const, minutes: 60 };
    expect(countedLogChanged(log, { ...log })).toBe(false);
    expect(countedLogChanged(log, { ...log, minutes: 45 })).toBe(true);
    expect(countedLogChanged(log, { ...log, status: "rejected" })).toBe(true);
    expect(countedLogChanged(null, log)).toBe(true);
  });

  it("setAttendance on a counted log supersedes the letter, its refs, and the projection, without touching the evidence", async () => {
    await seedSignup("past", "vol1", "completed");
    await seedLog("past_vol1", { status: "approved", needsReview: false, source: "kiosk", minutes: 240 });
    const issued = await call<{ letterId: string; verifyCode: string }>("volunteer", "issueLetter", { scope: SCOPE, requestNonce: NONCE }, user("vol1"));

    await call("coordinator", "setAttendance", { signupId: "past_vol1", to: "no-show", note: "Was not there" }, user("coordA"));
    const changed = await supersedeLettersForLog(makeDeps(), "past_vol1", { status: "approved", minutes: 240 }, { status: "rejected", minutes: 240 }, BASE_MS);
    expect(changed).toBe(1);

    const letter = (await db.collection(COLLECTIONS.letters).doc(issued.letterId).get()).data() as LetterDoc;
    expect(letter).toMatchObject({ status: "superseded", supersededReason: "hours-changed", supersededBy: null });
    expect(letter.evidence.totalMinutes).toBe(240);
    const projection = (await db.collection(COLLECTIONS.letterVerifications).doc(issued.verifyCode).get()).data() as LetterVerificationDoc;
    expect(projection).toMatchObject({ status: "superseded", supersededByIssuedAt: null });
    expect(((await db.doc(PATHS.letterRef("orgA", issued.letterId)).get()).data() as LetterRefDoc).status).toBe("superseded");

    // Running again finds no valid letter: bounded and idempotent.
    expect(await supersedeLettersForLog(makeDeps(), "past_vol1", { status: "approved", minutes: 240 }, { status: "rejected", minutes: 240 }, BASE_MS)).toBe(0);
  });

  it("ignores unchanged logs and leaves revoked letters alone", async () => {
    await seedLog("x", { status: "approved", needsReview: false, minutes: 60 });
    const issued = await call<{ letterId: string }>("volunteer", "issueLetter", { scope: SCOPE, requestNonce: NONCE }, user("vol1"));
    expect(await supersedeLettersForLog(makeDeps(), "x", { status: "approved", minutes: 60 }, { status: "approved", minutes: 60 }, BASE_MS)).toBe(0);
    await call("coordinator", "revokeLetter", { letterId: issued.letterId, reason: "duplicate" }, user("coordA"));
    expect(await supersedeLettersForLog(makeDeps(), "x", { status: "approved", minutes: 60 }, { status: "approved", minutes: 30 }, BASE_MS)).toBe(0);
    expect(((await db.collection(COLLECTIONS.letters).doc(issued.letterId).get()).data() as LetterDoc).status).toBe("revoked");
  });
});
