/**
 * errorCatalog.ts
 * Every error code the system can return, with its user-facing copy
 * (SPEC#errors). Cloud Functions throw by code; the client maps the same code
 * back to the message, a next step ("fix"), and a Help Center article. The
 * copy follows the SPEC table word for word where the SPEC gives it.
 *
 * Messages take optional params. When a param is missing the message falls
 * back to a sentence that still reads well, because the client may describe
 * an error that arrived without params.
 */

/** Firebase callable error codes (the subset of FunctionsErrorCode we use). */
export type HttpsErrorCode =
  | "invalid-argument"
  | "unauthenticated"
  | "permission-denied"
  | "not-found"
  | "already-exists"
  | "failed-precondition"
  | "resource-exhausted"
  | "aborted"
  | "internal";

export type ErrorParams = Readonly<Record<string, string | number>>;

/**
 * Help Center articles that exist in src/content/help. Typing helpSlug with
 * this list makes a catalog entry pointing at a missing article a compile error.
 */
export const HELP_SLUGS = [
  "getting-started",
  "create-account",
  "privacy-and-minors",
  "find-and-sign-up",
  "kiosk-check-in",
  "check-out-and-hours",
  "troubleshooting-check-in",
  "verified-letters",
  "verify-a-letter",
  "accessibility-settings",
  "ai-assistant",
  "org-verification",
  "coordinator-start-kiosk",
  "coordinator-approve-hours",
  "coordinator-attendance",
  "coordinator-reports"
] as const;
export type HelpSlug = (typeof HELP_SLUGS)[number];

export interface ErrorCatalogEntry {
  readonly code: string;
  readonly httpsCode: HttpsErrorCode;
  readonly message: (params: ErrorParams) => string;
  readonly fix: string;
  readonly helpSlug: HelpSlug | null;
}

const entry = (
  code: string,
  httpsCode: HttpsErrorCode,
  message: string | ((params: ErrorParams) => string),
  fix: string,
  helpSlug: HelpSlug | null
): ErrorCatalogEntry =>
  Object.freeze({ code, httpsCode, message: typeof message === "string" ? () => message : message, fix, helpSlug });

/** Appends " (detail)" only when the param exists, so copy never shows "undefined". */
const withDetail = (base: string, detail: string | number | undefined, format: (value: string | number) => string) =>
  detail === undefined ? base : `${base} ${format(detail)}`;

