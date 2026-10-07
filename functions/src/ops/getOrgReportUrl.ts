/**
 * getOrgReportUrl.ts
 * coordinator.getOrgReportUrl (SPEC 3.22, 8.6, Appendix B 48): a 5-minute
 * link to an organization participation report PDF. Auth is
 * coordinatorOfOrg(orgId), so a person removed from the org loses access
 * to its reports even though the PDF sits in their own Storage folder.
 * On top of that the report must be one the caller generated (storage.rules
 * lets only the owner read reports/{uid}/*; another coordinator generates
 * their own copy), for this org, and ready. The Storage path is rebuilt on
 * the server from the caller's uid and the report id, never taken from input.
 */
import { AppError, COLLECTIONS, PATHS, type ReportDoc } from "@fbla/shared";
import { coordinatorOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { readDoc } from "../lib/firestore";
import { orgResource } from "../lib/orgAuth";
import { signedPdfUrl } from "../lib/signedPdfUrl";

export const getOrgReportUrl = defineCallable({
  endpoint: "coordinator",
  op: "getOrgReportUrl",
  auth: coordinatorOf(orgResource((input: { orgId: string }) => input.orgId)),
  handler: async ({ input, caller, deps, resource }) => {
    const report = readDoc<ReportDoc>(await deps.db.collection(COLLECTIONS.reports).doc(input.reportId).get());
    if (report === null) throw new AppError("NOT_FOUND");
    if (report.ownerUid !== caller.uid) throw new AppError("PERMISSION_DENIED");
    const path = PATHS.reportPdf(caller.uid, input.reportId);
    const matches = report.kind === "org-participation" && report.orgId === resource.id && report.pdfPath === path;
    if (!matches || report.status !== "ready") throw new AppError("NOT_FOUND");
    return signedPdfUrl(deps, path);
  }
});
