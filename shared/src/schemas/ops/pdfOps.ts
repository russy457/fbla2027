/**
 * pdfOps.ts
 * Schemas for the short-lived PDF link ops (Tier 1 review fix, SPEC 3.22,
 * Appendix B 48). The client never asks Storage for a permanent download URL;
 * it asks a Function, which re-checks ownership and signs a 5-minute link.
 *   volunteer.getPdfUrl          the caller's own letter or hours report, by Storage path
 *   coordinator.getOrgReportUrl  an org participation report the caller generated
 *
 * Only two path shapes are accepted, letters/{uid}/{letterId}.pdf and
 * reports/{uid}/{reportId}.pdf, each segment a plain id. Anything else
 * ("..", extra segments, encoded slashes, other folders) is INVALID_INPUT
 * before any lookup runs.
 */
import { z } from "zod";
import { docIdSchema } from "../common";

const SEGMENT = "[A-Za-z0-9_-]{1,128}";

/** The only Storage paths getPdfUrl accepts; groups are folder, uid, file id. */
export const PDF_PATH_PATTERN = new RegExp(`^(letters|reports)/(${SEGMENT})/(${SEGMENT})\\.pdf$`);

export const PDF_URL_TTL_MS = 5 * 60 * 1000;

export type PdfFolder = "letters" | "reports";

export interface ParsedPdfPath {
  readonly folder: PdfFolder;
  readonly uid: string;
  readonly id: string;
}

/** Splits an accepted PDF path into its parts, or null for any other string. */
export const parsePdfPath = (path: string): ParsedPdfPath | null => {
  if (!PDF_PATH_PATTERN.test(path)) return null;
  // The pattern guarantees exactly three plain segments and a ".pdf" suffix.
  const [folder, uid, id] = path.slice(0, -".pdf".length).split("/") as [PdfFolder, string, string];
  return { folder, uid, id };
};

export const getPdfUrlInput = z
  .object({ path: z.string().max(300).regex(PDF_PATH_PATTERN, { message: "must be letters/{uid}/{id}.pdf or reports/{uid}/{id}.pdf" }) })
  .strict();

export const getOrgReportUrlInput = z.object({ orgId: docIdSchema, reportId: docIdSchema }).strict();

export const pdfUrlOutput = z.object({
  /** Short-lived link to the PDF bytes. */
  url: z.string().min(1),
  /** ISO instant after which the link stops working. */
  expiresAt: z.string()
});

export type GetPdfUrlInput = z.infer<typeof getPdfUrlInput>;
export type GetOrgReportUrlInput = z.infer<typeof getOrgReportUrlInput>;
export type PdfUrlOutput = z.infer<typeof pdfUrlOutput>;
