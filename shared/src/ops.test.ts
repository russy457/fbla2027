import { describe, expect, it } from "vitest";
import { ENDPOINTS, OPS, OP_NAMES, isOpName } from "./ops";
import {
  NEW_VOLUNTEER_RELIABILITY,
  REVOKE_REASON_LABELS,
  REVOKE_REASONS,
  hoursLogDocSchema,
  isTimestampLike,
  setDemoClockInput,
  timestampSchema,
  ymdSchema
} from "./index";

const fakeTimestamp = { toMillis: () => 0, toDate: () => new Date(0) };

describe("op map (SPEC#api)", () => {
  it("lists the five endpoints and the Tier 0 ops", () => {
    expect(ENDPOINTS).toEqual(["volunteer", "kiosk", "coordinator", "admin", "ai"]);
    expect(OP_NAMES.volunteer).toEqual(expect.arrayContaining(["ping", "completeProfile", "signup", "cancelSignup", "issueLetter"]));
    expect(OP_NAMES.kiosk).toEqual(expect.arrayContaining(["ping", "issueKioskCode", "checkIn", "checkOut"]));
    expect(OP_NAMES.coordinator).toEqual(expect.arrayContaining(["ping", "startKiosk", "finalizeShift", "revokeLetter"]));
    expect(OP_NAMES.admin).toEqual(expect.arrayContaining(["ping", "runDueJobs", "setDemoClock"]));
    expect(OP_NAMES.ai).toEqual(expect.arrayContaining(["ping"]));
  });

  // Tier 1 lane B
  it("lists the Tier 1 lane B ops", () => {
    expect(OP_NAMES.volunteer).toEqual(expect.arrayContaining(["submitManualHours", "requestAttendanceReview", "generateVolunteerReport"]));
    expect(OP_NAMES.coordinator).toEqual(
      expect.arrayContaining(["registerOrganization", "updateOrganization", "createInvite", "redeemInvite", "removeMember", "upsertOpportunity", "createInstance", "updateInstance", "cancelInstance", "approveHours", "rejectHours", "setAttendance", "generateOrgReport"])
    );
    expect(OP_NAMES.admin).toEqual(expect.arrayContaining(["verifyOrganization"]));
  });
  // End Tier 1 lane B

  it("only treats own op keys as op names", () => {
    expect(isOpName("kiosk", "checkIn")).toBe(true);
    expect(isOpName("kiosk", "signup")).toBe(false);
    expect(isOpName("kiosk", "toString")).toBe(false);
  });

  it("rejects unknown input keys (strict inputs)", () => {
    expect(OPS.volunteer.signup.input.safeParse({ instanceId: "i1" }).success).toBe(true);
    expect(OPS.volunteer.signup.input.safeParse({ instanceId: "i1", orgId: "o1" }).success).toBe(false);
    expect(OPS.volunteer.signup.input.safeParse({ instanceId: "a/b" }).success).toBe(false);
    expect(OPS.kiosk.checkIn.input.safeParse({ instanceId: "i1", code: "12345" }).success).toBe(false);
  });

  it("validates issueLetter scope and nonce", () => {
    const nonce = "3b241101-e2bb-4255-8caf-4136c566a962";
    const scope = { orgId: "ALL", from: "2026-01-01", to: "2026-10-01" };
    expect(OPS.volunteer.issueLetter.input.safeParse({ scope, requestNonce: nonce }).success).toBe(true);
    expect(OPS.volunteer.issueLetter.input.safeParse({ scope: { ...scope, to: "2026-02-30" }, requestNonce: nonce }).success).toBe(false);
    expect(OPS.volunteer.issueLetter.input.safeParse({ scope, requestNonce: "nope" }).success).toBe(false);
  });
});

describe("schema refinements", () => {
  it("setDemoClock takes exactly one of offsetMs or advanceMinutes", () => {
    expect(setDemoClockInput.safeParse({ advanceMinutes: 15 }).success).toBe(true);
    expect(setDemoClockInput.safeParse({ offsetMs: 0 }).success).toBe(true);
    expect(setDemoClockInput.safeParse({}).success).toBe(false);
    expect(setDemoClockInput.safeParse({ offsetMs: 0, advanceMinutes: 15 }).success).toBe(false);
  });

  it("hours logs hold multiples of 15 minutes", () => {
    const base = {
      uid: "u",
      orgId: "o",
      instanceId: "i",
      signupId: "i_u",
      source: "kiosk",
      date: fakeTimestamp,
      status: "approved",
      needsReview: false,
      description: null,
      reviewedBy: null,
      reviewedAt: null,
      rejectReason: null,
      createdAt: fakeTimestamp,
      updatedAt: fakeTimestamp
    };
    expect(hoursLogDocSchema.safeParse({ ...base, minutes: 225 }).success).toBe(true);
    expect(hoursLogDocSchema.safeParse({ ...base, minutes: 224 }).success).toBe(false);
  });

  it("recognizes Timestamp-like values and calendar dates", () => {
    expect(isTimestampLike(fakeTimestamp)).toBe(true);
    expect(isTimestampLike(new Date())).toBe(false);
    expect(isTimestampLike(null)).toBe(false);
    expect(timestampSchema.safeParse("2026-01-01").success).toBe(false);
    expect(ymdSchema.safeParse("2026-02-28").success).toBe(true);
  });

  it("labels every revoke reason and starts volunteers as new", () => {
    expect(REVOKE_REASONS.every((reason) => REVOKE_REASON_LABELS[reason].length > 0)).toBe(true);
    expect(NEW_VOLUNTEER_RELIABILITY).toMatchObject({ isNew: true, score: null });
  });
});
