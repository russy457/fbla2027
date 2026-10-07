/**
 * recomputeVolunteerStats.ts
 * Bounded stats trigger (SPEC#fn-stats, G1), Tier 0 slice. On any
 * hoursLogs write it recomputes the affected volunteer's public totals on
 * users/{uid} (totalApprovedHours, orgsHelpedCount, milestone badges) and
 * marks the log's org as having activity.
 *
 * Bounded by construction:
 *   - it reads only the one volunteer's approved logs (capped query),
 *   - it writes users/{uid} only when a value actually differs,
 *   - it never writes hoursLogs or signups, so it cannot retrigger itself.
 * Tier 1 lane A adds streakWeeks (E4, weeks read in each log's org zone)
 * here, and the signups half of the group (onSignup): reliability, the isMinor
 * cache, and contact-snapshot refresh, in reliabilityStats.ts. onSignup
 * returns at once unless the status changed (create and delete count).
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  COLLECTIONS,
  DEFAULT_TIME_ZONE,
  badgesFor,
  streakWeeks,
  totalApprovedHours,
  type HoursLogDoc,
  type OrganizationDoc,
  type SignupDoc,
  type UserPublicDoc
} from "@fbla/shared";
import { defaultDeps, type ServerDeps } from "../lib/deps";
import { msOf, readDoc, ts } from "../lib/firestore";
import { requestClock } from "../lib/requestClock";
import { recomputeReliabilityForUid } from "./reliabilityStats";

/** A volunteer has far fewer logs than this; the cap keeps one bad actor from making the trigger unbounded. */
const MAX_LOGS_READ = 2_000;

export interface StatsResult {
  readonly wroteUser: boolean;
  readonly markedOrgActive: boolean;
}

const sameStats = (
  current: UserPublicDoc | null,
  next: Pick<UserPublicDoc, "totalApprovedHours" | "orgsHelpedCount" | "badges" | "streakWeeks">
): boolean =>
  current !== null &&
  current.totalApprovedHours === next.totalApprovedHours &&
  current.orgsHelpedCount === next.orgsHelpedCount &&
  current.badges.join() === next.badges.join() &&
  current.streakWeeks === next.streakWeeks;

/** Each org's zone, for reading a log's week where it happened (one read per org, not per log). */
const zonesFor = async (deps: ServerDeps, orgIds: readonly string[]): Promise<Map<string, string>> => {
  if (orgIds.length === 0) return new Map();
  const snapshots = await deps.db.getAll(...orgIds.map((id) => deps.db.collection(COLLECTIONS.organizations).doc(id)));
  return new Map(snapshots.map((snapshot) => [snapshot.id, readDoc<OrganizationDoc>(snapshot)?.timeZone ?? DEFAULT_TIME_ZONE]));
};

/** Recomputes one volunteer's public stats. Exported for the emulator tests. */
export const recomputeStatsForUid = async (deps: ServerDeps, uid: string, orgId: string | null, nowMs: number): Promise<StatsResult> => {
  const { db } = deps;
  const approved = await db.collection(COLLECTIONS.hoursLogs).where("uid", "==", uid).where("status", "==", "approved").limit(MAX_LOGS_READ).get();
  const logs = approved.docs.map((doc) => doc.data() as HoursLogDoc);
  const hours = totalApprovedHours(logs.map((log) => log.minutes));
  const orgIds = [...new Set(logs.map((log) => log.orgId))];
  const zones = await zonesFor(deps, orgIds);
  const streak = streakWeeks(
    logs.map((log) => ({ dateMs: msOf(log.date), timeZone: zones.get(log.orgId) ?? DEFAULT_TIME_ZONE })),
    nowMs,
    DEFAULT_TIME_ZONE
  );
  const next = { totalApprovedHours: hours, orgsHelpedCount: orgIds.length, badges: badgesFor(hours), streakWeeks: streak };

  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const current = readDoc<UserPublicDoc>(await userRef.get());
  // Only users who finished onboarding have a public doc; never create one here.
  const wroteUser = current !== null && !sameStats(current, next);
  if (wroteUser) await userRef.update({ ...next, updatedAt: ts(nowMs) });

  const orgRef = orgId === null ? null : db.collection(COLLECTIONS.organizations).doc(orgId);
  const org = orgRef === null ? null : readDoc<OrganizationDoc>(await orgRef.get());
  const markedOrgActive = orgRef !== null && org !== null && !org.hasActivity;
  if (markedOrgActive) await orgRef.update({ hasActivity: true, updatedAt: ts(nowMs) });

  return { wroteUser, markedOrgActive };
};

const onHoursLog = onDocumentWritten(`${COLLECTIONS.hoursLogs}/{logId}`, async (event) => {
  const after = event.data?.after.exists ? (event.data.after.data() as HoursLogDoc) : null;
  const before = event.data?.before.exists ? (event.data.before.data() as HoursLogDoc) : null;
  const log = after ?? before;
  if (log === null) return;
  const deps = defaultDeps();
  const clock = await requestClock(deps);
  await recomputeStatsForUid(deps, log.uid, log.orgId, clock.nowMs());
});

// Tier 1 lane A: the signups half (SPEC 5.12), only when the status changed.
const onSignup = onDocumentWritten(`${COLLECTIONS.signups}/{signupId}`, async (event) => {
  const after = event.data?.after.exists ? (event.data.after.data() as SignupDoc) : null;
  const before = event.data?.before.exists ? (event.data.before.data() as SignupDoc) : null;
  if (before?.status === after?.status) return;
  const signup = after ?? before;
  if (signup === null) return;
  const deps = defaultDeps();
  const clock = await requestClock(deps);
  await recomputeReliabilityForUid(deps, signup.uid, clock.nowMs());
});

/** Trigger group export (SPEC 2.3): deployed as recomputeVolunteerStats-onHoursLog and -onSignup. */
export const recomputeVolunteerStats = { onHoursLog, onSignup };
