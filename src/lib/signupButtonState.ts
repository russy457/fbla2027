/**
 * signupButtonState.ts
 * The signup button matrix (SPEC#signup-matrix, D5) as one pure function, so
 * the rule order lives in one tested place and every shift card renders the
 * same answer. Conditions are evaluated top to bottom; the first match wins.
 *
 * Tier 0 scope: confirmed seats only. When no seat is free the answer is
 * "Full" (the waitlist and its "Join waitlist (#N)" state arrive in Tier 1;
 * a signup that is already waitlisted still renders correctly).
 */
import { ageOn, type SignupStatus } from "@fbla/shared";

export type SignupButtonKind =
  | "cancelled-by-org"
  | "signed-up"
  | "waitlisted"
  | "own-cancelled"
  | "attended"
  | "finished"
  | "started"
  | "age-restricted"
  | "minor-unverified"
  | "available"
  | "full"
  | "signed-out";

export interface SignupButtonState {
  readonly kind: SignupButtonKind;
  /** Button text, exactly as D5 words it. */
  readonly label: string;
  /** True when pressing the button starts an action (sign up, or sign in first). */
  readonly actionable: boolean;
  /** Extra line under the button, if any. */
  readonly reason: string | null;
  /** True when a Cancel action belongs next to the button (D5 "Signed up" row). */
  readonly canCancel: boolean;
}

export interface SignupButtonInput {
  readonly nowMs: number;
  readonly instance: {
    readonly status: "scheduled" | "cancelled" | "finalized";
    readonly startMs: number;
    readonly minAge: number;
    readonly orgVerified: boolean;
    readonly capacity: number;
    readonly signupCount: number;
    readonly timeZone: string;
  };
  /** The viewer's own signup on this shift, if any. */
  readonly signup: { readonly status: SignupStatus; readonly waitlistPosition: number | null; readonly waitlistSize: number | null } | null;
  /** The viewer's birth date (YYYY-MM-DD), or null when signed out. */
  readonly birthDate: string | null;
  readonly signedIn: boolean;
}

const ADULT_AGE = 18;

const state = (
  kind: SignupButtonKind,
  label: string,
  options: { actionable?: boolean; reason?: string | null; canCancel?: boolean } = {}
): SignupButtonState => ({
  kind,
  label,
  actionable: options.actionable ?? false,
  reason: options.reason ?? null,
  canCancel: options.canCancel ?? false
});

/** Answers for a viewer who already has a signup on this shift. */
const fromOwnSignup = (signup: NonNullable<SignupButtonInput["signup"]>): SignupButtonState | null => {
  switch (signup.status) {
    case "confirmed":
    case "checked-in":
      return state("signed-up", "Signed up", { canCancel: signup.status === "confirmed" });
    case "waitlisted": {
      const place = signup.waitlistPosition === null ? "" : ` #${signup.waitlistPosition}`;
      const size = signup.waitlistSize === null ? "" : ` of ${signup.waitlistSize}`;
      return state("waitlisted", `Waitlisted${place}${size}`);
    }
    case "cancelled":
      return state("own-cancelled", "Cancelled", { reason: "You cancelled this shift." });
    case "completed":
      return state("attended", "Completed", { reason: "Your hours for this shift are logged." });
    case "no-show":
    case "excused":
      return state("finished", "Shift ended");
  }
};

export const signupButtonState = (input: SignupButtonInput): SignupButtonState => {
  const { instance, signup, nowMs } = input;
  if (instance.status === "cancelled") return state("cancelled-by-org", "Cancelled by organization");
  const own = signup ? fromOwnSignup(signup) : null;
  if (own) return own;
  if (instance.status === "finalized" || nowMs >= instance.startMs) return state("started", "Shift started");
  if (!input.signedIn) {
    return state("signed-out", "Sign up", { actionable: true, reason: "You'll sign in first, then come back here." });
  }

  if (input.birthDate !== null) {
    const age = ageOn(input.birthDate, new Date(instance.startMs), instance.timeZone);
    if (age < instance.minAge) {
      return state("age-restricted", `Ages ${instance.minAge}+`, {
        reason: `You must be at least ${instance.minAge} to join this shift.`
      });
    }
    if (age < ADULT_AGE && !instance.orgVerified) {
      return state("minor-unverified", "Not available yet", {
        reason: "Volunteers under 18 can join after this organization is verified."
      });
    }
  }

  if (instance.signupCount < instance.capacity) return state("available", "Sign up", { actionable: true });
  return state("full", "Full");
};

/** Seats still open, never negative (signupCount can briefly exceed capacity after an edit). */
export const seatsLeft = (capacity: number, signupCount: number): number => Math.max(0, capacity - signupCount);
