/**
 * checkInPhase.test.ts
 * Phone check-in states (SPEC#screen-kiosk-states) across the shared windows:
 * check-in opens 30 min before start and closes at end; check-out opens
 * 15 min after check-in and closes 30 min after end.
 */
import { describe, expect, it } from "vitest";
import { checkInPhase } from "./checkInPhase";

const MIN = 60_000;
const START = Date.UTC(2026, 9, 17, 14, 0, 0);
const END = START + 120 * MIN;
const scheduled = { status: "scheduled" as const, startMs: START, endMs: END };

describe("checkInPhase", () => {
  it("is not open before start - 30 min, and says when it opens", () => {
    expect(checkInPhase({ nowMs: START - 31 * MIN, instance: scheduled, signup: { status: "confirmed", checkInAtMs: null } })).toEqual({
      kind: "check-in-not-open",
      opensAtMs: START - 30 * MIN
    });
  });

  it("opens exactly at start - 30 min and stays open until end", () => {
    expect(checkInPhase({ nowMs: START - 30 * MIN, instance: scheduled, signup: { status: "confirmed", checkInAtMs: null } }).kind).toBe("check-in-open");
    expect(checkInPhase({ nowMs: END, instance: scheduled, signup: { status: "confirmed", checkInAtMs: null } }).kind).toBe("check-in-open");
    expect(checkInPhase({ nowMs: END + 1, instance: scheduled, signup: { status: "confirmed", checkInAtMs: null } }).kind).toBe("check-in-closed");
  });

  it("after check-in, check-out opens 15 minutes later", () => {
    const checkInAtMs = START + 2 * MIN;
    expect(checkInPhase({ nowMs: checkInAtMs + 5 * MIN, instance: scheduled, signup: { status: "checked-in", checkInAtMs } })).toEqual({
      kind: "check-out-not-open",
      checkInAtMs,
      opensAtMs: checkInAtMs + 15 * MIN
    });
    expect(checkInPhase({ nowMs: checkInAtMs + 15 * MIN, instance: scheduled, signup: { status: "checked-in", checkInAtMs } }).kind).toBe("check-out-open");
  });

  it("closes check-out 30 minutes after the end", () => {
    const checkInAtMs = START;
    expect(checkInPhase({ nowMs: END + 31 * MIN, instance: scheduled, signup: { status: "checked-in", checkInAtMs } }).kind).toBe("check-out-closed");
  });

  it("reports cancelled shifts, completed signups, and non-attending statuses", () => {
    expect(checkInPhase({ nowMs: START, instance: { ...scheduled, status: "cancelled" }, signup: { status: "confirmed", checkInAtMs: null } }).kind).toBe("shift-cancelled");
    expect(checkInPhase({ nowMs: START, instance: scheduled, signup: { status: "completed", checkInAtMs: START } }).kind).toBe("completed");
    expect(checkInPhase({ nowMs: START, instance: scheduled, signup: { status: "waitlisted", checkInAtMs: null } }).kind).toBe("not-attending");
  });
});
