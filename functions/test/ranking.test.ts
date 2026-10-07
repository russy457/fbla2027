/**
 * ranking.test.ts
 * coordinator.rankVolunteers and coordinator.inviteVolunteers (Tier 2, SPEC
 * 5.2, 8.3, 8.4): only past and discoverable volunteers, minors only at a
 * verified org, people already on the shift left out, no uid or contact in
 * the response, sealed refs that expire after 1 hour and cannot be edited or
 * moved to another org, one shift-invite alert per person, the rate limit,
 * and cross-org plus kiosk-token denial (SPEC 4.4).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS, PATHS, type NotificationDoc, type OpportunityDoc } from "@fbla/shared";
import { BASE_MS, HOUR, call, db, expectCode, kioskUser, resetEmulators, testClock, tsAt, user } from "./harness";
import { seedInstance, seedSignup, seedWorld } from "./fixtures";

interface RankOut {
  candidates: Array<{ ref: string; displayName: string; score: number; why: Array<{ kind: string }> }>;
  refExpiresAt: string;
}

const NOW = tsAt(BASE_MS);

const opportunity = (orgId: string, orgName: string): OpportunityDoc => ({
  orgId,
  orgName,
  orgVerified: orgId !== "orgU",
  title: "Sort food donations",
  description: "Sort and shelve.",
  causeArea: "hunger-food-security",
  type: "one-time",
  skills: ["Lifting"],
  minAge: 13,
  location: null,
  seriesId: null,
  status: "active",
  nextInstanceStart: null,
  createdBy: "coordA",
  createdAt: NOW,
  updatedAt: NOW
});

const setProfile = (uid: string, patch: Record<string, unknown>) => db.doc(PATHS.privateProfile(uid)).update(patch);
const discoverable = { notificationPrefs: { discoverable: true }, interests: ["hunger-food-security"] };

const rank = (instanceId = "inst1", as = user("coordA")) => call<RankOut>("coordinator", "rankVolunteers", { instanceId }, as);
const invite = (refs: string[], instanceId = "inst1", as = user("coordA")) => call<{ sent: number; skipped: number }>("coordinator", "inviteVolunteers", { instanceId, refs }, as);

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
  // Shifts a day out so invites are still allowed after the hour-long ref tests.
  await seedInstance("inst1", { startMs: BASE_MS + 24 * HOUR });
  await seedInstance("instU", { orgId: "orgU", startMs: BASE_MS + 24 * HOUR });
  await seedInstance("instB", { orgId: "orgB", startMs: BASE_MS + 24 * HOUR });
  await seedInstance("past", { startMs: BASE_MS - 48 * HOUR });
  await db.collection(COLLECTIONS.opportunities).doc("opp1").set(opportunity("orgA", "Alamo Community Pantry"));
  // vol1: discoverable, interested. vol2: served orgA before, not discoverable. vol3: neither.
  // minor: discoverable. vol4: discoverable but already on inst1. coordA (the caller): discoverable.
  await Promise.all(["vol1", "minor", "vol4", "coordA"].map((uid) => setProfile(uid, discoverable)));
  await seedSignup("past", "vol2", "completed");
  await seedSignup("inst1", "vol4", "confirmed");
});

describe("coordinator.rankVolunteers", () => {
  it("ranks past and discoverable volunteers with reasons, without uids or contacts", async () => {
    const out = await rank();
    const names = out.candidates.map((candidate) => candidate.displayName);
    expect(names.sort()).toEqual(["Sam L.", "Volunteer1 R.", "Volunteer2 R."]);
    const regular = out.candidates.find((candidate) => candidate.displayName === "Volunteer2 R.");
    expect(regular?.why).toEqual([{ kind: "past-volunteer" }]);
    const fan = out.candidates.find((candidate) => candidate.displayName === "Volunteer1 R.");
    expect(fan?.why).toEqual([{ kind: "interest", causeArea: "hunger-food-security" }]);
    // 0.4 interest match x 0.8 for a new volunteer.
    expect(fan?.score).toBe(0.32);
    expect(Date.parse(out.refExpiresAt)).toBe(BASE_MS + HOUR);
    const wire = JSON.stringify(out);
    for (const secret of ["vol1", "vol2", "minor", "example.test", "2000-01-01"]) expect(wire).not.toContain(secret);
  });

  it("leaves minors (and orgA's past volunteers) out at another, unverified org", async () => {
    const out = await rank("instU", user("coordU"));
    // Discoverable adults only: the minor is hidden, vol2 never served orgU.
    expect(out.candidates.map((candidate) => candidate.displayName).sort()).toEqual(["Olivia O.", "Volunteer1 R.", "Volunteer4 R."]);
  });

  it("ranks a planner draft for the coordinator's org", async () => {
    const draft = { causeArea: "hunger-food-security", skills: [], start: new Date(BASE_MS + 48 * HOUR).toISOString(), end: new Date(BASE_MS + 50 * HOUR).toISOString(), minAge: 16 };
    const out = await call<RankOut>("coordinator", "rankVolunteers", { orgId: "orgA", draft }, user("coordA"));
    // The 15-year-old is under the draft's minimum age; vol4 is not on any draft shift.
    expect(out.candidates.map((candidate) => candidate.displayName).sort()).toEqual(["Volunteer1 R.", "Volunteer2 R.", "Volunteer4 R."]);
    await expectCode(call("coordinator", "rankVolunteers", { orgId: "orgA", draft }, user("coordB")), "PERMISSION_DENIED");
  });

  it("denies other orgs and kiosk tokens", async () => {
    await expectCode(rank("inst1", user("coordB")), "PERMISSION_DENIED");
    await expectCode(rank("inst1", kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(rank("missing"), "NOT_FOUND");
  });
});

describe("coordinator.inviteVolunteers", () => {
  it("sends one shift-invite alert per person and never twice", async () => {
    const { candidates } = await rank();
    const refs = candidates.map((candidate) => candidate.ref);
    await expect(invite(refs)).resolves.toEqual({ sent: 3, skipped: 0 });
    const alert = (await db.doc(PATHS.notificationItem("vol1", "shift-invite_inst1_vol1")).get()).data() as NotificationDoc;
    expect(alert).toMatchObject({ type: "shift-invite", title: "Alamo Community Pantry invited you to Sort food donations", link: "/opportunity/inst1", read: false, data: { instanceId: "inst1" } });

    // A second invite (or the same ref twice) is skipped, and a read alert stays read.
    await db.doc(PATHS.notificationItem("vol1", "shift-invite_inst1_vol1")).update({ read: true });
    await expect(invite([refs[0] ?? "", refs[0] ?? ""])).resolves.toEqual({ sent: 0, skipped: 1 });
    expect(((await db.doc(PATHS.notificationItem("vol1", "shift-invite_inst1_vol1")).get()).data() as NotificationDoc).read).toBe(true);
  });

  it("re-checks eligibility at send time", async () => {
    const { candidates } = await rank();
    const fanRef = candidates.find((candidate) => candidate.displayName === "Volunteer1 R.")?.ref ?? "";
    // vol1 turns discoverable off before the coordinator presses Invite.
    await setProfile("vol1", { notificationPrefs: { discoverable: false } });
    await expect(invite([fanRef])).resolves.toEqual({ sent: 0, skipped: 1 });
  });

  it("refuses expired, edited, and other-org refs", async () => {
    const { candidates } = await rank();
    const ref = candidates[0]?.ref ?? "";
    const flipped = `${ref.slice(0, 20)}${ref.charAt(20) === "A" ? "B" : "A"}${ref.slice(21)}`;
    await expectCode(invite([flipped]), "REF_EXPIRED");
    await expectCode(invite(["not-a-real-ref-at-all"]), "REF_EXPIRED");
    await expectCode(invite([ref], "instB", user("coordB")), "PERMISSION_DENIED");
    testClock.advance(HOUR + 1);
    await expectCode(invite([ref]), "REF_EXPIRED");
  });

  it("denies other orgs, kiosk tokens, started shifts, and too many calls", async () => {
    const { candidates } = await rank();
    const ref = candidates[0]?.ref ?? "";
    await expectCode(invite([ref], "inst1", user("coordB")), "PERMISSION_DENIED");
    await expectCode(invite([ref], "inst1", kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(invite([ref], "past"), "SHIFT_STARTED");
    // The previous call used one attempt; 19 more fill the 20 per hour window.
    for (let attempt = 0; attempt < 19; attempt += 1) await invite([ref]);
    await expectCode(invite([ref]), "RATE_LIMITED");
  });
});
