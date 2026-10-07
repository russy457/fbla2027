/**
 * getPdfUrl.ts
 * volunteer.getPdfUrl (SPEC 3.22, Appendix B 48): a 5-minute link to one of
 * the caller's own PDFs, a letter (letters/{uid}/{letterId}.pdf) or an hours
 * report (reports/{uid}/{reportId}.pdf). Checks, in order:
 *   1. the input schema accepts only those two path shapes (no "..", no
 *      extra segments, no other folders),
 *   2. the uid in the path is the caller: the same rule storage.rules applies
 *      to client reads, which stay owner-only as defense in depth,
 *   3. the letter or report document exists, belongs to the caller, names
 *      this exact path, and its PDF is ready; otherwise NOT_FOUND,
 *   4. an org participation report is refused here (PERMISSION_DENIED):
 *      coordinator.getOrgReportUrl serves it after re-checking membership.
 */
import { AppError, COLLECTIONS, parsePdfPath, type LetterDoc, type ParsedPdfPath, type ReportDoc } from "@fbla/shared";
import type { Firestore } from "firebase-admin/firestore";
import { profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { readDoc } from "../lib/firestore";
import { signedPdfUrl } from "../lib/signedPdfUrl";

const assertLetterReady = async (db: Firestore, target: ParsedPdfPath, path: string): Promise<void> => {
  const letter = readDoc<LetterDoc>(await db.collection(COLLECTIONS.letters).doc(target.id).get());
  if (letter === null || letter.uid !== target.uid || letter.pdfPath !== path || letter.pdfStatus !== "ready") throw new AppError("NOT_FOUND");
};

const assertVolunteerReportReady = async (db: Firestore, target: ParsedPdfPath, path: string): Promise<void> => {
  const report = readDoc<ReportDoc>(await db.collection(COLLECTIONS.reports).doc(target.id).get());
  if (report === null || report.ownerUid !== target.uid || report.pdfPath !== path || report.status !== "ready") throw new AppError("NOT_FOUND");
  if (report.kind !== "volunteer-hours") throw new AppError("PERMISSION_DENIED");
};

export const getPdfUrl = defineCallable({
  endpoint: "volunteer",
  op: "getPdfUrl",
  auth: profileComplete(),
  handler: async ({ input, caller, deps }) => {
    const target = parsePdfPath(input.path);
    // The schema already holds the pattern; this keeps the handler safe on its own.
    if (target === null) throw new AppError("INVALID_INPUT", { fields: "path" });
    if (target.uid !== caller.uid) throw new AppError("PERMISSION_DENIED");
    if (target.folder === "letters") await assertLetterReady(deps.db, target, input.path);
    else await assertVolunteerReportReady(deps.db, target, input.path);
    return signedPdfUrl(deps, input.path);
  }
});
