/**
 * waitlist.test.ts
 * Tier 1 waitlist (SPEC#fn-signup 5.3, SPEC#fn-cancelsignup, SPEC 6.1 rows
 * 2-4, SPEC 7.3): joining when full, position and size, SHIFT_FULL and
 * WAITLIST_CLOSED, promotion on cancel (lowest seq first, notification,
 * stale entries skipped), no promotion after the cutoff, promotion release,
 * the capacity-increase helper, the cutoff job's waitlist-closed
 * notification, and a race for the last waitlist place.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  COLLECTIONS,
  PATHS,
  notificationIdFor,
  type InstanceDoc,
  type NotificationDoc,
  type SignupDoc
} from "@fbla/shared";
import { readDoc, runTx } from "../src/lib/firestore";
import { runCutoff } from "../src/shifts/cutoff";
import { applyPromotion, readPromotion } from "../src/shifts/promotion";
import { BASE_MS, HOUR, MINUTE, call, db, expectCode, resetEmulators, testClock, user } from "./harness";
import { VOLUNTEERS, seedInstance, seedWorld } from "./fixtures";

const read = async <T>(collection: string, id: string) => (await db.collection(collection).doc(id).get()).data() as T;
const notification = async (uid: string, id: string) => readDoc<NotificationDoc>(await db.doc(PATHS.notificationItem(uid, id)).get());

/** Shift two days out (well before the cutoff and the 24 h late-cancel line), 1 seat. */
const LATER_MS = BASE_MS + 48 * HOUR;

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
});

describe("joining the waitlist", () => {
  it("waitlists when full, with position and size, and appends a seq", async () => {
    await seedInstance("inst1", { startMs: LATER_MS, capacity: 2 });
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol2"));
    const third = await call("volunteer", "signup", { instanceId: "inst1" }, user("vol3"));
    const fourth = await call("volunteer", "signup", { instanceId: "inst1" }, user("vol4"));
    expect(third).toEqual({ signupId: "inst1_vol3", status: "waitlisted", waitlistPosition: 1, waitlistSize: 1 });
    expect(fourth).toMatchObject({ status: "waitlisted", waitlistPosition: 2, waitlistSize: 2 });

    const instance = await read<InstanceDoc>(COLLECTIONS.instances, "inst1");
    expect(instance).toMatchObject({ signupCount: 2, waitlistSeq: 2 });
    expect(instance.waitlist).toEqual([
      { uid: "vol3", signupId: "inst1_vol3", seq: 0 },
      { uid: "vol4", signupId: "inst1_vol4", seq: 1 }
    ]);
    expect(await read<SignupDoc>(COLLECTIONS.signups, "inst1_vol3")).toMatchObject({ status: "waitlisted", waitlistSeq: 0, walkUp: false });

    // A retry returns the same place without a second entry.
    await expect(call("volunteer", "signup", { instanceId: "inst1" }, user("vol3"))).resolves.toMatchObject({ waitlistPosition: 1, waitlistSize: 2 });
    // The waitlist holds at most `capacity` people.
    await expectCode(call("volunteer", "signup", { instanceId: "inst1" }, user("vol5")), "SHIFT_FULL");
  });

  it("refuses the waitlist after the 2 h cutoff", async () => {
    await seedInstance("inst1", { capacity: 1, signupCount: 1 });
    testClock.set(BASE_MS + HOUR); // start is BASE + 3 h, cutoff BASE + 1 h
    await expectCode(call("volunteer", "signup", { instanceId: "inst1" }, user("vol1")), "WAITLIST_CLOSED");
  });

  it("race: 6 people for 1 waitlist place end with exactly one waitlisted", async () => {
    await seedInstance("race", { startMs: LATER_MS, capacity: 1, signupCount: 1 });
    const results = await Promise.allSettled(VOLUNTEERS.slice(0, 6).map((uid) => call("volunteer", "signup", { instanceId: "race" }, user(uid))));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const instance = await read<InstanceDoc>(COLLECTIONS.instances, "race");
    expect(instance.waitlist).toHaveLength(1);
  });
});

