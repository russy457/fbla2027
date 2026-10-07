/**
 * storeLetterPdf.ts
 * Renders a letter's PDF from its frozen snapshot and saves it to Storage at
 * letters/{uid}/{letterId}.pdf (SPEC 3.22, 5.6 step 5), then records
 * pdfStatus "ready" or "failed" on the letter. A failure never undoes the
 * letter: the volunteer retries with the same nonce and only the PDF is
 * re-rendered.
 */
import type { Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";
import { COLLECTIONS, formatLongDate, DEFAULT_TIME_ZONE, type LetterDoc, type PdfStatus } from "@fbla/shared";
import type { Logger } from "../lib/deps";
import { ts } from "../lib/firestore";
import { renderLetterPdf } from "./renderLetterPdf";

export interface StorePdfParams {
  readonly db: Firestore;
  readonly storage: Storage;
  readonly bucket: string;
  readonly log: Logger;
  readonly appBaseUrl: string;
  readonly letterId: string;
  readonly letter: LetterDoc;
  readonly fullName: string;
  readonly nowMs: number;
}

export const storeLetterPdf = async (params: StorePdfParams): Promise<PdfStatus> => {
  const { letter } = params;
  const letterRef = params.db.collection(COLLECTIONS.letters).doc(params.letterId);
  try {
    const bytes = await renderLetterPdf({
      fullName: params.fullName,
      issuedAtLabel: formatLongDate(letter.issuedAt.toDate(), DEFAULT_TIME_ZONE),
      verifyCode: letter.verifyCode,
      verifyUrl: `${params.appBaseUrl}/verify/${letter.verifyCode}`,
      from: letter.evidence.from,
      to: letter.evidence.to,
      rows: letter.evidence.perOrg.filter((row) => row.verified),
      totalMinutes: letter.evidence.totalMinutes,
      excludedUnverifiedMinutes: letter.evidence.excludedUnverifiedMinutes
    });
    await params.storage
      .bucket(params.bucket)
      .file(letter.pdfPath)
      .save(bytes, { contentType: "application/pdf", resumable: false, metadata: { cacheControl: "private, max-age=0" } });
    await letterRef.update({ pdfStatus: "ready", updatedAt: ts(params.nowMs) });
    return "ready";
  } catch (error) {
    params.log.error("letter PDF failed", { letterId: params.letterId, error: error instanceof Error ? error.message : String(error) });
    await letterRef.update({ pdfStatus: "failed", updatedAt: ts(params.nowMs) });
    return "failed";
  }
};
