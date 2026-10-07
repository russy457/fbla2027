/**
 * orgParticipation.ts
 * Loads one organization's data for the participation report (SPEC 8.6;
 * rewrite of the old business fetchers in dataFetcher.ts):
 *   hoursLogs  where orgId == X, date in range          (index hoursLogs orgId + date)
 *   signups    where orgId == X, instanceStart in range (index signups orgId + instanceStart)
 *   instances  where orgId == X                          (titles; index instances orgId + start)
 * then aggregates with the shared buildOrgReport. Every query is capped at
 * MAX_REPORT_DOCS documents.
 */
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, buildOrgReport, type InstanceDoc, type OrgReportData, type ReportShiftInfo } from "@fbla/shared";
import { ts } from "../../lib/firestore";
import { MAX_REPORT_DOCS, logRowOf, rangeFor, shiftInfoOf, signupRowOf } from "./rows";

export interface OrgReportRequest {
  readonly orgId: string;
  readonly from: string;
  readonly to: string;
  readonly timeZone: string;
  readonly opportunityId: string | null;
}

export const loadOrgReportData = async (db: Firestore, request: OrgReportRequest): Promise<OrgReportData> => {
  const range = rangeFor(request.from, request.to, request.timeZone);
  const [logs, signups, instances] = await Promise.all([
    db
      .collection(COLLECTIONS.hoursLogs)
      .where("orgId", "==", request.orgId)
      .where("date", ">=", ts(range.fromMs))
      .where("date", "<", ts(range.toExclusiveMs))
      .limit(MAX_REPORT_DOCS)
      .get(),
    db
      .collection(COLLECTIONS.signups)
      .where("orgId", "==", request.orgId)
      .where("instanceStart", ">=", ts(range.fromMs))
      .where("instanceStart", "<", ts(range.toExclusiveMs))
      .limit(MAX_REPORT_DOCS)
      .get(),
    db.collection(COLLECTIONS.instances).where("orgId", "==", request.orgId).limit(MAX_REPORT_DOCS).get()
  ]);
  const shifts: Record<string, ReportShiftInfo> = Object.fromEntries(instances.docs.map((doc) => [doc.id, shiftInfoOf(doc.data() as InstanceDoc)]));
  return buildOrgReport({
    logs: logs.docs.map(logRowOf),
    signups: signups.docs.map(signupRowOf),
    shifts,
    range,
    timeZone: request.timeZone,
    opportunityId: request.opportunityId
  });
};
