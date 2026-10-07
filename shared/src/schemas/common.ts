/**
 * common.ts
 * Enums and field schemas reused by every document and op schema
 * (SPEC#data-model 3.1). Enums are lowercase kebab strings defined once here
 * so the client, Functions, rules tests, and the seed agree on spelling.
 */
import { z } from "zod";
import { isValidYmd } from "../time";

export const CAUSE_AREAS = [
  "hunger-food-security",
  "education-youth",
  "health-wellness",
  "environment",
  "animal-welfare",
  "housing-homelessness",
  "seniors",
  "arts-culture",
  "disaster-relief",
  "community-development"
] as const;
export const causeAreaSchema = z.enum(CAUSE_AREAS);
export type CauseArea = z.infer<typeof causeAreaSchema>;

/** Signup statuses (SPEC#state-machine). */
export const SIGNUP_STATUSES = ["confirmed", "waitlisted", "checked-in", "completed", "no-show", "excused", "cancelled"] as const;
export const signupStatusSchema = z.enum(SIGNUP_STATUSES);
export type SignupStatus = z.infer<typeof signupStatusSchema>;

/** Statuses that hold or held a seat; a signup in one of these is "active" for re-signup checks. */
export const ACTIVE_SIGNUP_STATUSES = ["confirmed", "waitlisted", "checked-in", "completed"] as const satisfies readonly SignupStatus[];

export const INSTANCE_STATUSES = ["scheduled", "cancelled", "finalized"] as const;
export const instanceStatusSchema = z.enum(INSTANCE_STATUSES);
export type InstanceStatus = z.infer<typeof instanceStatusSchema>;

export const MEMBER_ROLES = ["owner", "coordinator"] as const;
export const memberRoleSchema = z.enum(MEMBER_ROLES);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const HOURS_SOURCES = ["kiosk", "finalize", "coordinator", "manual", "org-cancel"] as const;
export type HoursSource = (typeof HOURS_SOURCES)[number];

export const HOURS_STATUSES = ["approved", "pending", "rejected"] as const;
export type HoursStatus = (typeof HOURS_STATUSES)[number];

export const LETTER_STATUSES = ["valid", "superseded", "revoked"] as const;
export type LetterStatus = (typeof LETTER_STATUSES)[number];

export const PDF_STATUSES = ["generating", "ready", "failed"] as const;
export type PdfStatus = (typeof PDF_STATUSES)[number];

export const REVOKE_REASONS = ["issued-in-error", "hours-disputed", "duplicate", "other"] as const;
export const revokeReasonSchema = z.enum(REVOKE_REASONS);
export type RevokeReason = z.infer<typeof revokeReasonSchema>;

/** Public labels for revoke reasons; /verify shows the label, never the private note (SPEC#letters). */
export const REVOKE_REASON_LABELS: Readonly<Record<RevokeReason, string>> = {
  "issued-in-error": "Issued in error",
  "hours-disputed": "Hours disputed",
  duplicate: "Duplicate letter",
  other: "Other"
};

export const CANCEL_REASONS = ["volunteer", "promotion-release", "waitlist-cutoff", "org-cancelled"] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

/** `YYYY-MM-DD` that is a real calendar date. */
export const ymdSchema = z.string().refine(isValidYmd, { message: "must be a date as YYYY-MM-DD" });

/**
 * A Firestore document id we generate or accept from a client: letters,
 * digits, underscore, and dash only, so it can never contain a path slash.
 */
export const docIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, { message: "must be an id" });

/** Client-generated idempotency key, one per user intent (SPEC#api 5.1). */
export const requestNonceSchema = z.uuid();

/** E.164 phone number, for example +12105550123. */
export const e164Schema = z.string().regex(/^\+[1-9]\d{6,14}$/, { message: "must be a phone number like +12105550123" });

/** Person name part: trimmed, 1-40 characters. */
export const namePartSchema = z.string().trim().min(1).max(40);

/**
 * Anything with toMillis()/toDate(): the Admin SDK Timestamp and the web SDK
 * Timestamp both qualify, so document types work on both sides.
 */
export interface TimestampLike {
  toMillis(): number;
  toDate(): Date;
}

export const isTimestampLike = (value: unknown): value is TimestampLike =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { toMillis?: unknown }).toMillis === "function" &&
  typeof (value as { toDate?: unknown }).toDate === "function";

export const timestampSchema = z.custom<TimestampLike>(isTimestampLike, { message: "must be a Timestamp" });
