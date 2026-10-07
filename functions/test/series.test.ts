/**
 * series.test.ts
 * Recurring series (Tier 2, SPEC 3.7, 5.2, 5.11 step 5, 7.3, 7.5):
 * upsertSeries materializes 8 weeks of `{seriesId}_{YYYYMMDD}` shifts in the
 * org zone (DST-correct in America/Denver), edits follow the new rule while
 * shifts with volunteers are kept, extendSeries and runDueJobs extend the
 * window, and whole-series signup / extendSeriesSignup report each date.
 * Every coordinator op: cross-org and kiosk-token denial (SPEC 4.4).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS, type InstanceDoc, type OpportunityDoc, type SeriesDoc, type SeriesSignupDoc } from "@fbla/shared";
import { BASE_MS, HOUR, adminUser, call, db, expectCode, kioskUser, resetEmulators, testClock, user } from "./harness";
import { seedWorld } from "./fixtures";

const DAY = 24 * HOUR;
const NONCE = "66666666-6666-4666-8666-666666666666";
const SATURDAY = 6;
const SUNDAY = 0;

const fields = {
  title: "Saturday pantry sort",
  description: "Sort and shelve donations.",
  causeArea: "hunger-food-security",
  type: "recurring",
  skills: ["Lifting"],
  minAge: 13,
  location: { address: { line1: "1 Main St", city: "San Antonio", state: "TX", zip: "78205" } }
};

const weekly = (weekdays: number[] = [SATURDAY]) => ({ frequency: "weekly", weekdays, startTime: "09:00", endTime: "13:00" });

interface UpsertOut {
  seriesId: string;
  created: boolean;
  materialized: number;
  rescheduled: number;
  removed: number;
  keptWithVolunteers: number;
}
interface SignupOut {
  results: Array<{ instanceId: string; date: string; outcome: string; reason?: string }>;
  coversThrough: string | null;
}

const createOpportunity = async (minAge = 13): Promise<string> => {
  const out = await call<{ opportunityId: string }>("coordinator", "upsertOpportunity", { orgId: "orgA", requestNonce: NONCE, fields: { ...fields, minAge } }, user("coordA"));
  return out.opportunityId;
};
const upsert = (opportunityId: string, extra: Record<string, unknown> = {}, as = user("coordA")) =>
  call<UpsertOut>("coordinator", "upsertSeries", { opportunityId, rule: weekly(), capacity: 3, startsOn: "2026-10-17", ...extra }, as);
const seriesShifts = async (seriesId: string): Promise<Array<InstanceDoc & { id: string }>> => {
  const snapshot = await db.collection(COLLECTIONS.instances).where("seriesId", "==", seriesId).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as InstanceDoc) })).sort((a, b) => a.start.toMillis() - b.start.toMillis());
};
const seriesDoc = async (seriesId: string) => (await db.collection(COLLECTIONS.series).doc(seriesId).get()).data() as SeriesDoc;

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
});

describe("coordinator.upsertSeries", () => {
  it("materializes every Saturday through today + 8 weeks with deterministic ids, once", async () => {
    const opportunityId = await createOpportunity();
    const out = await upsert(opportunityId);
    expect(out).toMatchObject({ created: true, materialized: 9, removed: 0, keptWithVolunteers: 0 });
    const shifts = await seriesShifts(out.seriesId);
    expect(shifts.map((shift) => shift.id)).toEqual(
      ["20261017", "20261024", "20261031", "20261107", "20261114", "20261121", "20261128", "20261205", "20261212"].map((day) => `${out.seriesId}_${day}`)
    );
    // Today's 9:00 AM CDT shift starts one hour after BASE_MS (8:00 AM CDT).
    expect(shifts[0]).toMatchObject({ seriesId: out.seriesId, opportunityId, capacity: 3, title: fields.title, status: "scheduled", timeZone: "America/Chicago" });
    expect(shifts[0]?.start.toMillis()).toBe(BASE_MS + HOUR);
    expect((shifts[0]?.end.toMillis() ?? 0) - (shifts[0]?.start.toMillis() ?? 0)).toBe(4 * HOUR);
    expect((await db.collection(COLLECTIONS.instanceSecrets).doc(shifts[0]?.id ?? "").get()).exists).toBe(true);

    const series = await seriesDoc(out.seriesId);
    expect(series).toMatchObject({ orgId: "orgA", opportunityId, status: "active", createdBy: "coordA", endsOn: null, timeZone: "America/Chicago" });
    expect(series.materializedThrough.toDate().toISOString()).toBe("2026-12-13T06:00:00.000Z");
    expect(series.nextExtendAt?.toMillis()).toBe(series.materializedThrough.toMillis() - 7 * DAY);
    const opportunity = (await db.collection(COLLECTIONS.opportunities).doc(opportunityId).get()).data() as OpportunityDoc;
    expect(opportunity.seriesId).toBe(out.seriesId);
    expect(opportunity.nextInstanceStart?.toMillis()).toBe(BASE_MS + HOUR);

    // Same input again: same series, nothing new.
    await expect(upsert(opportunityId)).resolves.toMatchObject({ seriesId: out.seriesId, created: false, materialized: 0, rescheduled: 0, removed: 0 });
    expect(await seriesShifts(out.seriesId)).toHaveLength(9);
  });

  it("keeps 9:00 local time across the November change in a Denver org", async () => {
    await db.collection(COLLECTIONS.organizations).doc("orgA").update({ timeZone: "America/Denver" });
    const opportunityId = await createOpportunity();
    const { seriesId } = await upsert(opportunityId, { startsOn: "2026-10-24", endsOn: "2026-11-07" });
    const shifts = await seriesShifts(seriesId);
    expect(shifts.map((shift) => shift.start.toDate().toISOString())).toEqual(["2026-10-24T15:00:00.000Z", "2026-10-31T15:00:00.000Z", "2026-11-07T16:00:00.000Z"]);
    expect(shifts.every((shift) => shift.timeZone === "America/Denver")).toBe(true);
    // endsOn is inside the window, so the series needs no further extension.
    expect(await seriesDoc(seriesId)).toMatchObject({ status: "ended", nextExtendAt: null });
  });

  it("supports biweekly and monthly rules", async () => {
    const opportunityId = await createOpportunity();
    const { seriesId } = await upsert(opportunityId, { rule: { ...weekly(), frequency: "biweekly" } });
    expect((await seriesShifts(seriesId)).map((shift) => shift.id.slice(-8))).toEqual(["20261017", "20261031", "20261114", "20261128", "20261212"]);
    await upsert(opportunityId, { rule: { ...weekly(), frequency: "monthly", monthWeek: -1 } });
    expect((await seriesShifts(seriesId)).map((shift) => shift.id.slice(-8))).toEqual(["20261031", "20261128"]);
  });

  it("on edit: empty shifts follow the new rule, shifts with volunteers are kept", async () => {
    const opportunityId = await createOpportunity();
    const { seriesId } = await upsert(opportunityId);
    const keptId = `${seriesId}_20261024`;
    await call("volunteer", "signup", { instanceId: keptId }, user("vol1"));

    const out = await upsert(opportunityId, { rule: weekly([SUNDAY]), capacity: 5 });
    expect(out).toMatchObject({ created: false, removed: 8, keptWithVolunteers: 1, materialized: 8 });
    const shifts = await seriesShifts(seriesId);
    expect(shifts.find((shift) => shift.id === keptId)).toMatchObject({ capacity: 3, signupCount: 1 });
    expect(shifts.filter((shift) => shift.id !== keptId).every((shift) => shift.start.toDate().getUTCDay() === SUNDAY && shift.capacity === 5)).toBe(true);

    // A time change on empty shifts reschedules them in place and bumps the calendar sequence.
    const moved = await upsert(opportunityId, { rule: { ...weekly([SUNDAY]), startTime: "10:00", endTime: "12:00" }, capacity: 5 });
    expect(moved).toMatchObject({ rescheduled: 8, removed: 0, materialized: 0 });
    const sunday = (await seriesShifts(seriesId)).find((shift) => shift.id === `${seriesId}_20261018`);
    expect(sunday?.sequence).toBe(1);
    expect(sunday?.cutoffAt.toMillis()).toBe((sunday?.start.toMillis() ?? 0) - 2 * HOUR);
  });

  it("refuses bad rules, archived listings, other orgs, and kiosk tokens", async () => {
    const opportunityId = await createOpportunity();
    await expectCode(upsert(opportunityId, { rule: { ...weekly(), startTime: "13:00", endTime: "09:00" } }), "SERIES_RULE_INVALID");
    await expectCode(upsert(opportunityId, { rule: { ...weekly(), frequency: "monthly" } }), "SERIES_RULE_INVALID");
    await expectCode(upsert(opportunityId, { endsOn: "2026-10-16" }), "SERIES_RULE_INVALID");
    await expectCode(upsert(opportunityId, { rule: { ...weekly(), weekdays: [] } }), "INVALID_INPUT");
    await expectCode(upsert(opportunityId, {}, user("coordB")), "PERMISSION_DENIED");
    await expectCode(upsert(opportunityId, {}, kioskUser("inst1")), "PERMISSION_DENIED");
    await db.collection(COLLECTIONS.opportunities).doc(opportunityId).update({ status: "archived" });
    await expectCode(upsert(opportunityId), "INVALID_INPUT");
  });
});

describe("coordinator.extendSeries and runDueJobs", () => {
  it("adds the dates that entered the window, and runDueJobs does the same when nextExtendAt arrives", async () => {
    const opportunityId = await createOpportunity();
    const { seriesId } = await upsert(opportunityId);
    await expect(call("coordinator", "extendSeries", { seriesId }, user("coordA"))).resolves.toMatchObject({ created: 0 });

    testClock.advance(14 * DAY);
    const extended = await call<{ created: number; materializedThrough: string }>("coordinator", "extendSeries", { seriesId }, user("coordA"));
    expect(extended).toEqual({ created: 2, materializedThrough: "2026-12-27T06:00:00.000Z" });

    // Past nextExtendAt (7 days before materializedThrough): the scheduler extends it.
    testClock.set((await seriesDoc(seriesId)).nextExtendAt?.toMillis() ?? 0);
    const run = await call<{ processed: { seriesExtended: number }; outcome: string }>("admin", "runDueJobs", {}, adminUser());
    expect(run.processed.seriesExtended).toBe(1);
    expect((await seriesShifts(seriesId)).map((shift) => shift.id.slice(-8))).toContain("20270102");
    // Nothing is due again until the next week passes.
    const again = await call<{ processed: { seriesExtended: number } }>("admin", "runDueJobs", {}, adminUser());
    expect(again.processed.seriesExtended).toBe(0);
  });

  it("denies other orgs, kiosk tokens, and unknown series", async () => {
    const opportunityId = await createOpportunity();
    const { seriesId } = await upsert(opportunityId);
    await expectCode(call("coordinator", "extendSeries", { seriesId }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "extendSeries", { seriesId }, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "extendSeries", { seriesId: "missing" }, user("coordA")), "NOT_FOUND");
  });
});

describe("volunteer.signupSeries and extendSeriesSignup", () => {
  it("signs up for every upcoming date, reporting full and cancelled dates, and is safe to retry", async () => {
    const opportunityId = await createOpportunity();
    const { seriesId } = await upsert(opportunityId, { capacity: 1 });
    await call("volunteer", "signup", { instanceId: `${seriesId}_20261024` }, user("vol2"));
    await call("coordinator", "cancelInstance", { instanceId: `${seriesId}_20261031`, reason: "Holiday closure" }, user("coordA"));

    const out = await call<SignupOut>("volunteer", "signupSeries", { seriesId }, user("vol1"));
    expect(out.coversThrough).toBe("2026-12-12");
    expect(out.results).toHaveLength(9);
    const byDate = Object.fromEntries(out.results.map((result) => [result.date, result]));
    expect(byDate["2026-10-17"]).toMatchObject({ outcome: "confirmed" });
    expect(byDate["2026-10-24"]).toMatchObject({ outcome: "waitlisted" });
    expect(byDate["2026-10-31"]).toMatchObject({ outcome: "skipped", reason: "SHIFT_CANCELLED" });
    expect(out.results.filter((result) => result.outcome === "confirmed")).toHaveLength(7);

    const record = (await db.collection(COLLECTIONS.seriesSignups).doc(`${seriesId}_vol1`).get()).data() as SeriesSignupDoc;
    expect(record).toMatchObject({ seriesId, orgId: "orgA", uid: "vol1", coversThrough: "2026-12-12" });

    // A retry changes nothing and reports the same statuses.
    const retry = await call<SignupOut>("volunteer", "signupSeries", { seriesId }, user("vol1"));
    expect(retry.results.map((result) => result.outcome)).toEqual(out.results.map((result) => result.outcome));
    expect((await db.collection(COLLECTIONS.instances).doc(`${seriesId}_20261017`).get()).data()).toMatchObject({ signupCount: 1 });
  });

  it("applies the minimum age to each date", async () => {
    const opportunityId = await createOpportunity(16);
    const { seriesId } = await upsert(opportunityId);
    const out = await call<SignupOut>("volunteer", "signupSeries", { seriesId }, user("minor"));
    expect(new Set(out.results.map((result) => result.reason))).toEqual(new Set(["AGE_BELOW_MIN"]));
  });

  it("extendSeriesSignup adds only the dates after coversThrough", async () => {
    const opportunityId = await createOpportunity();
    const { seriesId } = await upsert(opportunityId);
    await call("volunteer", "signupSeries", { seriesId }, user("vol1"));
    testClock.advance(14 * DAY);
    await call("coordinator", "extendSeries", { seriesId }, user("coordA"));

    const out = await call<SignupOut>("volunteer", "extendSeriesSignup", { seriesId }, user("vol1"));
    expect(out.results.map((result) => [result.date, result.outcome])).toEqual([
      ["2026-12-19", "confirmed"],
      ["2026-12-26", "confirmed"]
    ]);
    expect(out.coversThrough).toBe("2026-12-26");
    // Nothing new: an empty list, coverage unchanged.
    await expect(call<SignupOut>("volunteer", "extendSeriesSignup", { seriesId }, user("vol1"))).resolves.toEqual({ results: [], coversThrough: "2026-12-26" });
  });

  it("refuses unknown series, kiosk tokens, and incomplete profiles", async () => {
    const opportunityId = await createOpportunity();
    const { seriesId } = await upsert(opportunityId);
    await expectCode(call("volunteer", "signupSeries", { seriesId: "missing" }, user("vol1")), "NOT_FOUND");
    await expectCode(call("volunteer", "signupSeries", { seriesId }, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("volunteer", "extendSeriesSignup", { seriesId }, user("incomplete")), "PROFILE_INCOMPLETE");
  });
});
