/**
 * reportService.ts
 * The flow both report ops share (SPEC 8.6; rewrite of the old
 * reportService.ts "validate sections, fetch, render" flow):
 *   1. reportId = first 32 hex of SHA-256("uid|kind|requestNonce"), so a retry
 *      with the same nonce finds the same report,
 *   2. an existing report owned by someone else is PERMISSION_DENIED; a ready
 *      one is returned as is; a failed or stuck "generating" one is re-rendered,
 *   3. otherwise reports/{reportId} is created "generating" and rendered.
 * Authorization happened before this runs (defineCallable + the op's mode).
 */
import { createHash } from "node:crypto";
import {
  AppError,
  COLLECTIONS,
  PATHS,
  orderSections,
  type ReportDoc,
  type ReportKind,
  type ReportParams,
  type ReportStatus
} from "@fbla/shared";
import type { ServerDeps } from "../lib/deps";
import { readDoc, ts } from "../lib/firestore";
import type { RenderReportInput } from "./renderReport";
import { storeReport } from "./storeReport";

const REPORT_ID_HEX_LENGTH = 32;

export const reportIdFor = (uid: string, kind: ReportKind, requestNonce: string): string =>
  createHash("sha256").update(`${uid}|${kind}|${requestNonce}`).digest("hex").slice(0, REPORT_ID_HEX_LENGTH);

export interface GenerateReportRequest {
  readonly deps: ServerDeps;
  readonly uid: string;
  readonly kind: ReportKind;
  readonly orgId: string | null;
  readonly requestNonce: string;
  readonly params: ReportParams;
  readonly nowMs: number;
  readonly prepare: () => Promise<RenderReportInput>;
}

export interface GenerateReportResult {
  readonly reportId: string;
  readonly status: ReportStatus;
  readonly pdfPath: string;
}

export const generateReport = async (request: GenerateReportRequest): Promise<GenerateReportResult> => {
  const { db, storage, env, log } = request.deps;
  const reportId = reportIdFor(request.uid, request.kind, request.requestNonce);
  const pdfPath = PATHS.reportPdf(request.uid, reportId);
  const reportRef = db.collection(COLLECTIONS.reports).doc(reportId);

  const existing = readDoc<ReportDoc>(await reportRef.get());
  if (existing !== null && existing.ownerUid !== request.uid) throw new AppError("PERMISSION_DENIED");
  if (existing?.status === "ready") return { reportId, status: "ready", pdfPath: existing.pdfPath };
  if (existing === null) {
    const at = ts(request.nowMs);
    const doc: ReportDoc = {
      ownerUid: request.uid,
      kind: request.kind,
      orgId: request.orgId,
      params: { ...request.params, sections: orderSections(request.kind, request.params.sections) },
      status: "generating",
      pdfPath,
      createdAt: at,
      updatedAt: at
    };
    await reportRef.set(doc);
  }
  const status = await storeReport({ db, storage, bucket: env.storageBucket, log, reportId, pdfPath, nowMs: request.nowMs, prepare: request.prepare });
  return { reportId, status, pdfPath };
};