describe("promotion on cancel", () => {
  const fillAndQueue = async (): Promise<void> => {
    await seedInstance("inst1", { startMs: LATER_MS, capacity: 1 });
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol2"));
  };

  it("moves the lowest seq into the freed seat and notifies them", async () => {
    await fillAndQueue();
    testClock.advance(10 * MINUTE);
    const result = await call("volunteer", "cancelSignup", { signupId: "inst1_vol1" }, user("vol1"));
    expect(result).toEqual({ status: "cancelled", lateCancel: false, promotedSignupId: "inst1_vol2" });

    const promoted = await read<SignupDoc>(COLLECTIONS.signups, "inst1_vol2");
    expect(promoted).toMatchObject({ status: "confirmed", waitlistSeq: null });
    expect(promoted.promotedAt?.toMillis()).toBe(testClock.nowMs);
    expect(promoted.history.at(-1)).toMatchObject({ from: "waitlisted", to: "confirmed", op: "cancelSignup", actor: "system" });
    expect(await read<InstanceDoc>(COLLECTIONS.instances, "inst1")).toMatchObject({ signupCount: 1, waitlist: [] });

    const alert = await notification("vol2", notificationIdFor("waitlist-promoted", "inst1_vol2"));
    expect(alert).toMatchObject({ type: "waitlist-promoted", read: false, link: "/opportunity/inst1", data: { instanceId: "inst1", signupId: "inst1_vol2" } });
    expect(alert?.title).toMatch(/^You're in! /);
  });

  it("a waitlisted cancel frees no seat and promotes no one", async () => {
    await fillAndQueue();
    const result = await call("volunteer", "cancelSignup", { signupId: "inst1_vol2" }, user("vol2"));
    expect(result).toEqual({ status: "cancelled", lateCancel: false, promotedSignupId: null });
    expect(await read<InstanceDoc>(COLLECTIONS.instances, "inst1")).toMatchObject({ signupCount: 1, waitlist: [] });
  });

  it("does not promote after the cutoff; the seat goes to walk-ups", async () => {
    await seedInstance("inst1", { capacity: 1 });
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol2"));
    testClock.set(BASE_MS + HOUR + MINUTE);
    const result = await call("volunteer", "cancelSignup", { signupId: "inst1_vol1" }, user("vol1"));
    expect(result).toMatchObject({ promotedSignupId: null, lateCancel: true });
    expect(await read<InstanceDoc>(COLLECTIONS.instances, "inst1")).toMatchObject({ signupCount: 0 });
    expect((await read<SignupDoc>(COLLECTIONS.signups, "inst1_vol2")).status).toBe("waitlisted");
    const walkUp = await call("volunteer", "signup", { instanceId: "inst1" }, user("vol3"));
    expect(walkUp).toMatchObject({ status: "confirmed" });
    expect((await read<SignupDoc>(COLLECTIONS.signups, "inst1_vol3")).walkUp).toBe(true);
  });

  it("lets a promoted volunteer release the seat without a late cancel, promoting the next", async () => {
    await seedInstance("inst1", { startMs: BASE_MS + 20 * HOUR, capacity: 1 });
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol2"));
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol3")).catch(() => undefined);
    await call("volunteer", "cancelSignup", { signupId: "inst1_vol1" }, user("vol1"));
    const released = await call("volunteer", "cancelSignup", { signupId: "inst1_vol2", release: true }, user("vol2"));
    expect(released).toMatchObject({ status: "cancelled", lateCancel: false });
    expect(await read<SignupDoc>(COLLECTIONS.signups, "inst1_vol2")).toMatchObject({ cancelReason: "promotion-release", lateCancel: false });
  });

  it("skips stale waitlist entries whose signup is no longer waitlisted", async () => {
    await seedInstance("inst1", { startMs: LATER_MS, capacity: 2 });
    for (const uid of ["vol1", "vol2", "vol3", "vol4"]) await call("volunteer", "signup", { instanceId: "inst1" }, user(uid));
    // vol3 heads the line, but its signup was changed behind the waitlist's back.
    await db.collection(COLLECTIONS.signups).doc("inst1_vol3").update({ status: "cancelled" });
    const result = await call("volunteer", "cancelSignup", { signupId: "inst1_vol1" }, user("vol1"));
    expect(result).toMatchObject({ promotedSignupId: "inst1_vol4" });
    expect(await read<InstanceDoc>(COLLECTIONS.instances, "inst1")).toMatchObject({ signupCount: 2, waitlist: [] });
  });
});

describe("capacity increase helper (for updateInstance)", () => {
  it("promotes in seq order and returns the remaining waitlist", async () => {
    await seedInstance("inst1", { startMs: LATER_MS, capacity: 2 });
    for (const uid of ["vol1", "vol2", "vol3", "vol4"]) await call("volunteer", "signup", { instanceId: "inst1" }, user(uid));
    const ref = db.collection(COLLECTIONS.instances).doc("inst1");
    const result = await runTx(db, async (tx) => {
      const instance = { ...(readDoc<InstanceDoc>(await tx.get(ref)) as InstanceDoc), capacity: 3 };
      const plan = await readPromotion(tx, db, instance, instance.signupCount, testClock.nowMs);
      const applied = applyPromotion(tx, db, "inst1", instance, plan, "coordA", "updateInstance", testClock.nowMs);
      tx.update(ref, { capacity: 3, signupCount: instance.signupCount + applied.seatsTaken, waitlist: applied.waitlist });
      return applied;
    });
    expect(result).toMatchObject({ promotedSignupIds: ["inst1_vol3"], seatsTaken: 1 });
    expect(result.waitlist.map((entry) => entry.uid)).toEqual(["vol4"]);
    expect((await read<SignupDoc>(COLLECTIONS.signups, "inst1_vol3")).status).toBe("confirmed");
    expect(await notification("vol3", notificationIdFor("waitlist-promoted", "inst1_vol3"))).not.toBeNull();
  });
});

describe("waitlist cutoff job", () => {
  it("cancels waitlisted signups as waitlist-cutoff and sends waitlist-closed once", async () => {
    await seedInstance("inst1", { capacity: 1 });
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol2"));
    testClock.set(BASE_MS + HOUR);
    expect(await runCutoff(db, "inst1", testClock.nowMs)).toBe(1);
    expect(await runCutoff(db, "inst1", testClock.nowMs)).toBe(0);
    expect(await read<SignupDoc>(COLLECTIONS.signups, "inst1_vol2")).toMatchObject({ status: "cancelled", cancelReason: "waitlist-cutoff", lateCancel: false });
    const alert = await notification("vol2", notificationIdFor("waitlist-closed", "inst1_vol2"));
    expect(alert).toMatchObject({ type: "waitlist-closed", title: "The waitlist for Sort food donations closed", read: false });
    const items = await db.collection(PATHS.notificationItems("vol2")).get();
    expect(items.size).toBe(1);
  });
});
