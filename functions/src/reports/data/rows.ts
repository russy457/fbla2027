/**
 * rows.ts
 * Converts Firestore documents into the plain epoch-ms rows the shared report
 * aggregation takes (shared/src/reportData.ts), and computes a report's
 * instant range from its YYYY-MM-DD dates in a time zone. Kept defensive in
 * the spirit of the old dataFetcher helpers (PORT_LEDGER section 10).
 */
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import {
  startOfLocalDay,
  startOfNextLocalDay,
  type HoursLogDoc,
  type InstanceDoc,
  type ReportLogRow,
  type ReportRange,
  type ReportShiftInfo,
  type ReportSignupRow,
  type SignupDoc
} from "@fbla/shared";

/** Hard cap on documents one report reads, so a huge org cannot exhaust the function's memory. */
export const MAX_REPORT_DOCS = 5000;

/** [start of `from`, start of the day after `to`) in the zone (SPEC 7.5 calendar-day rules). */
export const rangeFor = (from: string, to: string, timeZone: string): ReportRange => ({
  fromMs: startOfLocalDay(from, timeZone).getTime(),
  toExclusiveMs: startOfNextLocalDay(to, timeZone).getTime()
});

export const logRowOf = (doc: QueryDocumentSnapshot): ReportLogRow => {
  const log = doc.data() as HoursLogDoc;
  return {
    id: doc.id,
    uid: log.uid,
    orgId: log.orgId,
    instanceId: log.instanceId,
    source: log.source,
    status: log.status,
    minutes: log.minutes,
    dateMs: log.date.toMillis(),
    displayName: log.displayName ?? null
  };
};

export const signupRowOf = (doc: QueryDocumentSnapshot): ReportSignupRow => {
  const signup = doc.data() as SignupDoc;
  return {
    id: doc.id,
    uid: signup.uid,
    displayName: signup.displayName,
    instanceId: signup.instanceId,
    opportunityId: signup.opportunityId,
    status: signup.status,
    startMs: signup.instanceStart.toMillis(),
    // Tier 2 lane B: the reliability distribution weighs late cancels (SPEC 7.2).
    lateCancel: signup.lateCancel
  };
};

export const shiftInfoOf = (instance: InstanceDoc): ReportShiftInfo => ({ title: instance.title, opportunityId: instance.opportunityId });
