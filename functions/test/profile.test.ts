/**
 * profile.test.ts
 * volunteer.completeProfile (SPEC#fn-completeprofile, G11, G13, G18),
 * Turnstile verification with replay protection, admin.setDemoClock, and the
 * bounded stats trigger (G1).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS, PATHS, type PrivateProfileDoc, type UserPublicDoc } from "@fbla/shared";
import { readFunctionsEnv } from "../src/lib/env";
import { recomputeStatsForUid } from "../src/triggers/recomputeVolunteerStats";
import { verifyTurnstile, type FetchLike } from "../src/turnstile/verifyTurnstile";
import { BASE_MS, HOUR, PROJECT_ID, adminUser, auth, call, db, expectCode, logLines, makeDeps, resetEmulators, tsAt, user } from "./harness";
import { seedWorld } from "./fixtures";

const profileInput = { firstName: "Jordan", lastName: "Rivera", birthDate: "2007-03-02", interests: ["seniors"] };

beforeEach(async () => {
  await resetEmulators();
});

describe("volunteer.completeProfile", () => {
  it("writes the private profile and the public projection", async () => {
    const result = await call("volunteer", "completeProfile", profileInput, user("newbie"));
    expect(result).toEqual({ displayName: "Jordan R.", isMinor: false });
    const saved = (await db.doc(PATHS.privateProfile("newbie")).get()).data() as PrivateProfileDoc;
    expect(saved).toMatchObject({ profileComplete: true, birthDate: "2007-03-02", fullName: "Jordan Rivera", email: "newbie@example.test" });
    const publicDoc = (await db.collection(COLLECTIONS.users).doc("newbie").get()).data() as UserPublicDoc;
    expect(Object.keys(publicDoc).sort()).toEqual(["avatarPath", "badges", "createdAt", "displayName", "orgsHelpedCount", "streakWeeks", "totalApprovedHours", "updatedAt"]);
    expect(logLines.some((line) => line.message.includes("Turnstile verification is disabled"))).toBe(true);
  });

  it("flags minors and is idempotent; a different birth date is locked", async () => {
    await expect(call("volunteer", "completeProfile", { ...profileInput, birthDate: "2011-01-01" }, user("teen"))).resolves.toMatchObject({ isMinor: true });
    await expect(call("volunteer", "completeProfile", { ...profileInput, birthDate: "2011-01-01" }, user("teen"))).resolves.toMatchObject({ isMinor: true });
    await expectCode(call("volunteer", "completeProfile", { ...profileInput, birthDate: "2001-01-01" }, user("teen")), "BIRTHDATE_LOCKED");
  });

  it("under 13: rejects and deletes the Auth user and their data", async () => {
    await auth.createUser({ uid: "kid", email: "kid@example.test" });
    await db.doc(PATHS.privateProfile("kid")).set({ textSize: 125 });
    await expectCode(call("volunteer", "completeProfile", { ...profileInput, birthDate: "2014-01-01" }, user("kid")), "AGE_UNDER_13");
    await expect(auth.getUser("kid")).rejects.toMatchObject({ code: "auth/user-not-found" });
    expect((await db.doc(PATHS.privateProfile("kid")).get()).exists).toBe(false);
    // No birth date or email in any log line.
    expect(JSON.stringify(logLines)).not.toMatch(/2014-01-01|kid@example/);
  });

  it("validates fields at the boundary", async () => {
    await expectCode(call("volunteer", "completeProfile", { ...profileInput, birthDate: "2007-02-30" }, user("x")), "INVALID_INPUT");
    await expectCode(call("volunteer", "completeProfile", { ...profileInput, phone: "555-1234" }, user("x")), "INVALID_INPUT");
    await expectCode(call("volunteer", "completeProfile", { ...profileInput, interests: ["crypto"] }, user("x")), "INVALID_INPUT");
  });
});

describe("Turnstile (G13)", () => {
  const enabledEnv = readFunctionsEnv({ GCLOUD_PROJECT: PROJECT_ID, TURNSTILE_ENABLED: "true", TURNSTILE_SECRET: "test-secret" });
  const respond = (success: boolean, ok = true): FetchLike => async () => ({ ok, json: async () => ({ success }) });

  it("accepts a valid token once and refuses its replay", async () => {
    const deps = makeDeps();
    await expect(verifyTurnstile(db, enabledEnv, deps.log, "token-1", BASE_MS, respond(true))).resolves.toBe(true);
    await expectAppCode(verifyTurnstile(db, enabledEnv, deps.log, "token-1", BASE_MS, respond(true)), "TURNSTILE_FAILED");
  });

  it("refuses missing, rejected, and unreachable verification", async () => {
    const deps = makeDeps();
    await expectAppCode(verifyTurnstile(db, enabledEnv, deps.log, undefined, BASE_MS, respond(true)), "TURNSTILE_FAILED");
    await expectAppCode(verifyTurnstile(db, enabledEnv, deps.log, "token-2", BASE_MS, respond(false)), "TURNSTILE_FAILED");
    await expectAppCode(verifyTurnstile(db, enabledEnv, deps.log, "token-3", BASE_MS, respond(true, false)), "TURNSTILE_FAILED");
    const throwing: FetchLike = async () => {
      throw new Error("network down");
    };
    await expectAppCode(verifyTurnstile(db, enabledEnv, deps.log, "token-4", BASE_MS, throwing), "TURNSTILE_FAILED");
  });
});

const expectAppCode = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toMatchObject({ name: "AppError", code });
};

describe("admin.setDemoClock", () => {
  it("advances the clock every op sees, and resets it", async () => {
    await seedWorld();
    const advanced = await call<{ offsetMs: number; now: string }>("admin", "setDemoClock", { advanceMinutes: 15 }, adminUser());
    expect(advanced).toEqual({ offsetMs: 15 * 60_000, now: new Date(BASE_MS + 15 * 60_000).toISOString() });
    const ping = await call<{ time: string }>("ai", "ping", {}, user("vol1"));
    expect(ping.time).toBe(new Date(BASE_MS + 15 * 60_000).toISOString());
    await call("admin", "setDemoClock", { offsetMs: 0 }, adminUser());
    expect((await call<{ time: string }>("ai", "ping", {}, user("vol1"))).time).toBe(new Date(BASE_MS).toISOString());
  });

  it("is refused outside demo mode and for non-admins", async () => {
    const prodDeps = makeDeps({ FUNCTIONS_EMULATOR: "false", DEMO_MODE: "false" });
    await expectCode(call("admin", "setDemoClock", { advanceMinutes: 15 }, adminUser(), prodDeps), "DEMO_MODE_REQUIRED");
    await expectCode(call("admin", "setDemoClock", { advanceMinutes: 15 }, user("vol1")), "PERMISSION_DENIED");
  });
});

describe("recomputeVolunteerStats (bounded, G1)", () => {
  it("writes the public totals once, then becomes a no-op", async () => {
    await seedWorld();
    const log = (minutes: number, orgId: string) => ({
      uid: "vol1", orgId, instanceId: null, signupId: null, source: "kiosk", date: tsAt(BASE_MS), minutes, status: "approved",
      needsReview: false, description: null, reviewedBy: null, reviewedAt: null, rejectReason: null, createdAt: tsAt(BASE_MS), updatedAt: tsAt(BASE_MS)
    });
    await db.collection(COLLECTIONS.hoursLogs).doc("l1").set(log(1200, "orgA"));
    await db.collection(COLLECTIONS.hoursLogs).doc("l2").set(log(360, "orgB"));
    const logsBefore = (await db.collection(COLLECTIONS.hoursLogs).get()).docs.map((doc) => doc.updateTime.toMillis());

    const first = await recomputeStatsForUid(makeDeps(), "vol1", "orgA", BASE_MS + HOUR);
    expect(first).toEqual({ wroteUser: true, markedOrgActive: true });
    expect((await db.collection(COLLECTIONS.users).doc("vol1").get()).data()).toMatchObject({
      totalApprovedHours: 26,
      orgsHelpedCount: 2,
      badges: ["hours-25"]
    });
    const second = await recomputeStatsForUid(makeDeps(), "vol1", "orgA", BASE_MS + 2 * HOUR);
    expect(second).toEqual({ wroteUser: false, markedOrgActive: false });
    // It never writes the collections that trigger it.
    expect((await db.collection(COLLECTIONS.hoursLogs).get()).docs.map((doc) => doc.updateTime.toMillis())).toEqual(logsBefore);
  });

  it("never creates a public doc for someone who has not onboarded", async () => {
    await recomputeStatsForUid(makeDeps(), "ghost", null, BASE_MS);
    expect((await db.collection(COLLECTIONS.users).doc("ghost").get()).exists).toBe(false);
  });
});
