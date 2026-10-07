/**
 * finalize.test.ts
 * coordinator.finalizeShift and the runDueJobs scheduler (SPEC#fn-finalizeshift,
 * SPEC#fn-runduejobs-detail, G8): every finalize branch, idempotent repeats,
 * cross-org and kiosk denial, overlapping job runs that finalize exactly
 * once (lease), cutoff handling, and pagination (`more`).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS, PATHS, type HoursLogDoc, type InstanceDoc, type JobRunDoc, type SignupContactDoc, type SignupDoc } from "@fbla/shared";
import { runDueJobs } from "../src/jobs/runDueJobs";
import { requestClock } from "../src/lib/requestClock";
import { BASE_MS, HOUR, MINUTE, adminUser, call, db, expectCode, kioskUser, makeDeps, resetEmulators, testClock, tsAt, user } from "./harness";
import { seedInstance, seedSignup, seedWorld } from "./fixtures";

const START = BASE_MS + 3 * HOUR;
const END = START + 4 * HOUR;

const signup = async (id: string) => (await db.collection(COLLECTIONS.signups).doc(id).get()).data() as SignupDoc;
const instance = async (id: string) => (await db.collection(COLLECTIONS.instances).doc(id).get()).data() as InstanceDoc;

/** A roster with one of each status finalize cares about. */
const seedRoster = async (instanceId: string) => {
  await seedInstance(instanceId);
  await seedSignup(instanceId, "vol1", "confirmed"); // -> no-show
  await seedSignup(instanceId, "vol2", "confirmed", { promotedAt: tsAt(START - 3 * HOUR) }); // late promotion -> excused
  await seedSignup(instanceId, "vol3", "checked-in", { checkInAt: tsAt(START + 10 * MINUTE) }); // -> completed, pending log
  await seedSignup(instanceId, "vol4", "completed"); // unchanged
  await seedSignup(instanceId, "vol5", "waitlisted"); // -> cancelled
  await db.collection(COLLECTIONS.signupContacts).doc(`${instanceId}_vol1`).set({ instanceId, orgId: "orgA", uid: "vol1", frozen: false });
};

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
});

