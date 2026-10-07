/**
 * inbox.test.ts
 * volunteer.markNotificationsRead (SPEC 5.2) and the Tier 1 parts of
 * recomputeVolunteerStats (SPEC#fn-stats, SPEC 7.2): reliability on the
 * private profile, contact snapshot refresh (open, upcoming, non-frozen
 * only), the isMinor cache and member canViewContacts, streakWeeks, and
 * write-only-on-change (G1 bounded).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  COLLECTIONS,
  PATHS,
  waitlistPromotedNotification,
  type PrivateProfileDoc,
  type SignupContactDoc,
  type UserPublicDoc
} from "@fbla/shared";
import { queueNotification } from "../src/notifications/notify";
import { recomputeStatsForUid } from "../src/triggers/recomputeVolunteerStats";
import { recomputeReliabilityForUid } from "../src/triggers/reliabilityStats";
import { BASE_MS, HOUR, call, db, expectCode, kioskUser, makeDeps, resetEmulators, testClock, tsAt, user } from "./harness";
import { seedInstance, seedSignup, seedWorld } from "./fixtures";

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
});

const DAY = 24 * HOUR;

const seedAlerts = async (uid: string, count: number): Promise<string[]> => {
  const batch = db.batch();
  const ids = Array.from({ length: count }, (_, index) => `inst${index}_${uid}`);
  ids.forEach((key, index) =>
    queueNotification(
      batch,
      db,
      uid,
      waitlistPromotedNotification({ instanceId: `inst${index}`, title: "Shift", orgName: "Org", startMs: BASE_MS, timeZone: "America/Chicago" }),
      key,
      BASE_MS
    )
  );
  await batch.commit();
  return ids.map((key) => `waitlist-promoted_${key}`);
};

const unreadCount = async (uid: string) => (await db.collection(PATHS.notificationItems(uid)).where("read", "==", false).get()).size;

describe("volunteer.markNotificationsRead", () => {
  it("marks chosen items, skips missing and already-read ones", async () => {
    const ids = await seedAlerts("vol1", 3);
    await expect(call("volunteer", "markNotificationsRead", { itemIds: [ids[0], "missing"] }, user("vol1"))).resolves.toEqual({ updated: 1 });
    await expect(call("volunteer", "markNotificationsRead", { itemIds: [ids[0]] }, user("vol1"))).resolves.toEqual({ updated: 0 });
    expect(await unreadCount("vol1")).toBe(2);
  });

  it("marks everything unread with all: true", async () => {
    await seedAlerts("vol1", 5);
    await expect(call("volunteer", "markNotificationsRead", { all: true }, user("vol1"))).resolves.toEqual({ updated: 5 });
    expect(await unreadCount("vol1")).toBe(0);
  });

  it("only ever touches the caller's own items", async () => {
    const ids = await seedAlerts("vol2", 1);
    await expect(call("volunteer", "markNotificationsRead", { itemIds: ids }, user("vol1"))).resolves.toEqual({ updated: 0 });
    expect(await unreadCount("vol2")).toBe(1);
  });

  it("refuses bad input, incomplete profiles, and kiosk tokens", async () => {
    await expectCode(call("volunteer", "markNotificationsRead", {}, user("vol1")), "INVALID_INPUT");
    await expectCode(call("volunteer", "markNotificationsRead", { all: true, itemIds: ["a"] }, user("vol1")), "INVALID_INPUT");
    await expectCode(call("volunteer", "markNotificationsRead", { all: true }, user("incomplete")), "PROFILE_INCOMPLETE");
    await expectCode(call("volunteer", "markNotificationsRead", { all: true }, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("volunteer", "markNotificationsRead", { all: true }, undefined), "AUTH_REQUIRED");
  });
});

describe("reliability stats (onSignup)", () => {
  const profileOf = async (uid: string) => (await db.doc(PATHS.privateProfile(uid)).get()).data() as PrivateProfileDoc;

  it("stores the track record and copies it to open upcoming snapshots only", async () => {
    // Three finished shifts in the past: 2 completed, 1 no-show.
    for (const [index, status] of (["completed", "completed", "no-show"] as const).entries()) {
      await seedInstance(`past${index}`, { startMs: BASE_MS - (index + 1) * DAY });
      await seedSignup(`past${index}`, "vol1", status);
    }
    // An open upcoming signup with a contact snapshot, one frozen, and one too far out.
    await seedInstance("soon", { startMs: BASE_MS + 2 * DAY });
    await seedInstance("far", { startMs: BASE_MS + 70 * DAY });
    await seedSignup("soon", "vol1", "confirmed");
    await seedSignup("far", "vol1", "confirmed");
    const contact = (instanceId: string, frozen: boolean) => ({
      orgId: "orgA",
      instanceId,
      uid: "vol1",
      hidden: false,
      isMinor: false,
      reliability: { attended: 0, noShows: 0, lateCancels: 0, total: 0, score: null, isNew: true },
      frozen,
      refreshedAt: tsAt(BASE_MS),
      createdAt: tsAt(BASE_MS),
      updatedAt: tsAt(BASE_MS)
    });
    await db.collection(COLLECTIONS.signupContacts).doc("soon_vol1").set(contact("soon", false));
    await db.collection(COLLECTIONS.signupContacts).doc("far_vol1").set(contact("far", false));
    await db.collection(COLLECTIONS.signupContacts).doc("past0_vol1").set(contact("past0", true));

    const first = await recomputeReliabilityForUid(makeDeps(), "vol1", testClock.nowMs);
    expect(first).toMatchObject({ wroteProfile: true, contactsRefreshed: 1 });
    expect((await profileOf("vol1")).reliability).toMatchObject({ attended: 2, noShows: 1, total: 3, score: 0.667, isNew: false });
    const read = async (id: string) => (await db.collection(COLLECTIONS.signupContacts).doc(id).get()).data() as SignupContactDoc;
    expect((await read("soon_vol1")).reliability).toMatchObject({ attended: 2, total: 3 });
    expect((await read("far_vol1")).reliability.isNew).toBe(true);
    expect((await read("past0_vol1")).reliability.isNew).toBe(true);

    // Bounded: nothing changed, so nothing is written the second time.
    await expect(recomputeReliabilityForUid(makeDeps(), "vol1", testClock.nowMs)).resolves.toEqual({ wroteProfile: false, contactsRefreshed: 0, membersUpdated: 0 });
  });

  it("refreshes the isMinor cache and minor coordinators' canViewContacts", async () => {
    await db.doc(PATHS.member("orgA", "minor")).set({ uid: "minor", orgId: "orgA", role: "coordinator", displayName: "Sam L.", canViewContacts: true, invitedBy: null, joinedAt: tsAt(BASE_MS), createdAt: tsAt(BASE_MS), updatedAt: tsAt(BASE_MS) });
    await db.doc(PATHS.privateProfile("minor")).update({ isMinor: false });
    const result = await recomputeReliabilityForUid(makeDeps(), "minor", testClock.nowMs);
    expect(result).toMatchObject({ wroteProfile: true, membersUpdated: 1 });
    expect((await profileOf("minor")).isMinor).toBe(true);
    expect((await db.doc(PATHS.member("orgA", "minor")).get()).data()?.canViewContacts).toBe(false);
  });

  it("does nothing for someone without a profile", async () => {
    await expect(recomputeReliabilityForUid(makeDeps(), "ghost", testClock.nowMs)).resolves.toEqual({ wroteProfile: false, contactsRefreshed: 0, membersUpdated: 0 });
  });
});

describe("streak weeks (onHoursLog)", () => {
  it("counts consecutive weeks of approved hours", async () => {
    const log = (id: string, dateMs: number) =>
      db.collection(COLLECTIONS.hoursLogs).doc(id).set({
        uid: "vol1",
        orgId: "orgA",
        instanceId: null,
        signupId: null,
        source: "kiosk",
        date: tsAt(dateMs),
        minutes: 60,
        status: "approved",
        needsReview: false,
        createdAt: tsAt(BASE_MS),
        updatedAt: tsAt(BASE_MS)
      });
    await log("a", BASE_MS - 1 * DAY);
    await log("b", BASE_MS - 8 * DAY);
    await log("c", BASE_MS - 30 * DAY);
    await recomputeStatsForUid(makeDeps(), "vol1", "orgA", testClock.nowMs);
    const userDoc = (await db.collection(COLLECTIONS.users).doc("vol1").get()).data() as UserPublicDoc;
    expect(userDoc).toMatchObject({ totalApprovedHours: 3, streakWeeks: 2 });
  });
});
