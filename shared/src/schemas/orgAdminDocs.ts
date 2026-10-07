/**
 * orgAdminDocs.ts
 * Tier 1 server-written documents for organization administration and
 * reports (SPEC 3.5 invites, SPEC 3.21 reports, SPEC 5.2 verifyOrganization
 * audit). All are written by Functions only:
 *   invites/{inviteId}           inviteId = SHA-256 hex of the code; the code
 *                                itself is shown once and never stored
 *   reports/{reportId}           report metadata; the PDF lives in Storage
 *   orgVerificationLog/{id}      admin verify/unverify audit with the private note
 */
import { z } from "zod";
import { timestampSchema, ymdSchema } from "./common";

const auditFields = { createdAt: timestampSchema, updatedAt: timestampSchema };

/** invites/{inviteId} (SPEC 3.5). Readable by the org owner only. */
export const inviteDocSchema = z.object({
  orgId: z.string(),
  role: z.literal("coordinator"),
  createdBy: z.string(),
  expiresAt: timestampSchema,
  redeemedBy: z.string().nullable(),
  redeemedAt: timestampSchema.nullable(),
  ...auditFields
});
export type InviteDoc = z.infer<typeof inviteDocSchema>;

export const REPORT_KINDS = ["volunteer-hours", "org-participation"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_STATUSES = ["generating", "ready", "failed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const reportParamsSchema = z.object({
  from: ymdSchema,
  to: ymdSchema,
  sections: z.array(z.string()),
  themeId: z.string(),
  /** Optional filter: one opportunity of the org (org reports only). */
  opportunityId: z.string().nullable()
});
export type ReportParams = z.infer<typeof reportParamsSchema>;

/** reports/{reportId} (SPEC 3.21). Readable and deletable by its owner. */
export const reportDocSchema = z.object({
  ownerUid: z.string(),
  kind: z.enum(REPORT_KINDS),
  orgId: z.string().nullable(),
  params: reportParamsSchema,
  status: z.enum(REPORT_STATUSES),
  pdfPath: z.string(),
  ...auditFields
});
export type ReportDoc = z.infer<typeof reportDocSchema>;

/** orgVerificationLog/{id}: server-only audit of admin verification changes (the note is private). */
export const orgVerificationLogDocSchema = z.object({
  orgId: z.string(),
  verified: z.boolean(),
  note: z.string(),
  by: z.string(),
  at: timestampSchema
});
export type OrgVerificationLogDoc = z.infer<typeof orgVerificationLogDocSchema>;
