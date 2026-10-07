/**
 * reportData.ts
 * Client reads behind the report builder preview and CSV export (SPEC 8.6:
 * "CSV export is client-side from data the user can already read"). Each
 * document is parsed with the shared zod schema, then turned into the plain
 * rows the shared aggregation takes, so the preview, the CSV, and the server
 * PDF run the same math on the same shapes.
 *   org:        hoursLogs where orgId == X and date in range (rules: isMember),
 *               signups where orgId == X and instanceStart in range, and the
 *               org's instances for titles
 *   volunteer:  the caller's own logs (uid == me), organizations, and the
 *               instances those logs mention
 * Tier 2 lane B: signups carry lateCancel (reliability distribution), and the
 * volunteer rows include the caller's own signups (track record chart).
 */
import { Timestamp, collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import {
  COLLECTIONS,
  hoursLogDocSchema,
  instanceDocSchema,
  signupDocSchema,
  startOfLocalDay,
  startOfNextLocalDay,
  type ReliabilityReportSignup,
  type ReportLogRow,
  type ReportOrgInfo,
  type ReportRange,
  type ReportShiftInfo,
  type ReportSignupRow
} from "@fbla/shared";
import { getFirebase } from "../firebase";
import { getOrganizations } from "./orgs";
import { parseDocSnapshot, parseQuerySnapshot, type WithId } from "./parse";

/** Same cap as the server fetchers, so a preview never reads more than the PDF would. */
const MAX_REPORT_DOCS = 5000;

export const reportRangeFor = (from: string, to: string, timeZone: string): ReportRange => ({
  fromMs: startOfLocalDay(from, timeZone).getTime(),
  toExclusiveMs: startOfNextLocalDay(to, timeZone).getTime()
});

type ParsedLog = WithId<ReturnType<typeof hoursLogDocSchema.parse>>;
type ParsedSignup = WithId<ReturnType<typeof signupDocSchema.parse>>;

const toLogRow = (log: ParsedLog): ReportLogRow => ({
  id: log.id,
  uid: log.uid,
  orgId: log.orgId,
  instanceId: log.instanceId,
  source: log.source,
  status: log.status,
  minutes: log.minutes,
  dateMs: log.date.toMillis(),
  displayName: log.displayName ?? null
});

const toSignupRow = (signup: ParsedSignup): ReportSignupRow => ({
  id: signup.id,
  uid: signup.uid,
  displayName: signup.displayName,
  instanceId: signup.instanceId,
  opportunityId: signup.opportunityId,
  status: signup.status,
  startMs: signup.instanceStart.toMillis(),
  lateCancel: signup.lateCancel
});

export interface OrgReportRows {
  readonly logs: ReportLogRow[];
  readonly signups: ReportSignupRow[];
  readonly shifts: Record<string, ReportShiftInfo>;
}

export const loadOrgReportRows = async (orgId: string, range: ReportRange): Promise<OrgReportRows> => {
  const { db } = getFirebase();
  const [from, to] = [Timestamp.fromMillis(range.fromMs), Timestamp.fromMillis(range.toExclusiveMs)];
  const [logs, signups, instances] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.hoursLogs), where("orgId", "==", orgId), where("date", ">=", from), where("date", "<", to), orderBy("date"), limit(MAX_REPORT_DOCS))),
    getDocs(
      query(collection(db, COLLECTIONS.signups), where("orgId", "==", orgId), where("instanceStart", ">=", from), where("instanceStart", "<", to), limit(MAX_REPORT_DOCS))
    ),
    getDocs(query(collection(db, COLLECTIONS.instances), where("orgId", "==", orgId), orderBy("start", "asc"), limit(MAX_REPORT_DOCS)))
  ]);
  return {
    logs: parseQuerySnapshot(hoursLogDocSchema, logs).map(toLogRow),
    signups: parseQuerySnapshot(signupDocSchema, signups).map(toSignupRow),
    shifts: Object.fromEntries(parseQuerySnapshot(instanceDocSchema, instances).map((instance) => [instance.id, { title: instance.title, opportunityId: instance.opportunityId }]))
  };
};

export interface VolunteerReportRows {
  readonly logs: ReportLogRow[];
  readonly orgs: Record<string, ReportOrgInfo>;
  readonly shifts: Record<string, ReportShiftInfo>;
  readonly signups: ReliabilityReportSignup[];
}

const loadShifts = async (instanceIds: readonly string[]): Promise<Record<string, ReportShiftInfo>> => {
  const { db } = getFirebase();
  const instances = await Promise.all([...new Set(instanceIds)].map(async (id) => parseDocSnapshot(instanceDocSchema, await getDoc(doc(db, COLLECTIONS.instances, id)))));
  return Object.fromEntries(instances.flatMap((instance) => (instance ? [[instance.id, { title: instance.title, opportunityId: instance.opportunityId }]] : [])));
};

export const loadVolunteerReportRows = async (uid: string): Promise<VolunteerReportRows> => {
  const { db } = getFirebase();
  const [snapshot, signupSnapshot] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.hoursLogs), where("uid", "==", uid), orderBy("date", "desc"), limit(MAX_REPORT_DOCS))),
    getDocs(query(collection(db, COLLECTIONS.signups), where("uid", "==", uid), limit(MAX_REPORT_DOCS)))
  ]);
  const signups = parseQuerySnapshot(signupDocSchema, signupSnapshot).map((signup) => ({ uid: signup.uid, status: signup.status, lateCancel: signup.lateCancel, startMs: signup.instanceStart.toMillis() }));
  const logs = parseQuerySnapshot(hoursLogDocSchema, snapshot).map(toLogRow);
  const [orgs, shifts] = await Promise.all([getOrganizations(), loadShifts(logs.flatMap((log) => (log.instanceId === null ? [] : [log.instanceId])))]);
  return { logs, orgs: Object.fromEntries(orgs.map((org) => [org.id, { name: org.name, verified: org.verified }])), shifts, signups };
};
