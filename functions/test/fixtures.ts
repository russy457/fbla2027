/**
 * fixtures.ts
 * Test data for the Functions emulator tests: two verified orgs (A and B) and
 * one unverified org (U), each with an owner; adult, minor, and under-age
 * volunteers with complete profiles; and builders for instances and signups.
 * Shapes use the shared document types, so a schema change breaks the
 * fixtures at compile time instead of silently in a test.
 */
import {
  COLLECTIONS,
  DEFAULT_CONFIG,
  NEW_VOLUNTEER_RELIABILITY,
  PATHS,
  cutoffAtMs,
  finalizeAtMs,
  signupIdFor,
  type InstanceDoc,
  type MemberDoc,
  type OrganizationDoc,
  type PrivateProfileDoc,
  type SignupDoc,
  type SignupStatus,
  type UserPublicDoc
} from "@fbla/shared";
import { BASE_MS, HOUR, db, tsAt } from "./harness";

const NOW = tsAt(BASE_MS);

export const org = (name: string, verified: boolean): OrganizationDoc => ({
  name,
  mission: "Test mission",
  causeAreas: ["hunger-food-security"],
  ein: "74-1234567",
  address: { line1: "1 Main St", city: "San Antonio", state: "TX", zip: "78205" },
  geo: null,
  contactEmail: "org@example.test",
  contactPhone: null,
  website: null,
  timeZone: "America/Chicago",
  photoPaths: [],
  ownerUid: "owner",
  verified,
  verifiedAt: null,
  verifiedBy: null,
  hasActivity: false,
  archived: false,
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW
});

const member = (orgId: string, uid: string): MemberDoc => ({
  uid,
  orgId,
  role: "owner",
  displayName: uid,
  canViewContacts: true,
  invitedBy: null,
  joinedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW
});

export const profile = (first: string, last: string, birthDate: string, complete = true): PrivateProfileDoc => ({
  firstName: first,
  lastName: last,
  fullName: `${first} ${last}`,
  email: `${first.toLowerCase()}@example.test`,
  phone: null,
  birthDate,
  isMinor: false,
  interests: [],
  skills: [],
  availability: null,
  zip: null,
  homeGeohash: null,
  profileComplete: complete,
  profileCompletedAt: complete ? NOW : null,
  turnstileVerifiedAt: null,
  reliability: { ...NEW_VOLUNTEER_RELIABILITY, windowFrom: null },
  createdAt: NOW,
  updatedAt: NOW
});

const publicUser = (displayName: string): UserPublicDoc => ({
  displayName,
  avatarPath: null,
  badges: [],
  totalApprovedHours: 0,
  orgsHelpedCount: 0,
  streakWeeks: 0,
  createdAt: NOW,
  updatedAt: NOW
});

export const ADULT_BIRTH = "2000-01-01";
export const MINOR_BIRTH = "2011-05-01"; // 15 on the test date
export const VOLUNTEERS = ["vol1", "vol2", "vol3", "vol4", "vol5", "vol6", "vol7", "vol8"];

/** Seeds orgs, owners, and people. Call after resetEmulators(). */
export const seedWorld = async (): Promise<void> => {
  const batch = db.batch();
  const orgs: Array<[string, string, boolean]> = [
    ["orgA", "Alamo Community Pantry", true],
    ["orgB", "Bexar Book Bank", true],
    ["orgU", "Mission Garden Collective", false]
  ];
  orgs.forEach(([id, name, verified]) => {
    batch.set(db.collection(COLLECTIONS.organizations).doc(id), org(name, verified));
    batch.set(db.doc(PATHS.member(id, `coord${id.slice(3)}`)), member(id, `coord${id.slice(3)}`));
  });
  const people: Array<[string, PrivateProfileDoc]> = [
    ["coordA", profile("Olivia", "Ortiz", ADULT_BIRTH)],
    ["coordB", profile("Ben", "Baker", ADULT_BIRTH)],
    ["coordU", profile("Uma", "Underwood", ADULT_BIRTH)],
    ["minor", { ...profile("Sam", "Lee", MINOR_BIRTH), isMinor: true }],
    ["incomplete", profile("Ian", "Incomplete", ADULT_BIRTH, false)],
    ...VOLUNTEERS.map((uid, index): [string, PrivateProfileDoc] => [uid, profile(`Volunteer${index + 1}`, "Rivera", ADULT_BIRTH)])
  ];
  people.forEach(([uid, data]) => {
    batch.set(db.doc(PATHS.privateProfile(uid)), data);
    batch.set(db.collection(COLLECTIONS.users).doc(uid), publicUser(`${data.firstName} ${data.lastName.charAt(0)}.`));
  });
  await batch.commit();
};