export const ERROR_CATALOG = Object.freeze({
  // Generic codes every op can return.
  AUTH_REQUIRED: entry("AUTH_REQUIRED", "unauthenticated", "Please sign in to continue.", "Sign in.", null),
  PROFILE_INCOMPLETE: entry(
    "PROFILE_INCOMPLETE",
    "failed-precondition",
    "Finish setting up your profile first.",
    "Complete onboarding.",
    "create-account"
  ),
  PERMISSION_DENIED: entry(
    "PERMISSION_DENIED",
    "permission-denied",
    "You don't have access to that.",
    "Ask the organization owner.",
    "org-verification"
  ),
  NOT_FOUND: entry("NOT_FOUND", "not-found", "We couldn't find that.", "Check the link.", null),
  INVALID_INPUT: entry(
    "INVALID_INPUT",
    "invalid-argument",
    (p) => withDetail("Some fields need attention.", p.fields, (v) => `(${String(v)})`),
    "Fix the highlighted fields.",
    null
  ),
  UNKNOWN_OPERATION: entry(
    "UNKNOWN_OPERATION",
    "invalid-argument",
    (p) => `This app version asked for an action the server does not know (${String(p.op ?? "none")}).`,
    "Reload the page to get the latest version of the app.",
    null
  ),
  CONTENTION: entry("CONTENTION", "aborted", "Busy right now. Try again.", "Try again.", null),
  INTERNAL: entry(
    "INTERNAL",
    "internal",
    (p) => (p.requestId === undefined ? "Something went wrong." : `Something went wrong (ref: ${String(p.requestId)}).`),
    "Try again; share the ref with your coordinator.",
    null
  ),

  // Accounts, age, and minor safety (SPEC#minors).
  AGE_UNDER_13: entry(
    "AGE_UNDER_13",
    "failed-precondition",
    "You must be 13 or older to use this app",
    "Ask a parent or guardian.",
    "create-account"
  ),
  AGE_BELOW_MIN: entry(
    "AGE_BELOW_MIN",
    "failed-precondition",
    (p) => `You must be at least ${String(p.minAge ?? "the minimum age")} to join this shift.`,
    "Pick another shift.",
    "find-and-sign-up"
  ),
  MINOR_UNVERIFIED_ORG: entry(
    "MINOR_UNVERIFIED_ORG",
    "failed-precondition",
    "Volunteers under 18 can join this organization's shifts after it is verified.",
    "Pick a verified organization.",
    "privacy-and-minors"
  ),
  ADULT_REQUIRED: entry(
    "ADULT_REQUIRED",
    "failed-precondition",
    "You must be 18 or older to register an organization.",
    "Ask an adult leader to register.",
    "org-verification"
  ),
  EMAIL_NOT_VERIFIED: entry(
    "EMAIL_NOT_VERIFIED",
    "failed-precondition",
    "Verify your email first.",
    "Use the link we emailed you.",
    "org-verification"
  ),
  EIN_INVALID: entry("EIN_INVALID", "invalid-argument", "Enter the EIN as NN-NNNNNNN.", "Check the EIN format.", "org-verification"),
  BIRTHDATE_LOCKED: entry(
    "BIRTHDATE_LOCKED",
    "failed-precondition",
    "Your birth date can't be changed here.",
    "Contact an admin.",
    "privacy-and-minors"
  ),
  TURNSTILE_FAILED: entry(
    "TURNSTILE_FAILED",
    "permission-denied",
    "We couldn't confirm you're human.",
    "Refresh and try again.",
    "create-account"
  ),

  // Signup and shift lifecycle (SPEC#fn-signup, SPEC#state-machine).
  SHIFT_FULL: entry("SHIFT_FULL", "resource-exhausted", "This shift and its waitlist are full.", "Pick another date.", "find-and-sign-up"),
  WAITLIST_CLOSED: entry(
    "WAITLIST_CLOSED",
    "failed-precondition",
    "This shift is full and its waitlist has closed.",
    "Pick another date.",
    "find-and-sign-up"
  ),
  SHIFT_STARTED: entry(
    "SHIFT_STARTED",
    "failed-precondition",
    "This shift has already started.",
    "Contact the coordinator.",
    "find-and-sign-up"
  ),
  SHIFT_ENDED: entry(
    "SHIFT_ENDED",
    "failed-precondition",
    "This shift has already ended.",
    "Use attendance tools instead.",
    "coordinator-attendance"
  ),
  SHIFT_CANCELLED: entry(
    "SHIFT_CANCELLED",
    "failed-precondition",
    "This shift was cancelled by the organization.",
    "Pick another shift.",
    "find-and-sign-up"
  ),
  SHIFT_NOT_ENDED: entry(
    "SHIFT_NOT_ENDED",
    "failed-precondition",
    "This shift hasn't ended yet.",
    "Wait until it ends.",
    "coordinator-attendance"
  ),
  SIGNUP_CANCELLED_BEFORE: entry(
    "SIGNUP_CANCELLED_BEFORE",
    "failed-precondition",
    "You cancelled this shift earlier.",
    "Pick another date.",
    "find-and-sign-up"
  ),
  INVALID_TRANSITION: entry(
    "INVALID_TRANSITION",
    "failed-precondition",
    "That change isn't allowed for this signup right now.",
    "Refresh to see the current status.",
    "coordinator-attendance"
  ),
  RELEASE_NOT_ALLOWED: entry(
    "RELEASE_NOT_ALLOWED",
    "failed-precondition",
    "This spot can no longer be released without counting as a late cancel.",
    "Use Cancel instead.",
    "find-and-sign-up"
  ),

  // Kiosk, check-in, and check-out (SPEC#fn-checkin, SPEC#kiosk).
  CHECKIN_NOT_OPEN: entry(
    "CHECKIN_NOT_OPEN",
    "failed-precondition",
    (p) => withDetail("Check-in for this shift is not open right now.", p.opensAtLabel, (v) => `(opens ${String(v)})`),
    "Come back when check-in opens.",
    "troubleshooting-check-in"
  ),
  CHECKOUT_NOT_OPEN: entry(
    "CHECKOUT_NOT_OPEN",
    "failed-precondition",
    (p) => (p.opensAtLabel === undefined ? "Check-out is not open yet." : `Check-out opens at ${String(p.opensAtLabel)}.`),
    "Wait, then try again.",
    "check-out-and-hours"
  ),
  CHECKOUT_CLOSED: entry(
    "CHECKOUT_CLOSED",
    "failed-precondition",
    "Check-out for this shift has closed. Your coordinator will confirm your hours.",
    "Nothing; hours go to review.",
    "check-out-and-hours"
  ),
  NOT_SIGNED_UP: entry(
    "NOT_SIGNED_UP",
    "failed-precondition",
    "You don't have a confirmed spot on this shift.",
    "Sign up first if seats remain.",
    "troubleshooting-check-in"
  ),
  NOT_CHECKED_IN: entry("NOT_CHECKED_IN", "failed-precondition", "Check in before checking out.", "Check in first.", "check-out-and-hours"),
  KIOSK_CODE_INVALID: entry(
    "KIOSK_CODE_INVALID",
    "invalid-argument",
    "That code is wrong or expired. Enter the code shown on the kiosk now.",
    "Re-enter the current code.",
    "troubleshooting-check-in"
  ),
  KIOSK_NOT_OPEN: entry(
    "KIOSK_NOT_OPEN",
    "failed-precondition",
    "The kiosk isn't available for this shift right now.",
    "Start within an hour of the shift.",
    "coordinator-start-kiosk"
  ),
  KIOSK_SESSION_EXPIRED: entry(
    "KIOSK_SESSION_EXPIRED",
    "unauthenticated",
    "Kiosk session expired, coordinator sign-in",
    "Coordinator signs in again.",
    "coordinator-start-kiosk"
  ),
  RATE_LIMITED: entry(
    "RATE_LIMITED",
    "resource-exhausted",
    (p) => withDetail("Too many attempts, wait a minute.", p.retryAfterSec, (v) => `(retry in ${String(v)} s)`),
    "Wait.",
    "troubleshooting-check-in"
  ),

  // Coordinator tools (Tier 1+, listed now so the catalog is complete).
  CAPACITY_BELOW_SIGNUPS: entry(
    "CAPACITY_BELOW_SIGNUPS",
    "failed-precondition",
    (p) => withDetail("Remove volunteers first.", p.excess, (v) => `(${String(v)} over the new capacity)`),
    "Lower signups or keep capacity.",
    "coordinator-attendance"
  ),
  INSTANCE_TIME_INVALID: entry(
    "INSTANCE_TIME_INVALID",
    "invalid-argument",
    "Check the shift times (end after start, 12 hours max, in the future).",
    "Fix the times.",
    null
  ),
  SERIES_RULE_INVALID: entry("SERIES_RULE_INVALID", "invalid-argument", "Check the repeat rule.", "Pick weekdays and times.", null),
  ORG_HAS_ACTIVITY: entry(
    "ORG_HAS_ACTIVITY",
    "failed-precondition",
    "This organization has volunteer history, so it can be archived but not deleted.",
    "Archive instead.",
    "org-verification"
  ),
  ORG_HAS_UPCOMING_SHIFTS: entry(
    "ORG_HAS_UPCOMING_SHIFTS",
    "failed-precondition",
    "Cancel upcoming shifts with volunteers first.",
    "Cancel those shifts.",
    "org-verification"
  ),
  INVITE_INVALID: entry("INVITE_INVALID", "not-found", "This invite code is invalid or expired.", "Ask the owner for a new code.", null),
  ALREADY_MEMBER: entry("ALREADY_MEMBER", "already-exists", "You're already a member of this organization.", "Open the organization.", null),
  CANNOT_REMOVE_OWNER: entry("CANNOT_REMOVE_OWNER", "failed-precondition", "The owner can't be removed.", "none", null),
  MINUTES_REQUIRED: entry(
    "MINUTES_REQUIRED",
    "invalid-argument",
    "Enter the minutes served.",
    "Enter minutes in 15-minute steps.",
    "coordinator-attendance"
  ),
  DATE_OUT_OF_RANGE: entry(
    "DATE_OUT_OF_RANGE",
    "invalid-argument",
    "Pick a date in the last 12 months, not in the future.",
    "Fix the date.",
    "check-out-and-hours"
  ),
  DISPUTE_WINDOW_CLOSED: entry(
    "DISPUTE_WINDOW_CLOSED",
    "failed-precondition",
    "Reviews can be requested within 30 days of the shift.",
    "Contact the organization.",
    "coordinator-attendance"
  ),

  // Letters, AI, demo controls.
  NO_APPROVED_HOURS: entry(
    "NO_APPROVED_HOURS",
    "failed-precondition",
    "You have no approved hours from verified organizations in this range.",
    "Change the range.",
    "verified-letters"
  ),
  INPUT_TOO_LONG: entry("INPUT_TOO_LONG", "invalid-argument", "Keep it under 2,000 characters.", "Shorten it.", "ai-assistant"),
  REF_EXPIRED: entry("REF_EXPIRED", "failed-precondition", "This list is out of date.", "Rank again.", null),
  DEMO_MODE_REQUIRED: entry(
    "DEMO_MODE_REQUIRED",
    "failed-precondition",
    "Demo controls are off in this environment.",
    "none",
    null
  )
});

export type ErrorCode = keyof typeof ERROR_CATALOG;
