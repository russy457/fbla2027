/**
 * storeReport.ts
 * Renders a report PDF and saves it to Storage at reports/{uid}/{reportId}.pdf
 * (SPEC 3.22, 8.6), then records status "ready" or "failed" on the report
 * document. Mirrors storeLetterPdf: a failure is logged and recorded, never
 * thrown, so the builder shows "failed" with Retry (same nonce).
 */
import type { Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";
import { COLLECTIONS, type ReportStatus } from "@fbla/shared";
import type { Logger } from "../lib/deps";
import { ts } from "../lib/firestore";
import { renderReport, type RenderReportInput } from "./renderReport";

export interface StoreReportParams {
  readonly db: Firestore;
  readonly storage: Storage;
  readonly bucket: string;
  readonly log: Logger;
  readonly reportId: string;
  readonly pdfPath: string;
  readonly nowMs: number;
  /** Loads data and builds the render input; runs inside the try so data errors also become "failed". */
  readonly prepare: () => Promise<RenderReportInput>;
}

export const storeReport = async (params: StoreReportParams): Promise<ReportStatus> => {
  const reportRef = params.db.collection(COLLECTIONS.reports).doc(params.reportId);
  try {
    const bytes = await renderReport(await params.prepare());
    await params.storage
      .bucket(params.bucket)
      .file(params.pdfPath)
      .save(bytes, { contentType: "application/pdf", resumable: false, metadata: { cacheControl: "private, max-age=0" } });
    await reportRef.update({ status: "ready", updatedAt: ts(params.nowMs) });
    return "ready";
  } catch (error) {
    params.log.error("report PDF failed", { reportId: params.reportId, error: error instanceof Error ? error.message : String(error) });
    await reportRef.update({ status: "failed", updatedAt: ts(params.nowMs) });
    return "failed";
  }
};
