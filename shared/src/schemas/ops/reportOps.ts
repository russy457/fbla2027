/**
 * reportOps.ts
 * Schemas for the PDF report ops (Tier 1, SPEC 5.2 and 8.6):
 *   volunteer.generateVolunteerReport   the caller's own hours
 *   coordinator.generateOrgReport       one organization's participation
 * reportId comes from the request nonce, so a retry (same nonce) returns the
 * same report and re-renders only a failed PDF.
 */
import { z } from "zod";
import { ORG_REPORT_SECTIONS, REPORT_THEME_IDS, VOLUNTEER_REPORT_SECTIONS } from "../../reports";
import { REPORT_STATUSES } from "../orgAdminDocs";
import { docIdSchema, requestNonceSchema, ymdSchema } from "../common";

const distinct = <T extends z.ZodType>(item: T) =>
  z
    .array(item)
    .min(1)
    .refine((values) => new Set(values).size === values.length, { message: "must not repeat a section" });

const rangeFields = { from: ymdSchema, to: ymdSchema, themeId: z.enum(REPORT_THEME_IDS), requestNonce: requestNonceSchema };

const orderedRange = (value: { from: string; to: string }): boolean => value.from <= value.to;
const RANGE_MESSAGE = { message: "from must be on or before to", path: ["from"] };

export const generateVolunteerReportInput = z
  .object({ ...rangeFields, sections: distinct(z.enum(VOLUNTEER_REPORT_SECTIONS)) })
  .strict()
  .refine(orderedRange, RANGE_MESSAGE);

export const generateOrgReportInput = z
  .object({ ...rangeFields, orgId: docIdSchema, sections: distinct(z.enum(ORG_REPORT_SECTIONS)), opportunityId: docIdSchema.nullable().optional() })
  .strict()
  .refine(orderedRange, RANGE_MESSAGE);

export const generateReportOutput = z.object({
  reportId: z.string(),
  status: z.enum(REPORT_STATUSES),
  /** Storage path of the PDF (owner-only read). */
  pdfPath: z.string()
});