describe("coordinator.finalizeShift", () => {
  it("is refused before the shift ends", async () => {
    await seedRoster("inst1");
    testClock.set(END - MINUTE);
    await expectCode(call("coordinator", "finalizeShift", { instanceId: "inst1" }, user("coordA")), "SHIFT_NOT_ENDED");
  });

  it("applies every finalize branch, freezes contacts, and marks the instance last", async () => {
    await seedRoster("inst1");
    testClock.set(END);
    const result = await call("coordinator", "finalizeShift", { instanceId: "inst1" }, user("coordA"));
    expect(result).toEqual({ noShows: 1, excused: 1, autoCompleted: 1, alreadyFinalized: false });

    expect((await signup("inst1_vol1")).status).toBe("no-show");
    expect(await signup("inst1_vol2")).toMatchObject({ status: "excused", excuseReason: "late-promotion" });
    expect(await signup("inst1_vol3")).toMatchObject({ status: "completed", autoCompleted: true });
    expect((await signup("inst1_vol4")).status).toBe("completed");
    expect(await signup("inst1_vol5")).toMatchObject({ status: "cancelled", cancelReason: "waitlist-cutoff" });
    const log = (await db.collection(COLLECTIONS.hoursLogs).doc("inst1_vol3").get()).data() as HoursLogDoc;
    expect(log).toMatchObject({ source: "finalize", status: "pending", needsReview: true, minutes: 225 });
    expect(((await db.collection(COLLECTIONS.signupContacts).doc("inst1_vol1").get()).data() as SignupContactDoc).frozen).toBe(true);
    expect(await instance("inst1")).toMatchObject({ status: "finalized", nextActionAt: null });

    const again = await call("coordinator", "finalizeShift", { instanceId: "inst1" }, user("coordA"));
    expect(again).toEqual({ noShows: 0, excused: 0, autoCompleted: 0, alreadyFinalized: true });
  });

  it("cross-org coordinators, volunteers, and kiosk tokens are denied", async () => {
    await seedRoster("inst1");
    testClock.set(END);
    await expectCode(call("coordinator", "finalizeShift", { instanceId: "inst1" }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "finalizeShift", { instanceId: "inst1" }, user("vol1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "finalizeShift", { instanceId: "inst1" }, kioskUser("inst1")), "PERMISSION_DENIED");
    expect((await instance("inst1")).finalizedAt).toBeNull();
  });

  it("refuses a cancelled shift", async () => {
    await seedInstance("gone", { status: "cancelled" });
    testClock.set(END);
    await expectCode(call("coordinator", "finalizeShift", { instanceId: "gone" }, user("coordA")), "SHIFT_CANCELLED");
  });
});

describe("runDueJobs", () => {
  it("is admin-only", async () => {
    await expectCode(call("admin", "runDueJobs", {}, user("coordA")), "PERMISSION_DENIED");
  });

  it("runs the cutoff when due, then finalizes after end + 30 min", async () => {
    await seedRoster("inst1");
    testClock.set(START - HOUR); // past the 2 h cutoff, before the start
    const first = await call<{ processed: { cutoffs: number; finalized: number } }>("admin", "runDueJobs", {}, adminUser());
    expect(first.processed).toEqual({ cutoffs: 1, finalized: 0, seriesExtended: 0 });
    expect((await instance("inst1")).nextActionAt?.toMillis()).toBe(END + 30 * MINUTE);

    testClock.set(END + 30 * MINUTE);
    const second = await call<{ outcome: string; processed: { finalized: number } }>("admin", "runDueJobs", {}, adminUser());
    expect(second).toMatchObject({ outcome: "ok", processed: { cutoffs: 0, finalized: 1 } });
    expect((await signup("inst1_vol1")).status).toBe("no-show");
    expect((await instance("inst1")).status).toBe("finalized");

    const runs = await db.collection(COLLECTIONS.jobRuns).get();
    expect(runs.docs.map((doc) => (doc.data() as JobRunDoc).trigger)).toEqual(["admin", "admin"]);
  });

  it("overlapping runs finalize exactly once (lease + markers)", async () => {
    await seedRoster("inst1");
    testClock.set(END + HOUR);
    const deps = makeDeps();
    const clock = await requestClock(deps);
    const results = await Promise.all([
      runDueJobs(deps, clock, "schedule"),
      runDueJobs(deps, clock, "admin"),
      runDueJobs(deps, clock, "schedule")
    ]);
    expect(results.reduce((sum, run) => sum + run.processed.finalized, 0)).toBe(1);
    expect((await signup("inst1_vol1")).history.filter((entry) => entry.to === "no-show")).toHaveLength(1);
    const logs = await db.collection(COLLECTIONS.hoursLogs).where("uid", "==", "vol3").get();
    expect(logs.size).toBe(1);
    expect((await db.doc(PATHS.runDueJobsLease()).get()).exists).toBe(false);
  });

  it("skips while another run holds an unexpired lease", async () => {
    await seedRoster("inst1");
    testClock.set(END + HOUR);
    await db.doc(PATHS.runDueJobsLease()).set({ holder: "someone-else", expiresAt: tsAt(END + HOUR + 4 * MINUTE) });
    const skipped = await call("admin", "runDueJobs", {}, adminUser());
    expect(skipped).toMatchObject({ outcome: "skipped-lease", processed: { finalized: 0 } });
    expect((await instance("inst1")).finalizedAt).toBeNull();
    testClock.advance(5 * MINUTE); // the other run's lease expired
    await expect(call("admin", "runDueJobs", {}, adminUser())).resolves.toMatchObject({ outcome: "ok", processed: { finalized: 1 } });
  });

  it("pages through due instances and reports `more` when the page is full", async () => {
    await seedInstance("a");
    await seedInstance("b");
    testClock.set(END + HOUR);
    const deps = makeDeps({ JOB_PAGE_SIZE: "1" });
    const first = await runDueJobs(deps, await requestClock(deps), "admin");
    expect(first).toMatchObject({ more: true, processed: { finalized: 1 } });
    const second = await runDueJobs(deps, await requestClock(deps), "admin");
    expect(second).toMatchObject({ more: true, processed: { finalized: 1 } });
    const third = await runDueJobs(deps, await requestClock(deps), "admin");
    expect(third).toMatchObject({ more: false, processed: { finalized: 0 } });
  });
});
