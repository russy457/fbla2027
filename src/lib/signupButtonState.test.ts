/**
 * signupButtonState.test.ts
 * The D5 signup button matrix (SPEC#signup-matrix), row by row and in its
 * evaluation order, for the states Tier 0 supports.
 */
import { describe, expect, it } from "vitest";
import { seatsLeft, signupButtonState, type SignupButtonInput } from "./signupButtonState";

const START = Date.UTC(2026, 9, 17, 14, 0, 0);
const BEFORE = START - 60 * 60 * 1000;

/** An adult (born 2000) viewing an open, verified, 13+ shift with seats. */
const base: SignupButtonInput = {
  nowMs: BEFORE,
  instance: { status: "scheduled", startMs: START, minAge: 13, orgVerified: true, capacity: 3, signupCount: 1, timeZone: "America/Chicago" },
  signup: null,
  birthDate: "2000-05-01",
  signedIn: true
};

const own = (status: NonNullable<SignupButtonInput["signup"]>["status"]) => ({ status, waitlistPosition: null, waitlistSize: null });

describe("signupButtonState (D5)", () => {
  it("offers Sign up when a seat is free", () => {
    expect(signupButtonState(base)).toMatchObject({ kind: "available", label: "Sign up", actionable: true });
  });

  it("shows Full when no seat is left (Tier 0 has no waitlist)", () => {
    expect(signupButtonState({ ...base, instance: { ...base.instance, signupCount: 3 } })).toMatchObject({ kind: "full", label: "Full", actionable: false });
  });

  it("cancelled by the organization wins over everything, even an own signup", () => {
    const state = signupButtonState({ ...base, instance: { ...base.instance, status: "cancelled" }, signup: own("confirmed") });
    expect(state).toMatchObject({ kind: "cancelled-by-org", label: "Cancelled by organization", actionable: false });
  });

  it("shows Signed up with Cancel for a confirmed signup", () => {
    expect(signupButtonState({ ...base, signup: own("confirmed") })).toMatchObject({ kind: "signed-up", label: "Signed up", canCancel: true });
  });

  it("shows Signed up without Cancel once checked in", () => {
    expect(signupButtonState({ ...base, signup: own("checked-in") })).toMatchObject({ kind: "signed-up", canCancel: false });
  });

  it("shows the waitlist place for a waitlisted signup", () => {
    const state = signupButtonState({ ...base, signup: { status: "waitlisted", waitlistPosition: 2, waitlistSize: 3 } });
    expect(state.label).toBe("Waitlisted #2 of 3");
  });

  it("shows Cancelled for the viewer's own cancelled signup", () => {
    expect(signupButtonState({ ...base, signup: own("cancelled") })).toMatchObject({ kind: "own-cancelled", label: "Cancelled", actionable: false });
  });

  it("shows Shift started at and after the start time", () => {
    expect(signupButtonState({ ...base, nowMs: START })).toMatchObject({ kind: "started", label: "Shift started", actionable: false });
  });

  it("an own signup still reads Signed up after the shift starts", () => {
    expect(signupButtonState({ ...base, nowMs: START + 1, signup: own("confirmed") }).kind).toBe("signed-up");
  });

  it("shows Ages N+ with the reason when the viewer is too young on the shift date", () => {
    const state = signupButtonState({ ...base, instance: { ...base.instance, minAge: 16 }, birthDate: "2012-01-01" });
    expect(state).toMatchObject({ kind: "age-restricted", label: "Ages 16+", reason: "You must be at least 16 to join this shift." });
  });

  it("uses the age on the shift date, not today", () => {
    // Turns 16 on the shift date (Oct 17, 2026 in Chicago): allowed.
    const state = signupButtonState({ ...base, instance: { ...base.instance, minAge: 16 }, birthDate: "2010-10-17" });
    expect(state.kind).toBe("available");
  });

  it("blocks minors from unverified organizations with the D5 reason", () => {
    const state = signupButtonState({ ...base, instance: { ...base.instance, orgVerified: false }, birthDate: "2011-03-01" });
    expect(state).toMatchObject({
      kind: "minor-unverified",
      label: "Not available yet",
      reason: "Volunteers under 18 can join after this organization is verified."
    });
  });

  it("lets adults join unverified organizations", () => {
    expect(signupButtonState({ ...base, instance: { ...base.instance, orgVerified: false } }).kind).toBe("available");
  });

  it("signed-out visitors get Sign up that leads to sign-in", () => {
    const state = signupButtonState({ ...base, signedIn: false, birthDate: null });
    expect(state).toMatchObject({ kind: "signed-out", label: "Sign up", actionable: true });
  });

  it("finished statuses read as completed or ended", () => {
    expect(signupButtonState({ ...base, signup: own("completed") }).label).toBe("Completed");
    expect(signupButtonState({ ...base, signup: own("no-show") }).label).toBe("Shift ended");
  });

  it("seatsLeft never goes below zero", () => {
    expect(seatsLeft(3, 1)).toBe(2);
    expect(seatsLeft(3, 5)).toBe(0);
  });
});
