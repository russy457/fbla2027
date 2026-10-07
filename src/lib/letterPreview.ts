/**
 * letterPreview.ts
 * Client-side letter preview (SPEC#screen-letter-flow D8): runs the same
 * shared summarizeEvidence() that issueLetter freezes on the server, over
 * the volunteer's readable approved logs and each organization's current
 * verified flag, with the same America/Chicago calendar-day range. So the
 * numbers in the preview match the issued letter.
 */
import {
  ALL_ORGS,
  DEFAULT_TIME_ZONE,
  localDateIn,
  startOfLocalDay,
  startOfNextLocalDay,
  summarizeEvidence,
  type EvidenceOrg,
  type EvidenceSummary
} from "@fbla/shared";
import type { Organization } from "./data/orgs";
import type { HoursLog } from "./data/records";

export interface LetterScopeInput {
  /** An organization id, or "ALL". */
  readonly orgId: string;
  readonly from: string;
  readonly to: string;
}

export const previewLetter = (logs: readonly HoursLog[], orgs: readonly Organization[], scope: LetterScopeInput): EvidenceSummary => {
  const orgFacts: Record<string, EvidenceOrg> = Object.fromEntries(orgs.map((org) => [org.id, { name: org.name, verified: org.verified }]));
  return summarizeEvidence({
    logs: logs.map((log) => ({ id: log.id, orgId: log.orgId, minutes: log.minutes, dateMs: log.date.toMillis() })),
    orgs: orgFacts,
    fromMs: startOfLocalDay(scope.from, DEFAULT_TIME_ZONE).getTime(),
    toExclusiveMs: startOfNextLocalDay(scope.to, DEFAULT_TIME_ZONE).getTime(),
    onlyOrgId: scope.orgId === ALL_ORGS ? null : scope.orgId
  });
};

/** Default range: the day of the earliest approved log (or today) through today, in the account zone. */
export const defaultLetterRange = (logs: readonly HoursLog[], now: Date): { from: string; to: string } => {
  const to = localDateIn(now, DEFAULT_TIME_ZONE);
  const earliestMs = logs.reduce((min, log) => Math.min(min, log.date.toMillis()), Number.POSITIVE_INFINITY);
  const from = Number.isFinite(earliestMs) ? localDateIn(new Date(earliestMs), DEFAULT_TIME_ZONE) : to;
  return { from: from <= to ? from : to, to };
};
