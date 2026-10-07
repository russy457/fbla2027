/**
 * shiftDocs.ts
 * Shift documents for Tier 0 (SPEC#dm-instances, 3.9 instanceSecrets,
 * SPEC#dm-signups, SPEC#dm-signupcontacts). The waitlist fields exist from
 * Tier 0 so the Tier 1 waitlist needs no data migration.
 */
import { z } from "zod";
import { SIGNUP_ACTORS } from "../stateMachine";
import { CANCEL_REASONS, instanceStatusSchema, signupStatusSchema, timestampSchema } from "./common";

const auditFields = { createdAt: timestampSchema, updatedAt: timestampSchema };

export const waitlistEntrySchema = z.object({ uid: z.string(), signupId: z.string(), seq: z.number().int() });
export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>;

/** instances/{instanceId}: one dated, timed occurrence ("shift" in UI copy). */
export const instanceDocSchema = z.object({
  orgId: z.string(),
  opportunityId: z.string(),
  seriesId: z.string().nullable(),
  title: z.string(),
  orgName: z.string(),
  orgVerified: z.boolean(),
  minAge: z.number().int(),
  timeZone: z.string(),
  start: timestampSchema,
  end: timestampSchema,
  capacity: z.number().int().min(1).max(200),
  /** Seats taken: confirmed + checked-in + completed. */
  signupCount: z.number().int().min(0),
  waitlist: z.array(waitlistEntrySchema),
  waitlistSeq: z.number().int().min(0),
  checkedInCount: z.number().int().min(0),
  status: instanceStatusSchema,
  cutoffAt: timestampSchema,
  finalizeAt: timestampSchema,
  cutoffDoneAt: timestampSchema.nullable(),
  finalizedAt: timestampSchema.nullable(),
  /** Earliest pending job time (cutoff or finalize); null once finalized or cancelled. */
  nextActionAt: timestampSchema.nullable(),
  sequence: z.number().int().min(0),
  cancelledAt: timestampSchema.nullable(),
  cancelledBy: z.string().nullable(),
  cancelReason: z.string().nullable(),
  ...auditFields
});
export type InstanceDoc = z.infer<typeof instanceDocSchema>;

/** instanceSecrets/{instanceId}: kiosk key material. Codes are never stored. */
export const instanceSecretDocSchema = z.object({
  salt: z.string(),
  keyVersion: z.number().int().min(1),
  ...auditFields
});
export type InstanceSecretDoc = z.infer<typeof instanceSecretDocSchema>;

export const historyEntrySchema = z.object({
  from: signupStatusSchema.nullable(),
  to: signupStatusSchema,
  actor: z.string(),
  op: z.enum(SIGNUP_ACTORS),
  at: timestampSchema
});

/** signups/{instanceId}_{uid} */
export const signupDocSchema = z.object({
  instanceId: z.string(),
  opportunityId: z.string(),
  orgId: z.string(),
  uid: z.string(),
  displayName: z.string(),
  instanceStart: timestampSchema,
  instanceEnd: timestampSchema,
  status: signupStatusSchema,
  waitlistSeq: z.number().int().nullable(),
  walkUp: z.boolean(),
  promotedAt: timestampSchema.nullable(),
  lateCancel: z.boolean(),
  cancelReason: z.enum(CANCEL_REASONS).nullable(),
  cancelledAt: timestampSchema.nullable(),
  checkInAt: timestampSchema.nullable(),
  checkOutAt: timestampSchema.nullable(),
  autoCompleted: z.boolean(),
  excuseReason: z.enum(["late-promotion", "coordinator"]).nullable(),
  attendance: z.object({ by: z.string(), at: timestampSchema, note: z.string() }).nullable(),
  disputeOpen: z.boolean(),
  dispute: z
    .object({
      note: z.string(),
      openedAt: timestampSchema,
      resolvedAt: timestampSchema.nullable(),
      resolvedBy: z.string().nullable()
    })
    .nullable(),
  history: z.array(historyEntrySchema).max(20),
  ...auditFields
});
export type SignupDoc = z.infer<typeof signupDocSchema>;

export const reliabilitySchema = z.object({
  attended: z.number().int().min(0),
  noShows: z.number().int().min(0),
  lateCancels: z.number().int().min(0),
  total: z.number().int().min(0),
  score: z.number().nullable(),
  isNew: z.boolean()
});
export type Reliability = z.infer<typeof reliabilitySchema>;

/** The reliability value for someone with no finished shifts yet (Tier 1 computes real values). */
export const NEW_VOLUNTEER_RELIABILITY: Reliability = Object.freeze({
  attended: 0,
  noShows: 0,
  lateCancels: 0,
  total: 0,
  score: null,
  isNew: true
});

/**
 * signupContacts/{signupId}: coordinator-only contact snapshot, kept apart from
 * signups so the kiosk can read the roster without contact data. When
 * `hidden` is true (minor at an unverified org, T4) the PII fields are absent.
 */
export const signupContactDocSchema = z.object({
  orgId: z.string(),
  instanceId: z.string(),
  uid: z.string(),
  hidden: z.boolean(),
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().nullable().optional(),
  isMinor: z.boolean(),
  reliability: reliabilitySchema,
  frozen: z.boolean(),
  refreshedAt: timestampSchema,
  ...auditFields
});
export type SignupContactDoc = z.infer<typeof signupContactDocSchema>;
