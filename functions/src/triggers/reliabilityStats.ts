/**
 * reliabilityStats.ts
 * The signups half of recomputeVolunteerStats (SPEC#fn-stats, G1, SPEC
 * 7.2): when a signup's status changes, recompute that volunteer's track
 * record with the shared computeReliability(), refresh the isMinor cache
 * (G11, America/Chicago for account rules), and copy both into the contact
 * snapshots coordinators read for that volunteer's open, upcoming signups.
 *
 * Bounded by construction (G1):
 *   - reads only this uid's finished signups (Q10, capped), open contact
 *     snapshots (Q14, capped), and membership docs (Q27);
 *   - writes the private profile, member docs, and contact snapshots only
 *     when a value differs;
 *   - never writes signups or hoursLogs, so it cannot retrigger itself.
 * Frozen snapshots (finalized shifts) and shifts more than 8 weeks out are
 * never touched.
 */
import {
  COLLECTIONS,
  DEFAULT_TIME_ZONE,
  PATHS,
  RELIABILITY_WINDOW_SIZE,
  ageOn,
  computeReliability,
  type MemberDoc,
  type PrivateProfileDoc,
  type Reliability,
  type SignupContactDoc,
  type SignupDoc
} from "@fbla/shared";
import type { ServerDeps } from "../lib/deps";
import { msOf, readDoc, ts } from "../lib/firestore";

const ADULT_AGE = 18;
/** Finished signups read per run; far more than the 20-signup window needs, even with cancels mixed in. */
const MAX_SIGNUPS_READ = 200;
/** Open contact snapshots refreshed per run. */
const MAX_CONTACTS_READ = 100;
/** Contact snapshots refresh only for shifts starting within this window (SPEC 5.12). */
const REFRESH_WINDOW_MS = 8 * 7 * 24 * 60 * 60 * 1000;
const OPEN_STATUSES = new Set(["confirmed", "waitlisted"]);

export interface ReliabilityStatsResult {
  readonly wroteProfile: boolean;
  readonly contactsRefreshed: number;
  readonly membersUpdated: number;
}

const sameReliability = (a: Reliability, b: Reliability): boolean =>
  a.attended === b.attended && a.noShows === b.noShows && a.lateCancels === b.lateCancels && a.total === b.total && a.score === b.score && a.isNew === b.isNew;

/** Recomputes one volunteer's reliability and caches. Exported for the emulator tests. */
export const recomputeReliabilityForUid = async (deps: ServerDeps, uid: string, nowMs: number): Promise<ReliabilityStatsResult> => {
  const { db } = deps;
  const profileRef = db.doc(PATHS.privateProfile(uid));
  const profile = readDoc<PrivateProfileDoc>(await profileRef.get());
  // No profile means onboarding never finished; there is nothing to cache on.
  if (profile === null) return { wroteProfile: false, contactsRefreshed: 0, membersUpdated: 0 };

  const finished = await db
    .collection(COLLECTIONS.signups)
    .where("uid", "==", uid)
    .where("status", "in", ["completed", "no-show", "cancelled"])
    .orderBy("instanceStart", "desc")
    .limit(Math.max(MAX_SIGNUPS_READ, RELIABILITY_WINDOW_SIZE))
    .get();
  const result = computeReliability(
    finished.docs.map((doc) => {
      const signup = doc.data() as SignupDoc;
      return { status: signup.status, lateCancel: signup.lateCancel, instanceStartMs: msOf(signup.instanceStart) };
    }),
    nowMs
  );
  const reliability: Reliability = {
    attended: result.attended,
    noShows: result.noShows,
    lateCancels: result.lateCancels,
    total: result.total,
    score: result.score,
    isNew: result.isNew
  };
  const isMinor = ageOn(profile.birthDate, new Date(nowMs), DEFAULT_TIME_ZONE) < ADULT_AGE;

  const wroteProfile = !sameReliability(profile.reliability, reliability) || profile.isMinor !== isMinor;
  if (wroteProfile) {
    await profileRef.update({
      reliability: { ...reliability, windowFrom: result.windowFromMs === null ? null : ts(result.windowFromMs) },
      isMinor,
      updatedAt: ts(nowMs)
    });
  }

  const contactsRefreshed = await refreshContacts(deps, uid, reliability, isMinor, nowMs);
  const membersUpdated = await refreshMemberships(deps, uid, !isMinor, nowMs);
  return { wroteProfile, contactsRefreshed, membersUpdated };
};

/** Copies reliability and isMinor into open, upcoming, non-frozen snapshots that differ. */
const refreshContacts = async (deps: ServerDeps, uid: string, reliability: Reliability, isMinor: boolean, nowMs: number): Promise<number> => {
  const { db } = deps;
  const contacts = await db.collection(COLLECTIONS.signupContacts).where("uid", "==", uid).where("frozen", "==", false).limit(MAX_CONTACTS_READ).get();
  if (contacts.empty) return 0;
  const signups = await db.getAll(...contacts.docs.map((doc) => db.collection(COLLECTIONS.signups).doc(doc.id)));
  const batch = db.batch();
  let count = 0;
  contacts.docs.forEach((doc, index) => {
    const snapshot = signups[index];
    const signup = snapshot === undefined ? null : readDoc<SignupDoc>(snapshot);
    const contact = doc.data() as SignupContactDoc;
    if (signup === null || !OPEN_STATUSES.has(signup.status)) return;
    const startMs = msOf(signup.instanceStart);
    if (startMs < nowMs || startMs > nowMs + REFRESH_WINDOW_MS) return;
    if (sameReliability(contact.reliability, reliability) && contact.isMinor === isMinor) return;
    batch.update(doc.ref, { reliability, isMinor, refreshedAt: ts(nowMs), updatedAt: ts(nowMs) });
    count += 1;
  });
  if (count > 0) await batch.commit();
  return count;
};

/** Minor coordinators never see contact snapshots (G14): keep canViewContacts in step with age. */
const refreshMemberships = async (deps: ServerDeps, uid: string, canViewContacts: boolean, nowMs: number): Promise<number> => {
  const members = await deps.db.collectionGroup(COLLECTIONS.members).where("uid", "==", uid).get();
  const stale = members.docs.filter((doc) => (doc.data() as MemberDoc).canViewContacts !== canViewContacts);
  if (stale.length === 0) return 0;
  const batch = deps.db.batch();
  stale.forEach((doc) => batch.update(doc.ref, { canViewContacts, updatedAt: ts(nowMs) }));
  await batch.commit();
  return stale.length;
};
