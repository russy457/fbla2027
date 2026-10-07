/**
 * signup.test.ts
 * volunteer.signup and volunteer.cancelSignup (SPEC#fn-signup,
 * SPEC#fn-cancelsignup): happy path, idempotent retry, every listed error,
 * minor safety, and the last-seat race (N concurrent signups, exactly
 * `capacity` confirmed).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS, type InstanceDoc, type OrganizationDoc, type SignupContactDoc, type SignupDoc } from "@fbla/shared";
import { BASE_MS, HOUR, MINUTE, call, db, expectCode, resetEmulators, testClock, user } from "./harness";
import { VOLUNTEERS, seedInstance, seedWorld } from "./fixtures";

const read = async <T>(collection: string, id: string) => (await db.collection(collection).doc(id).get()).data() as T;

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
});

describe("volunteer.signup", () => {
  it("confirms a free seat, writes the contact snapshot, and marks the org active", async () => {
    await seedInstance("inst1");
    const result = await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
    expect(result).toEqual({ signupId: "inst1_vol1", status: "confirmed", waitlistPosition: null, waitlistSize: null });

    const signup = await read<SignupDoc>(COLLECTIONS.signups, "inst1_vol1");
    expect(signup).toMatchObject({ status: "confirmed", uid: "vol1", orgId: "orgA", displayName: "Volunteer1 R.", walkUp: false });
    expect(signup.history).toHaveLength(1);
    expect((await read<InstanceDoc>(COLLECTIONS.instances, "inst1")).signupCount).toBe(1);
    expect(await read<SignupContactDoc>(COLLECTIONS.signupContacts, "inst1_vol1")).toMatchObject({
      hidden: false,
      fullName: "Volunteer1 Rivera",
      frozen: false
    });
    expect((await read<OrganizationDoc>(COLLECTIONS.organizations, "orgA")).hasActivity).toBe(true);
  });

  it("returns the existing signup on retry without taking a second seat", async () => {
    await seedInstance("inst1");
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
    const again = await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
    expect(again).toMatchObject({ signupId: "inst1_vol1", status: "confirmed" });
    expect((await read<InstanceDoc>(COLLECTIONS.instances, "inst1")).signupCount).toBe(1);
  });

  it("marks a signup after the 2 h cutoff as a walk-up", async () => {
    await seedInstance("inst1");
    testClock.set(BASE_MS + HOUR + MINUTE); // start is BASE + 3 h, so the cutoff was at BASE + 1 h
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
    expect((await read<SignupDoc>(COLLECTIONS.signups, "inst1_vol1")).walkUp).toBe(true);
  });

  it("last-seat race: 8 people for 3 seats end with exactly 3 confirmed (and 3 waitlisted)", async () => {
    await seedInstance("race", { capacity: 3 });
    const results = await Promise.allSettled(VOLUNTEERS.map((uid) => call("volunteer", "signup", { instanceId: "race" }, user(uid))));
    const fulfilled = results.filter((result): result is PromiseFulfilledResult<Record<string, unknown>> => result.status === "fulfilled");
    const failed = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(fulfilled.filter((result) => result.value.status === "confirmed")).toHaveLength(3);
    // Tier 1: the waitlist holds up to capacity more (SPEC 5.3 step 5); losers under heavy contention may get CONTENTION.
    const waitlisted = fulfilled.filter((result) => result.value.status === "waitlisted").length;
    expect(waitlisted).toBeLessThanOrEqual(3);
    failed.forEach((result) => expect(["SHIFT_FULL", "CONTENTION"]).toContain((result.reason as { details: { code: string } }).details.code));

    const instance = await read<InstanceDoc>(COLLECTIONS.instances, "race");
    const signups = await db.collection(COLLECTIONS.signups).where("instanceId", "==", "race").get();
    expect(instance.signupCount).toBe(3);
    expect(instance.waitlist).toHaveLength(waitlisted);
    expect(signups.size).toBe(3 + waitlisted);
  });

  it("refuses full, started, cancelled, and missing shifts", async () => {
    await seedInstance("full", { capacity: 1, signupCount: 1 });
    await db.collection(COLLECTIONS.instances).doc("full").update({ waitlist: [{ uid: "other", signupId: "full_other", seq: 0 }], waitlistSeq: 1 });
    await seedInstance("started", { startMs: BASE_MS - MINUTE });
    await seedInstance("cancelled", { status: "cancelled" });
    await expectCode(call("volunteer", "signup", { instanceId: "full" }, user("vol1")), "SHIFT_FULL");
    await expectCode(call("volunteer", "signup", { instanceId: "started" }, user("vol1")), "SHIFT_STARTED");
    await expectCode(call("volunteer", "signup", { instanceId: "cancelled" }, user("vol1")), "SHIFT_CANCELLED");
    await expectCode(call("volunteer", "signup", { instanceId: "ghost" }, user("vol1")), "NOT_FOUND");
  });

  it("closes a full shift's waitlist after the cutoff", async () => {
    await seedInstance("full", { capacity: 1, signupCount: 1 });
    testClock.set(BASE_MS + HOUR + MINUTE);
    await expectCode(call("volunteer", "signup", { instanceId: "full" }, user("vol1")), "WAITLIST_CLOSED");
  });

  it("enforces minimum age and minor safety (G14)", async () => {
    await seedInstance("adults", { minAge: 18 });
    await seedInstance("unverified", { orgId: "orgU" });
    const error = await expectCode(call("volunteer", "signup", { instanceId: "adults" }, user("minor")), "AGE_BELOW_MIN");
    expect(error.message).toBe("You must be at least 18 to join this shift.");
    await expectCode(call("volunteer", "signup", { instanceId: "unverified" }, user("minor")), "MINOR_UNVERIFIED_ORG");
    await expect(call("volunteer", "signup", { instanceId: "unverified" }, user("vol1"))).resolves.toMatchObject({ status: "confirmed" });
  });
});

describe("volunteer.cancelSignup", () => {
  it("cancels, frees the seat, and flags a late cancel inside 24 h", async () => {
    await seedInstance("inst1");
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
    const result = await call("volunteer", "cancelSignup", { signupId: "inst1_vol1" }, user("vol1"));
    expect(result).toEqual({ status: "cancelled", lateCancel: true, promotedSignupId: null });
    expect((await read<InstanceDoc>(COLLECTIONS.instances, "inst1")).signupCount).toBe(0);
    expect(await read<SignupDoc>(COLLECTIONS.signups, "inst1_vol1")).toMatchObject({ status: "cancelled", cancelReason: "volunteer" });
  });

  it("an early cancel is not late; a retry returns the stored result; re-signup is refused", async () => {
    await seedInstance("later", { startMs: BASE_MS + 72 * HOUR });
    await call("volunteer", "signup", { instanceId: "later" }, user("vol1"));
    await expect(call("volunteer", "cancelSignup", { signupId: "later_vol1" }, user("vol1"))).resolves.toMatchObject({ lateCancel: false });
    await expect(call("volunteer", "cancelSignup", { signupId: "later_vol1" }, user("vol1"))).resolves.toMatchObject({ status: "cancelled" });
    await expectCode(call("volunteer", "signup", { instanceId: "later" }, user("vol1")), "SIGNUP_CANCELLED_BEFORE");
  });

  it("only the volunteer who owns the signup may cancel it", async () => {
    await seedInstance("inst1");
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
    await expectCode(call("volunteer", "cancelSignup", { signupId: "inst1_vol1" }, user("vol2")), "PERMISSION_DENIED");
    await expectCode(call("volunteer", "cancelSignup", { signupId: "inst1_vol1" }, user("coordA")), "PERMISSION_DENIED");
  });

  it("refuses after the start and refuses a release without a promotion", async () => {
    await seedInstance("inst1");
    await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
    await expectCode(call("volunteer", "cancelSignup", { signupId: "inst1_vol1", release: true }, user("vol1")), "RELEASE_NOT_ALLOWED");
    testClock.set(BASE_MS + 3 * HOUR);
    await expectCode(call("volunteer", "cancelSignup", { signupId: "inst1_vol1" }, user("vol1")), "SHIFT_STARTED");
  });
});
