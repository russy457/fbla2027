/**
 * evidence.ts
 * Loads what a letter will count (SPEC 5.6 step 3, G19): the volunteer's
 * approved logs, each org's CURRENT verified flag and name, then the shared
 * summarizeEvidence() decides what is included. Letter date ranges are
 * calendar days in America/Chicago (the account zone, SPEC 7.5), inclusive
 * of the `to` day.
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  DEFAULT_TIME_ZONE,
  startOfLocalDay,
  startOfNextLocalDay,
  summarizeEvidence,
  type EvidenceOrg,
  type EvidenceSummary,
  type HoursLogDoc,
  type LetterScope,
  type OrganizationDoc
} from "@fbla/shared";
import { msOf } from "../lib/firestore";

export const loadEvidence = async (db: Firestore, uid: string, scope: LetterScope): Promise<EvidenceSummary> => {
  // Equality-only filters need no composite index; the range is applied in memory.
  const snapshot = await db.collection(COLLECTIONS.hoursLogs).where("uid", "==", uid).where("status", "==", "approved").get();
  const logs = snapshot.docs.map((doc) => {
    const data = doc.data() as HoursLogDoc;
    return { id: doc.id, orgId: data.orgId, minutes: data.minutes, dateMs: msOf(data.date) };
  });

  const orgIds = [...new Set(logs.map((log) => log.orgId))];
  const orgSnapshots = orgIds.length === 0 ? [] : await db.getAll(...orgIds.map((id) => db.collection(COLLECTIONS.organizations).doc(id)));
  const orgs: Record<string, EvidenceOrg> = Object.fromEntries(
    orgSnapshots
      .filter((snap) => snap.exists)
      .map((snap) => {
        const org = snap.data() as OrganizationDoc;
        return [snap.id, { name: org.name, verified: org.verified }];
      })
  );

  return summarizeEvidence({
    logs,
    orgs,
    fromMs: startOfLocalDay(scope.from, DEFAULT_TIME_ZONE).getTime(),
    toExclusiveMs: startOfNextLocalDay(scope.to, DEFAULT_TIME_ZONE).getTime(),
    onlyOrgId: scope.orgId === "ALL" ? null : scope.orgId
  });
};
