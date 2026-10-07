/**
 * waitlist.test.ts
 * Seat decisions (SPEC 5.3 steps 4-6), waitlist position, and promotion
 * order and timing (SPEC 6.1 row 3, 7.3 cutoff).
 */
import { describe, expect, it } from "vitest";
import { decideSeat, isBeforeCutoff, nextInLine, promotableSeats, waitlistPosition } from "./waitlist";

const CUTOFF = 1_000_000;

describe("decideSeat", () => {
  it("confirms a free seat, as a walk-up at or after the cutoff", () => {
    expect(decideSeat({ capacity: 3, signupCount: 2, waitlistLength: 0, nowMs: CUTOFF - 1, cutoffAtMs: CUTOFF })).toEqual({ kind: "confirmed", walkUp: false });
    expect(decideSeat({ capacity: 3, signupCount: 2, waitlistLength: 0, nowMs: CUTOFF, cutoffAtMs: CUTOFF })).toEqual({ kind: "confirmed", walkUp: true });
  });

  it("waitlists before the cutoff while the waitlist is shorter than capacity", () => {
    expect(decideSeat({ capacity: 2, signupCount: 2, waitlistLength: 1, nowMs: 0, cutoffAtMs: CUTOFF })).toEqual({ kind: "waitlisted", position: 2 });
  });

  it("refuses a full waitlist and a closed one", () => {
    expect(decideSeat({ capacity: 2, signupCount: 2, waitlistLength: 2, nowMs: 0, cutoffAtMs: CUTOFF })).toEqual({ kind: "refused", code: "SHIFT_FULL" });
    expect(decideSeat({ capacity: 2, signupCount: 2, waitlistLength: 0, nowMs: CUTOFF, cutoffAtMs: CUTOFF })).toEqual({ kind: "refused", code: "WAITLIST_CLOSED" });
  });
});

describe("waitlist helpers", () => {
  const list = [
    { uid: "c", signupId: "s_c", seq: 7 },
    { uid: "a", signupId: "s_a", seq: 2 },
    { uid: "b", signupId: "s_b", seq: 4 }
  ];

  it("positions by seq, not array order", () => {
    expect(waitlistPosition(list, 2)).toBe(1);
    expect(waitlistPosition(list, 7)).toBe(3);
  });

  it("promotes the lowest seq first, never more than the free seats", () => {
    expect(nextInLine(list, 1).map((entry) => entry.uid)).toEqual(["a"]);
    expect(nextInLine(list, 2).map((entry) => entry.uid)).toEqual(["a", "b"]);
    expect(nextInLine(list, 0)).toEqual([]);
    expect(nextInLine(list, -1)).toEqual([]);
    expect(list.map((entry) => entry.uid)).toEqual(["c", "a", "b"]);
  });

  it("allows promotion only before the cutoff", () => {
    expect(isBeforeCutoff(CUTOFF - 1, CUTOFF)).toBe(true);
    expect(isBeforeCutoff(CUTOFF, CUTOFF)).toBe(false);
    expect(promotableSeats(5, 3, CUTOFF - 1, CUTOFF)).toBe(2);
    expect(promotableSeats(5, 6, CUTOFF - 1, CUTOFF)).toBe(0);
    expect(promotableSeats(5, 3, CUTOFF, CUTOFF)).toBe(0);
  });
});
