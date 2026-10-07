/**
 * recordDocs.ts
 * Hours and letter records for Tier 0 (SPEC#dm-hourslogs, SPEC#dm-letters,
 * SPEC#dm-verifications). Letters carry a frozen evidence snapshot (G19);
 * letterVerifications is the minimal public projection read by /verify.
 */
import { z } from "zod";
import {
  HOURS_SOURCES,
  HOURS_STATUSES,
  LETTER_STATUSES,
  PDF_STATUSES,
  revokeReasonSchema,
  timestampSchema,
  ymdSchema
} from "./common";

const auditFields = { createdAt: timestampSchema, updatedAt: timestampSchema };

/** hoursLogs/{logId}; logId = signupId for shift logs. Only `approved` counts. */
export const hoursLogDocSchema = z.object({
  uid: z.string(),
  orgId: z.string(),
  instanceId: z.string().nullable(),
  signupId: z.string().nullable(),
  source: z.enum(HOURS_SOURCES),
  date: timestampSchema,
  minutes: z
    .number()
    .int()
    .min(0)
    .max(720)
    .refine((value) => value % 15 === 0, { message: "must be a multiple of 15" }),
  status: z.enum(HOURS_STATUSES),
  needsReview: z.boolean(),
  description: z.string().max(500).nullable(),
  reviewedBy: z.string().nullable(),
  reviewedAt: timestampSchema.nullable(),
  rejectReason: z.string().nullable(),
  // Tier 1 lane B: volunteer display name on manual and coordinator logs, so the
  // Needs attention queue and org reports can name a volunteer with no signup.
  displayName: z.string().nullable().optional(),
  ...auditFields
});
export type HoursLogDoc = z.infer<typeof hoursLogDocSchema>;

export const letterScopeSchema = z.object({
  /** An organization id, or "ALL". */
  orgId: z.string().min(1),
  from: ymdSchema,
  to: ymdSchema
});

export const letterEvidenceSchema = z.object({
  logIds: z.array(z.string()),
  perOrg: z.array(z.object({ orgId: z.string(), orgName: z.string(), verified: z.boolean(), minutes: z.number().int() })),
  totalMinutes: z.number().int(),
  excludedUnverifiedMinutes: z.number().int(),
  excludedUnverifiedCount: z.number().int(),
  from: ymdSchema,
  to: ymdSchema
});
export type LetterEvidence = z.infer<typeof letterEvidenceSchema>;

/** letters/{letterId}; readable by the volunteer and admins only. */
export const letterDocSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  scope: letterScopeSchema,
  scopeKey: z.string(),
  orgIds: z.array(z.string()),
  verifyCode: z.string(),
  status: z.enum(LETTER_STATUSES),
  evidence: letterEvidenceSchema,
  rendererVersion: z.string(),
  pdfPath: z.string(),
  pdfStatus: z.enum(PDF_STATUSES),
  issuedAt: timestampSchema,
  supersededAt: timestampSchema.nullable(),
  supersededBy: z.string().nullable(),
  supersededReason: z.enum(["reissued", "hours-changed"]).nullable(),
  revokedAt: timestampSchema.nullable(),
  revokedBy: z.string().nullable(),
  revokeReason: revokeReasonSchema.nullable(),
  revokeNote: z.string().max(500).nullable(),
  ...auditFields
});
export type LetterDoc = z.infer<typeof letterDocSchema>;

/** letterVerifications/{verifyCode}: public by exact id; never the private note or full name. */
export const letterVerificationDocSchema = z.object({
  displayName: z.string(),
  orgNames: z.array(z.string()),
  totalMinutes: z.number().int(),
  from: ymdSchema,
  to: ymdSchema,
  issuedAt: timestampSchema,
  status: z.enum(LETTER_STATUSES),
  supersededByIssuedAt: timestampSchema.nullable(),
  revokeReasonLabel: z.string().nullable()
});
export type LetterVerificationDoc = z.infer<typeof letterVerificationDocSchema>;
