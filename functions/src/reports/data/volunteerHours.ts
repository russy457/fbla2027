/**
 * volunteerHours.ts
 * Loads one volunteer's data for the hours report (SPEC 8.6; rewrite of the
 * old user fetchers in dataFetcher.ts): every hoursLogs doc where uid == X
 * (the range is applied in the shared aggregation because milestones use the
 * lifetime total), then the organizations and instances those logs mention,
 * for names, verification state, and shift titles. Capped at MAX_REPORT_DOCS.
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  buildVolunteerReport,
  type InstanceDoc,
  type OrganizationDoc,
  type ReportOrgInfo,
  type ReportShiftInfo,
  type VolunteerReportData
} from "@fbla/shared";
import { readDoc } from "../../lib/firestore";
import { MAX_REPORT_DOCS, logRowOf, rangeFor, shiftInfoOf } from "./rows";

export interface VolunteerReportRequest {
  readonly uid: string;
  readonly from: string;
  readonly to: string;
  readonly timeZone: string;
}

/** Reads documents by id (deduplicated) and keeps the ones that exist, mapped through `pick`. */
const readByIds = async <D, T>(db: Firestore, collection: string, ids: readonly string[], pick: (data: D) => T): Promise<Record<string, T>> => {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  const snapshots = await db.getAll(...unique.map((id) => db.collection(collection).doc(id)));
  return Object.fromEntries(
    snapshots.flatMap((snapshot) => {
      const data = readDoc<D>(snapshot);
      return data === null ? [] : [[snapshot.id, pick(data)] as const];
    })
  );
};

export const loadVolunteerReportData = async (db: Firestore, request: VolunteerReportRequest): Promise<VolunteerReportData> => {
  const snapshot = await db.collection(COLLECTIONS.hoursLogs).where("uid", "==", request.uid).limit(MAX_REPORT_DOCS).get();
  const logs = snapshot.docs.map(logRowOf);
  const [orgs, shifts] = await Promise.all([
    readByIds<OrganizationDoc, ReportOrgInfo>(db, COLLECTIONS.organizations, logs.map((log) => log.orgId), (org) => ({ name: org.name, verified: org.verified })),
    readByIds<InstanceDoc, ReportShiftInfo>(
      db,
      COLLECTIONS.instances,
      logs.flatMap((log) => (log.instanceId === null ? [] : [log.instanceId])),
      shiftInfoOf
    )
  ]);
  return buildVolunteerReport({ logs, orgs, shifts, range: rangeFor(request.from, request.to, request.timeZone), timeZone: request.timeZone });
};
