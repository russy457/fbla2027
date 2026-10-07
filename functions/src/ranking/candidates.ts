/**
 * candidates.ts
 * Loads who may be ranked for an organization (SPEC 8.4, queries Q12 and
 * Q29) and turns a private profile into the shape shared/ranking.ts scores:
 *   - past volunteers: signups where orgId == X and status == completed
 *   - discoverable: collectionGroup "private" where
 *     notificationPrefs.discoverable == true (only users/{uid}/private/profile)
 * Profiles never leave the server: the op returns display names, scores,
 * reasons, and sealed refs only. Age and minor rules are applied by
 * isRankEligible on the shift date, not here.
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  PATHS,
  displayNameFor,
  type PrivateProfileDoc,
  type RankCandidate,
  type SignupDoc
} from "@fbla/shared";
import { readDoc } from "../lib/firestore";

/** Upper bound per source, so one ranking reads a bounded number of documents. */
const SOURCE_LIMIT = 500;

export const toRankCandidate = (uid: string, profile: PrivateProfileDoc, pastVolunteer: boolean): RankCandidate => ({
  key: uid,
  displayName: displayNameFor(profile.firstName, profile.lastName),
  birthDate: profile.birthDate,
  profile: { interests: profile.interests, skills: profile.skills, availability: profile.availability, homeGeohash: profile.homeGeohash },
  reliability: { score: profile.reliability.score, isNew: profile.reliability.isNew },
  pastVolunteer,
  discoverable: profile.notificationPrefs?.discoverable === true
});

/** Every uid with a completed shift at the org (Q12). */
const pastVolunteerUids = async (db: Firestore, orgId: string): Promise<Set<string>> => {
  const past = await db.collection(COLLECTIONS.signups).where("orgId", "==", orgId).where("status", "==", "completed").limit(SOURCE_LIMIT).get();
  return new Set(past.docs.map((doc) => (doc.data() as SignupDoc).uid));
};

/** Profiles of people who opted in to being found (Q29), keyed by uid. */
const discoverableProfiles = async (db: Firestore): Promise<Map<string, PrivateProfileDoc>> => {
  const found = await db.collectionGroup(COLLECTIONS.private).where("notificationPrefs.discoverable", "==", true).limit(SOURCE_LIMIT).get();
  const entries = found.docs.flatMap((doc): Array<[string, PrivateProfileDoc]> => {
    const owner = doc.ref.parent.parent;
    return doc.id === "profile" && owner !== null ? [[owner.id, doc.data() as PrivateProfileDoc]] : [];
  });
  return new Map(entries);
};

/** Everyone rankable for the org, minus `excluded` uids (the caller, people already on the shift). */
export const loadRankCandidates = async (db: Firestore, orgId: string, excluded: ReadonlySet<string>): Promise<RankCandidate[]> => {
  const [past, profiles] = await Promise.all([pastVolunteerUids(db, orgId), discoverableProfiles(db)]);
  const missing = [...past].filter((uid) => !profiles.has(uid));
  const fetched = missing.length > 0 ? await db.getAll(...missing.map((uid) => db.doc(PATHS.privateProfile(uid)))) : [];
  fetched.forEach((snapshot, index) => {
    const profile = readDoc<PrivateProfileDoc>(snapshot);
    const uid = missing[index];
    if (profile !== null && uid !== undefined) profiles.set(uid, profile);
  });
  return [...profiles.entries()]
    .filter(([uid, profile]) => !excluded.has(uid) && profile.profileComplete)
    .map(([uid, profile]) => toRankCandidate(uid, profile, past.has(uid)));
};

/** True when the uid completed a shift at the org (re-checked at invite time). */
export const hasVolunteeredWith = async (db: Firestore, orgId: string, uid: string): Promise<boolean> => {
  // Equality-only filters are served by merging single-field indexes.
  const found = await db.collection(COLLECTIONS.signups).where("orgId", "==", orgId).where("uid", "==", uid).where("status", "==", "completed").limit(1).get();
  return !found.empty;
};
