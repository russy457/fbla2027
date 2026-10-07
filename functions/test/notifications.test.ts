/**
 * notifications.test.ts
 * In-app alerts from the coordinator and admin ops (SPEC 8.3, SPEC 3.15):
 * shift-cancelled (cancelInstance), shift-changed and waitlist-promoted
 * (updateInstance), hours-approved / hours-rejected, attendance-changed
 * (setAttendance), dispute-opened (to every org coordinator),
 * letter-superseded (supersedeLetters trigger), and letter-revoked. Each
 * alert has a deterministic id, so a repeated call rewrites one item instead
 * of sending a second. verifyOrganization has no SPEC 8.3 type and sends none.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  COLLECTIONS,
  PATHS,
  notificationIdFor,
  type HoursLogDoc,
  type InstanceDoc,
  type MemberDoc,
  type NotificationDoc,
  type NotificationType,
  type SignupDoc
} from "@fbla/shared";
import { readDoc } from "../src/lib/firestore";
import { supersedeLettersForLog } from "../src/triggers/supersedeLetters";
import { BASE_MS, HOUR, adminUser, call, db, makeDeps, resetEmulators, tsAt, user } from "./harness";
import { seedInstance, seedSignup, seedWorld } from "./fixtures";

const DAY = 24 * HOUR;
const LATER_MS = BASE_MS + 2 * DAY;
const PAST_START = BASE_MS - 3 * DAY;
const NONCE = "77777777-7777-4777-8777-777777777777";
const SCOPE = { orgId: "ALL", from: "2026-01-01", to: "2026-10-17" };

const item = async (uid: string, type: NotificationType, key: string) =>
  readDoc<NotificationDoc>(await db.doc(PATHS.notificationItem(uid, notificationIdFor(type, key))).get());
const inbox = async (uid: string) => (await db.collection(PATHS.notificationItems(uid)).get()).docs.map((doc) => doc.data() as NotificationDoc);

const seedLog = (id: string, extra: Partial<HoursLogDoc> = {}) => {
  const log: HoursLogDoc = {
    uid: "vol1", orgId: "orgA", instanceId: "past", signupId: id, source: "finalize", date: tsAt(PAST_START), minutes: 150,
    status: "pending", needsReview: true, description: null, reviewedBy: null, reviewedAt: null, rejectReason: null,
    createdAt: tsAt(BASE_MS), updatedAt: tsAt(BASE_MS), ...extra
  };
  return db.collection(COLLECTIONS.hoursLogs).doc(id).set(log);
};

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
});

describe("cancelInstance", () => {
  it("sends shift-cancelled to each cancelled signup, once", async () => {
    await seedInstance("inst1", { startMs: LATER_MS, signupCount: 1 });
    await seedSignup("inst1", "vol1", "confirmed");
    await seedSignup("inst1", "vol2", "waitlisted");
    await seedSignup("inst1", "vol3", "cancelled");
    await call("coordinator", "cancelInstance", { instanceId: "inst1", reason: "Storm warning" }, user("coordA"));

    const alert = await item("vol1", "shift-cancelled", "inst1_vol1");
    expect(alert).toMatchObject({ read: false, link: "/opportunity/inst1", data: { instanceId: "inst1", signupId: "inst1_vol1" } });
    expect(alert?.title).toBe("Sort food donations on Oct 19 was cancelled by the organization");
    expect(await item("vol2", "shift-cancelled", "inst1_vol2")).not.toBeNull();
    expect(await inbox("vol3")).toHaveLength(0);

    await call("coordinator", "cancelInstance", { instanceId: "inst1", reason: "Storm warning" }, user("coordA"));
    expect(await inbox("vol1")).toHaveLength(1);
  });
});

describe("updateInstance", () => {
  it("a capacity increase before the cutoff promotes as many waitlisted people as new seats allow", async () => {
    await seedInstance("inst1", { startMs: LATER_MS, capacity: 3 });
    // vol1-3 take the seats; vol4-6 wait in seq order.
    for (const uid of ["vol1", "vol2", "vol3", "vol4", "vol5", "vol6"]) await call("volunteer", "signup", { instanceId: "inst1" }, user(uid));
    const instanceRef = db.collection(COLLECTIONS.instances).doc("inst1");

    const out = await call<{ promoted: string[] }>("coordinator", "updateInstance", { instanceId: "inst1", capacity: 5 }, user("coordA"));
    expect(out.promoted).toEqual(["inst1_vol4", "inst1_vol5"]);
    const instance = (await instanceRef.get()).data() as InstanceDoc;
    expect(instance).toMatchObject({ capacity: 5, signupCount: 5 });
    expect(instance.waitlist.map((entry) => entry.uid)).toEqual(["vol6"]);
    const promoted = (await db.collection(COLLECTIONS.signups).doc("inst1_vol4").get()).data() as SignupDoc;
    expect(promoted).toMatchObject({ status: "confirmed", waitlistSeq: null });
    expect(promoted.promotedAt?.toMillis()).toBe(BASE_MS);
    expect(promoted.history.at(-1)).toMatchObject({ from: "waitlisted", to: "confirmed", actor: "coordA", op: "updateInstance" });
    expect(await item("vol5", "waitlist-promoted", "inst1_vol5")).toMatchObject({ read: false, link: "/opportunity/inst1" });
    expect(await item("vol6", "waitlist-promoted", "inst1_vol6")).toBeNull();
  });

  it("a capacity increase after the cutoff promotes no one (the seats go to walk-ups)", async () => {
    await seedInstance("inst1", { startMs: LATER_MS, capacity: 1 });
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol2"));
    // Move the shift so the cutoff has passed, then raise capacity.
    await call("coordinator", "updateInstance", { instanceId: "inst1", start: new Date(BASE_MS + HOUR).toISOString(), end: new Date(BASE_MS + 3 * HOUR).toISOString() }, user("coordA"));
    const out = await call<{ promoted: string[] }>("coordinator", "updateInstance", { instanceId: "inst1", capacity: 3 }, user("coordA"));
    expect(out.promoted).toEqual([]);
    expect(((await db.collection(COLLECTIONS.signups).doc("inst1_vol2").get()).data() as SignupDoc).status).toBe("waitlisted");
  });

  it("a time change sends shift-changed to active signups, one per change", async () => {
    await seedInstance("inst1", { startMs: LATER_MS, signupCount: 1 });
    await seedSignup("inst1", "vol1", "confirmed");
    await seedSignup("inst1", "vol2", "cancelled");
    const start = LATER_MS + DAY;
    const out = await call<{ sequence: number }>("coordinator", "updateInstance", { instanceId: "inst1", start: new Date(start).toISOString(), end: new Date(start + 2 * HOUR).toISOString() }, user("coordA"));
    const alert = await item("vol1", "shift-changed", `inst1_vol1_${out.sequence}`);
    expect(alert?.title).toContain("Sort food donations moved to Tue, Oct 20");
    expect(await inbox("vol2")).toHaveLength(0);
    await call("coordinator", "updateInstance", { instanceId: "inst1", capacity: 5 }, user("coordA"));
    expect(await inbox("vol1")).toHaveLength(1);
  });
});

describe("hours review", () => {
  beforeEach(async () => {
    await seedInstance("past", { startMs: PAST_START, status: "finalized" });
  });

  it("approveHours sends hours-approved per log with the org name; a retry adds nothing", async () => {
    await seedLog("a");
    await seedLog("zero", { minutes: 0, uid: "vol2" });
    await call("coordinator", "approveHours", { logIds: ["a", "zero"] }, user("coordA"));
    expect(await item("vol1", "hours-approved", "a")).toMatchObject({ title: "2.5 hours approved at Common Table Pantry", link: "/impact" });
    expect(await inbox("vol2")).toHaveLength(0);
    await call("coordinator", "approveHours", { logIds: ["a"] }, user("coordA"));
    expect(await inbox("vol1")).toHaveLength(1);
  });

  it("rejectHours sends hours-rejected with the reason", async () => {
    await seedLog("a");
    await call("coordinator", "rejectHours", { logId: "a", reason: "Not on the roster" }, user("coordA"));
    expect(await item("vol1", "hours-rejected", "a")).toMatchObject({ title: "Hours at Common Table Pantry were not approved: Not on the roster" });
  });

  it("setAttendance sends attendance-changed, also when only closing a dispute; a no-op sends nothing", async () => {
    await seedSignup("past", "vol1", "no-show");
    await call("coordinator", "setAttendance", { signupId: "past_vol1", to: "excused", note: "Sick" }, user("coordA"));
    expect(await item("vol1", "attendance-changed", "past_vol1")).toMatchObject({ title: "Your attendance for Sort food donations was updated", link: "/me/shifts" });

    await seedSignup("past", "vol2", "no-show", { disputeOpen: true, dispute: { note: "I was there", openedAt: tsAt(BASE_MS), resolvedAt: null, resolvedBy: null } });
    await call("coordinator", "setAttendance", { signupId: "past_vol2", to: "keep", note: "Checked the log" }, user("coordA"));
    expect(await item("vol2", "attendance-changed", "past_vol2")).not.toBeNull();

    await seedSignup("past", "vol3", "no-show");
    await call("coordinator", "setAttendance", { signupId: "past_vol3", to: "no-show", note: "same" }, user("coordA"));
    expect(await inbox("vol3")).toHaveLength(0);
  });

  it("requestAttendanceReview sends dispute-opened to every coordinator of the org", async () => {
    const helper: MemberDoc = {
      uid: "vol8", orgId: "orgA", role: "coordinator", displayName: "Volunteer8 R.", canViewContacts: true, invitedBy: "coordA",
      joinedAt: tsAt(BASE_MS), createdAt: tsAt(BASE_MS), updatedAt: tsAt(BASE_MS)
    };
    await db.doc(PATHS.member("orgA", "vol8")).set(helper);
    await seedSignup("past", "vol1", "no-show", { displayName: "Volunteer1 R." });
    await call("volunteer", "requestAttendanceReview", { signupId: "past_vol1", note: "I signed the paper list" }, user("vol1"));
    for (const uid of ["coordA", "vol8"]) {
      expect(await item(uid, "dispute-opened", "past_vol1")).toMatchObject({ title: "Volunteer1 R. asked for a review of Sort food donations", link: "/org/orgA/dashboard" });
    }
    expect(await inbox("coordB")).toHaveLength(0);
  });
});

describe("letters", () => {
  beforeEach(async () => {
    await seedInstance("past", { startMs: PAST_START, status: "finalized" });
    await seedSignup("past", "vol1", "completed");
    await seedLog("past_vol1", { status: "approved", needsReview: false, source: "kiosk", minutes: 240 });
  });

  it("the supersede trigger sends letter-superseded, once", async () => {
    const issued = await call<{ letterId: string }>("volunteer", "issueLetter", { scope: SCOPE, requestNonce: NONCE }, user("vol1"));
    await supersedeLettersForLog(makeDeps(), "past_vol1", { status: "approved", minutes: 240 }, { status: "rejected", minutes: 240 }, BASE_MS);
    expect(await item("vol1", "letter-superseded", issued.letterId)).toMatchObject({ title: "Your letter's hours changed", data: { letterId: issued.letterId } });
    await supersedeLettersForLog(makeDeps(), "past_vol1", { status: "approved", minutes: 240 }, { status: "rejected", minutes: 240 }, BASE_MS);
    expect(await inbox("vol1")).toHaveLength(1);
  });

  it("revokeLetter sends letter-revoked", async () => {
    const issued = await call<{ letterId: string }>("volunteer", "issueLetter", { scope: SCOPE, requestNonce: NONCE }, user("vol1"));
    await call("coordinator", "revokeLetter", { letterId: issued.letterId, reason: "duplicate" }, adminUser());
    expect(await item("vol1", "letter-revoked", issued.letterId)).toMatchObject({ title: "A letter was revoked", link: "/impact" });
  });
});

describe("verifyOrganization", () => {
  it("has no SPEC 8.3 alert type, so it writes no notification", async () => {
    await call("admin", "verifyOrganization", { orgId: "orgU", verified: true, note: "EIN checked" }, adminUser());
    expect(await inbox("coordU")).toHaveLength(0);
  });
});
