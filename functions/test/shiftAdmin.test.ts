/**
 * shiftAdmin.test.ts
 * Opportunity and instance management (SPEC 5.2, SPEC#fn-cancelinstance):
 * upsertOpportunity (create + update), createInstance (with kiosk secrets),
 * updateInstance (capacity, times, sequence, CAPACITY_BELOW_SIGNUPS), and
 * cancelInstance (waitlisted/confirmed cancelled, checked-in completed with
 * pending hours). Every op: cross-org and kiosk-token denial (SPEC 4.4).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS, type HoursLogDoc, type InstanceDoc, type OpportunityDoc, type SignupDoc } from "@fbla/shared";
import { BASE_MS, HOUR, MINUTE, call, db, expectCode, kioskUser, resetEmulators, testClock, tsAt, user } from "./harness";
import { seedInstance, seedSignup, seedWorld } from "./fixtures";

const NONCE_1 = "44444444-4444-4444-8444-444444444444";
const NONCE_2 = "55555555-5555-4555-8555-555555555555";
const DAY = 24 * HOUR;

const fields = {
  title: "Garden cleanup",
  description: "Pull weeds and spread mulch.",
  causeArea: "environment",
  type: "one-time",
  skills: ["gardening"],
  minAge: 14,
  location: { address: { line1: "1 Main St", city: "San Antonio", state: "TX", zip: "78205" } }
};

const iso = (ms: number) => new Date(ms).toISOString();
const instanceDoc = async (id: string) => (await db.collection(COLLECTIONS.instances).doc(id).get()).data() as InstanceDoc;
const signupDoc = async (id: string) => (await db.collection(COLLECTIONS.signups).doc(id).get()).data() as SignupDoc;

const createOpportunity = () =>
  call<{ opportunityId: string; created: boolean }>("coordinator", "upsertOpportunity", { orgId: "orgA", requestNonce: NONCE_1, fields }, user("coordA"));

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
});

describe("coordinator.upsertOpportunity", () => {
  it("creates once per nonce with org facts denormalized, then updates and copies the title to future shifts", async () => {
    const { opportunityId, created } = await createOpportunity();
    expect(created).toBe(true);
    expect(await createOpportunity()).toEqual({ opportunityId, created: false });
    const opportunity = (await db.collection(COLLECTIONS.opportunities).doc(opportunityId).get()).data() as OpportunityDoc;
    expect(opportunity).toMatchObject({ orgId: "orgA", orgName: "Alamo Community Pantry", orgVerified: true, status: "active", createdBy: "coordA" });
    expect(opportunity.location?.geo).toBeNull();

    await seedInstance("inst1", { startMs: BASE_MS + DAY });
    await db.collection(COLLECTIONS.instances).doc("inst1").update({ opportunityId });
    await call("coordinator", "upsertOpportunity", { opportunityId, fields: { ...fields, title: "Garden day", minAge: 16 }, status: "active" }, user("coordA"));
    expect(await instanceDoc("inst1")).toMatchObject({ title: "Garden day", minAge: 16 });
  });

  it("validates fields and denies other orgs and kiosk tokens", async () => {
    await expectCode(call("coordinator", "upsertOpportunity", { orgId: "orgA", requestNonce: NONCE_1, fields: { ...fields, type: "virtual" } }, user("coordA")), "INVALID_INPUT");
    await expectCode(call("coordinator", "upsertOpportunity", { orgId: "orgA", requestNonce: NONCE_1, fields }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "upsertOpportunity", { orgId: "orgA", requestNonce: NONCE_1, fields }, kioskUser("inst1")), "PERMISSION_DENIED");
    const { opportunityId } = await createOpportunity();
    await expectCode(call("coordinator", "upsertOpportunity", { opportunityId, fields }, user("coordB")), "PERMISSION_DENIED");
    // A client-sent orgId is ignored on update: the stored listing decides the org.
    await expectCode(call("coordinator", "upsertOpportunity", { opportunityId, fields, orgId: "orgB" }, user("coordB")), "INVALID_INPUT");
  });
});

describe("coordinator.createInstance", () => {
  it("creates the shift with job times and kiosk secrets, idempotent per nonce", async () => {
    const { opportunityId } = await createOpportunity();
    const start = BASE_MS + 2 * DAY;
    const input = { opportunityId, start: iso(start), end: iso(start + 3 * HOUR), capacity: 5, requestNonce: NONCE_2 };
    const { instanceId, created } = await call<{ instanceId: string; created: boolean }>("coordinator", "createInstance", input, user("coordA"));
    expect(created).toBe(true);
    const instance = await instanceDoc(instanceId);
    expect(instance).toMatchObject({ orgId: "orgA", title: "Garden cleanup", minAge: 14, capacity: 5, signupCount: 0, status: "scheduled", sequence: 0, timeZone: "America/Chicago" });
    expect(instance.cutoffAt.toMillis()).toBe(start - 2 * HOUR);
    expect(instance.finalizeAt.toMillis()).toBe(start + 3 * HOUR + 30 * MINUTE);
    expect(instance.nextActionAt?.toMillis()).toBe(start - 2 * HOUR);
    expect((await db.collection(COLLECTIONS.instanceSecrets).doc(instanceId).get()).data()).toMatchObject({ keyVersion: 1 });
    expect(((await db.collection(COLLECTIONS.opportunities).doc(opportunityId).get()).data() as OpportunityDoc).nextInstanceStart?.toMillis()).toBe(start);
    await expect(call("coordinator", "createInstance", input, user("coordA"))).resolves.toEqual({ instanceId, created: false });
  });

  it("refuses bad times (past, reversed, over 12 h) and other orgs", async () => {
    const { opportunityId } = await createOpportunity();
    const base = { opportunityId, capacity: 5, requestNonce: NONCE_2 };
    await expectCode(call("coordinator", "createInstance", { ...base, start: iso(BASE_MS - HOUR), end: iso(BASE_MS) }, user("coordA")), "INSTANCE_TIME_INVALID");
    await expectCode(call("coordinator", "createInstance", { ...base, start: iso(BASE_MS + 2 * HOUR), end: iso(BASE_MS + HOUR) }, user("coordA")), "INSTANCE_TIME_INVALID");
    await expectCode(call("coordinator", "createInstance", { ...base, start: iso(BASE_MS + HOUR), end: iso(BASE_MS + 14 * HOUR) }, user("coordA")), "INSTANCE_TIME_INVALID");
    const ok = { ...base, start: iso(BASE_MS + DAY), end: iso(BASE_MS + DAY + HOUR) };
    await expectCode(call("coordinator", "createInstance", ok, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "createInstance", ok, kioskUser("inst1")), "PERMISSION_DENIED");
  });
});

describe("coordinator.updateInstance", () => {
  it("changes capacity, refuses going below seats taken, and is a no-op when unchanged", async () => {
    await seedInstance("inst1", { capacity: 3, signupCount: 2 });
    await expectCode(call("coordinator", "updateInstance", { instanceId: "inst1", capacity: 1 }, user("coordA")), "CAPACITY_BELOW_SIGNUPS");
    const raised = await call("coordinator", "updateInstance", { instanceId: "inst1", capacity: 5 }, user("coordA"));
    expect(raised).toEqual({ instanceId: "inst1", sequence: 0, promoted: [], changed: true });
    expect((await instanceDoc("inst1")).capacity).toBe(5);
    await expect(call("coordinator", "updateInstance", { instanceId: "inst1", capacity: 5 }, user("coordA"))).resolves.toMatchObject({ changed: false });
  });

  it("a time change bumps the sequence, moves job times, and refreshes signup times", async () => {
    await seedInstance("inst1");
    await seedSignup("inst1", "vol1", "confirmed");
    const start = BASE_MS + DAY;
    const out = await call<{ sequence: number }>("coordinator", "updateInstance", { instanceId: "inst1", start: iso(start), end: iso(start + 2 * HOUR) }, user("coordA"));
    expect(out.sequence).toBe(1);
    const instance = await instanceDoc("inst1");
    expect(instance.cutoffAt.toMillis()).toBe(start - 2 * HOUR);
    expect(instance.nextActionAt?.toMillis()).toBe(start - 2 * HOUR);
    expect((await signupDoc("inst1_vol1")).instanceStart.toMillis()).toBe(start);
  });

  it("refuses started, cancelled, and other orgs' shifts", async () => {
    await seedInstance("inst1");
    await seedInstance("instC", { status: "cancelled" });
    await expectCode(call("coordinator", "updateInstance", { instanceId: "inst1", capacity: 9 }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "updateInstance", { instanceId: "inst1", capacity: 9 }, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "updateInstance", { instanceId: "instC", capacity: 9 }, user("coordA")), "SHIFT_CANCELLED");
    testClock.advance(4 * HOUR);
    await expectCode(call("coordinator", "updateInstance", { instanceId: "inst1", capacity: 9 }, user("coordA")), "SHIFT_STARTED");
  });
});

describe("coordinator.cancelInstance", () => {
  it("before the shift: cancels confirmed and waitlisted signups as org-cancelled", async () => {
    await seedInstance("inst1", { signupCount: 1 });
    await seedSignup("inst1", "vol1", "confirmed");
    await seedSignup("inst1", "vol2", "waitlisted");
    const out = await call("coordinator", "cancelInstance", { instanceId: "inst1", reason: "Storm warning" }, user("coordA"));
    expect(out).toEqual({ cancelledSignups: 2, completedSignups: 0, alreadyCancelled: false });
    expect(await instanceDoc("inst1")).toMatchObject({ status: "cancelled", cancelReason: "Storm warning", cancelledBy: "coordA", nextActionAt: null, sequence: 1, signupCount: 0 });
    expect(await signupDoc("inst1_vol1")).toMatchObject({ status: "cancelled", cancelReason: "org-cancelled", lateCancel: false });
    expect(await signupDoc("inst1_vol2")).toMatchObject({ status: "cancelled", cancelReason: "org-cancelled" });
    await expect(call("coordinator", "cancelInstance", { instanceId: "inst1", reason: "again" }, user("coordA"))).resolves.toMatchObject({ alreadyCancelled: true, cancelledSignups: 2 });
  });

  it("mid-shift: checked-in volunteers complete with pending hours up to the cancel time", async () => {
    const start = BASE_MS + HOUR;
    await seedInstance("inst1", { startMs: start, signupCount: 2 });
    await seedSignup("inst1", "vol1", "checked-in", { checkInAt: tsAt(start) });
    await seedSignup("inst1", "vol2", "confirmed");
    testClock.set(start + 2 * HOUR);
    const out = await call("coordinator", "cancelInstance", { instanceId: "inst1", reason: "Power outage" }, user("coordA"));
    expect(out).toMatchObject({ cancelledSignups: 1, completedSignups: 1 });
    expect(await signupDoc("inst1_vol1")).toMatchObject({ status: "completed", autoCompleted: true });
    const log = (await db.collection(COLLECTIONS.hoursLogs).doc("inst1_vol1").get()).data() as HoursLogDoc;
    expect(log).toMatchObject({ source: "org-cancel", minutes: 120, status: "pending", needsReview: true });
  });

  it("refuses ended shifts, short reasons, other orgs, and kiosk tokens", async () => {
    await seedInstance("inst1");
    await expectCode(call("coordinator", "cancelInstance", { instanceId: "inst1", reason: "no" }, user("coordA")), "INVALID_INPUT");
    await expectCode(call("coordinator", "cancelInstance", { instanceId: "inst1", reason: "Weather" }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "cancelInstance", { instanceId: "inst1", reason: "Weather" }, kioskUser("inst1")), "PERMISSION_DENIED");
    testClock.advance(8 * HOUR);
    await expectCode(call("coordinator", "cancelInstance", { instanceId: "inst1", reason: "Weather" }, user("coordA")), "SHIFT_ENDED");
  });
});
