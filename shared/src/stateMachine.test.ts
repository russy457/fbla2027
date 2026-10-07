import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { SIGNUP_STATUSES, type SignupStatus } from "./schemas/common";
import {
  HISTORY_LIMIT,
  SIGNUP_ACTORS,
  TRANSITIONS,
  appendHistory,
  assertTransition,
  canTransition,
  findTransition,
  isTerminalStatus,
  type HistoryEntry,
  type SignupActor
} from "./stateMachine";

/** SPEC 6.1 written out independently of the module, so a typo in either side fails. */
const ALLOWED: ReadonlyArray<[SignupStatus | null, SignupStatus, SignupActor[]]> = [
  [null, "confirmed", ["signup"]],
  [null, "waitlisted", ["signup"]],
  ["waitlisted", "confirmed", ["cancelSignup", "updateInstance"]],
  ["waitlisted", "cancelled", ["cancelSignup", "runDueJobs", "cancelInstance", "finalizeShift"]],
  ["confirmed", "cancelled", ["cancelSignup", "cancelInstance"]],
  ["confirmed", "checked-in", ["checkIn"]],
  ["checked-in", "completed", ["checkOut", "finalizeShift", "cancelInstance"]],
  ["confirmed", "no-show", ["finalizeShift"]],
  ["confirmed", "excused", ["finalizeShift"]],
  ["no-show", "excused", ["setAttendance"]],
  ["no-show", "completed", ["setAttendance"]],
  ["completed", "no-show", ["setAttendance"]]
];

const allowedActors = (from: SignupStatus | null, to: SignupStatus): SignupActor[] =>
  ALLOWED.find(([f, t]) => f === from && t === to)?.[2] ?? [];

const FROM_STATES: Array<SignupStatus | null> = [null, ...SIGNUP_STATUSES];

describe("signup state machine (SPEC#state-machine)", () => {
  it("has the 12 rows of table 6.1", () => {
    expect(TRANSITIONS.map((t) => t.row)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  // Every (from, to, actor) triple: 8 x 7 x 9 = 504 cases.
  for (const from of FROM_STATES) {
    for (const to of SIGNUP_STATUSES) {
      it(`${from ?? "(none)"} -> ${to}`, () => {
        const expected = allowedActors(from, to);
        for (const actor of SIGNUP_ACTORS) {
          const allowed = expected.includes(actor);
          expect(canTransition(from, to, actor)).toBe(allowed);
          if (allowed) {
            expect(() => assertTransition(from, to, actor)).not.toThrow();
          } else {
            expect(() => assertTransition(from, to, actor)).toThrow(AppError);
          }
        }
      });
    }
  }

  it("throws INVALID_TRANSITION with the move in params", () => {
    try {
      assertTransition(null, "completed", "checkOut");
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: "INVALID_TRANSITION", params: { from: "none", to: "completed", actor: "checkOut" } });
    }
    expect(() => assertTransition("cancelled", "confirmed", "signup")).toThrow(/isn't allowed/);
  });

  it("finds rows and marks cancelled and excused as terminal", () => {
    expect(findTransition("confirmed", "checked-in")?.row).toBe(6);
    expect(findTransition("cancelled", "confirmed")).toBeUndefined();
    expect(isTerminalStatus("cancelled")).toBe(true);
    expect(isTerminalStatus("excused")).toBe(true);
    expect(isTerminalStatus("confirmed")).toBe(false);
  });
});

describe("appendHistory", () => {
  const entry = (n: number): HistoryEntry<number> => ({ from: null, to: "confirmed", actor: "u", op: "signup", at: n });

  it("appends without mutating and keeps the newest entries", () => {
    const original = [entry(1)];
    const next = appendHistory(original, entry(2));
    expect(original).toHaveLength(1);
    expect(next.map((e) => e.at)).toEqual([1, 2]);

    const full = Array.from({ length: HISTORY_LIMIT }, (_, i) => entry(i));
    const capped = appendHistory(full, entry(99));
    expect(capped).toHaveLength(HISTORY_LIMIT);
    expect(capped[0]?.at).toBe(1);
    expect(capped.at(-1)?.at).toBe(99);
  });
});