export interface InstanceOptions {
  readonly orgId?: string;
  readonly startMs?: number;
  readonly durationMs?: number;
  readonly capacity?: number;
  readonly signupCount?: number;
  readonly minAge?: number;
  readonly orgVerified?: boolean;
  readonly status?: InstanceDoc["status"];
}

/** Default shift: org A, starts 3 h after BASE_MS (so the 2 h cutoff is 1 h away), lasts 4 h, 3 seats. */
export const seedInstance = async (instanceId: string, options: InstanceOptions = {}): Promise<InstanceDoc> => {
  const startMs = options.startMs ?? BASE_MS + 3 * HOUR;
  const endMs = startMs + (options.durationMs ?? 4 * HOUR);
  const cutoff = cutoffAtMs(startMs, DEFAULT_CONFIG);
  const instance: InstanceDoc = {
    orgId: options.orgId ?? "orgA",
    opportunityId: "opp1",
    seriesId: null,
    title: "Sort food donations",
    orgName: options.orgId === "orgB" ? "Bexar Book Bank" : options.orgId === "orgU" ? "Mission Garden Collective" : "Alamo Community Pantry",
    orgVerified: options.orgVerified ?? options.orgId !== "orgU",
    minAge: options.minAge ?? 13,
    timeZone: "America/Chicago",
    start: tsAt(startMs),
    end: tsAt(endMs),
    capacity: options.capacity ?? 3,
    signupCount: options.signupCount ?? 0,
    waitlist: [],
    waitlistSeq: 0,
    checkedInCount: 0,
    status: options.status ?? "scheduled",
    cutoffAt: tsAt(cutoff),
    finalizeAt: tsAt(finalizeAtMs(endMs, DEFAULT_CONFIG)),
    cutoffDoneAt: null,
    finalizedAt: null,
    nextActionAt: tsAt(cutoff),
    sequence: 0,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    createdAt: NOW,
    updatedAt: NOW
  };
  await db.collection(COLLECTIONS.instances).doc(instanceId).set(instance);
  return instance;
};

/** Writes a signup directly (bypassing ops) in any status, for finalize and letter setups. */
export const seedSignup = async (instanceId: string, uid: string, status: SignupStatus, extra: Partial<SignupDoc> = {}): Promise<string> => {
  const instance = (await db.collection(COLLECTIONS.instances).doc(instanceId).get()).data() as InstanceDoc;
  const signupId = signupIdFor(instanceId, uid);
  const signup: SignupDoc = {
    instanceId,
    opportunityId: instance.opportunityId,
    orgId: instance.orgId,
    uid,
    displayName: uid,
    instanceStart: instance.start,
    instanceEnd: instance.end,
    status,
    waitlistSeq: null,
    walkUp: false,
    promotedAt: null,
    lateCancel: false,
    cancelReason: null,
    cancelledAt: null,
    checkInAt: null,
    checkOutAt: null,
    autoCompleted: false,
    excuseReason: null,
    attendance: null,
    disputeOpen: false,
    dispute: null,
    history: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...extra
  };
  await db.collection(COLLECTIONS.signups).doc(signupId).set(signup);
  return signupId;
};
