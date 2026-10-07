/**
 * stateMachine.ts
 * The signup state machine (SPEC#state-machine). Every Cloud Function calls
 * assertTransition(from, to, actor) before writing a signup status, so the
 * allowed moves live in exactly one table. `from === null` means the signup
 * does not exist yet (creation).
 *
 * Side conditions that need data (seat free, inside the check-in window,
 * late promotion) are checked by the op itself; this module only answers
 * "may this actor ever move a signup from A to B?".
 */
import { AppError } from "./errors";
import type { SignupStatus } from "./schemas/common";

/** Ops (and the scheduler) that change a signup status. */
export const SIGNUP_ACTORS = [
  "signup",
  "cancelSignup",
  "updateInstance",
  "cancelInstance",
  "runDueJobs",
  "checkIn",
  "checkOut",
  "finalizeShift",
  "setAttendance"
] as const;
export type SignupActor = (typeof SIGNUP_ACTORS)[number];

export interface Transition {
  /** Row number in SPEC#state-machine table 6.1. */
  readonly row: number;
  readonly from: SignupStatus | null;
  readonly to: SignupStatus;
  readonly actors: readonly SignupActor[];
}

/**
 * SPEC table 6.1. Row 4 also lists finalizeShift: SPEC 5.5 cancels any
 * waitlisted signup left behind when the cutoff job did not run.
 */
export const TRANSITIONS: readonly Transition[] = Object.freeze([
  { row: 1, from: null, to: "confirmed", actors: ["signup"] },
  { row: 2, from: null, to: "waitlisted", actors: ["signup"] },
  { row: 3, from: "waitlisted", to: "confirmed", actors: ["cancelSignup", "updateInstance"] },
  { row: 4, from: "waitlisted", to: "cancelled", actors: ["cancelSignup", "runDueJobs", "cancelInstance", "finalizeShift"] },
  { row: 5, from: "confirmed", to: "cancelled", actors: ["cancelSignup", "cancelInstance"] },
  { row: 6, from: "confirmed", to: "checked-in", actors: ["checkIn"] },
  { row: 7, from: "checked-in", to: "completed", actors: ["checkOut", "finalizeShift", "cancelInstance"] },
  { row: 8, from: "confirmed", to: "no-show", actors: ["finalizeShift"] },
  { row: 9, from: "confirmed", to: "excused", actors: ["finalizeShift"] },
  { row: 10, from: "no-show", to: "excused", actors: ["setAttendance"] },
  { row: 11, from: "no-show", to: "completed", actors: ["setAttendance"] },
  { row: 12, from: "completed", to: "no-show", actors: ["setAttendance"] }
]);

/** Finds the table row for a move, or undefined when the move is never allowed. */
export const findTransition = (from: SignupStatus | null, to: SignupStatus): Transition | undefined =>
  TRANSITIONS.find((transition) => transition.from === from && transition.to === to);

/** True when `actor` may move a signup from `from` to `to`. */
export const canTransition = (from: SignupStatus | null, to: SignupStatus, actor: SignupActor): boolean =>
  findTransition(from, to)?.actors.includes(actor) ?? false;

/** Throws INVALID_TRANSITION unless the move is in the table for this actor. */
export const assertTransition = (from: SignupStatus | null, to: SignupStatus, actor: SignupActor): void => {
  if (!canTransition(from, to, actor)) {
    throw new AppError("INVALID_TRANSITION", { from: from ?? "none", to, actor });
  }
};

/** Statuses with no outgoing moves at all. */
export const isTerminalStatus = (status: SignupStatus): boolean =>
  !TRANSITIONS.some((transition) => transition.from === status);

/** One audit entry in signup.history (SPEC#dm-signups). */
export interface HistoryEntry<At> {
  readonly from: SignupStatus | null;
  readonly to: SignupStatus;
  readonly actor: string;
  readonly op: SignupActor;
  readonly at: At;
}

/** History is capped so a signup document cannot grow without bound (SPEC: <= 20). */
export const HISTORY_LIMIT = 20;

/** Returns a new history array with `entry` appended, keeping only the newest HISTORY_LIMIT entries. */
export const appendHistory = <At>(history: readonly HistoryEntry<At>[], entry: HistoryEntry<At>): HistoryEntry<At>[] =>
  [...history, entry].slice(-HISTORY_LIMIT);
