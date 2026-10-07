/**
 * seedBuilders.ts
 * Document builders for the demo seed (SPEC#demo-accounts). Each returns a
 * fully typed document from the shared schemas, so the seed can never drift
 * from what the app and Functions parse. Pure: time comes in as epoch ms.
 */
import {
  DAY_MS,
  DEFAULT_CONFIG,
  MINUTE_MS,
  NEW_VOLUNTEER_RELIABILITY,
  badgesFor,
  displayNameFor,
  fullNameFor,
  localDateIn,
  totalApprovedHours,
  type HoursLogDoc,
  type InstanceDoc,
  type MemberDoc,
  type OrganizationDoc,
  type PrivateProfileDoc,
  type Reliability,
  type SignupContactDoc,
  type SignupDoc,
  type SignupStatus,
  type UserPublicDoc
} from "@fbla/shared";
import { ts } from "../lib/firestore";
import type { DemoOpportunity, DemoOrg, DemoPerson } from "./demoCast";

export const SEED_TIME_ZONE = "America/Chicago";

const audit = (nowMs: number) => ({ createdAt: ts(nowMs), updatedAt: ts(nowMs) });

export const nameOf = (person: DemoPerson): string => displayNameFor(person.first, person.last);

/** Birth date `years` years before seed day, minus a month so the age holds all month. */
export const birthDateFor = (years: number, nowMs: number): string => {
  const date = new Date(nowMs);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return localDateIn(date, "UTC");
};

export const organizationDoc = (org: DemoOrg, adminUid: string, nowMs: number): OrganizationDoc => ({
  name: org.name,
  mission: org.mission,
  causeAreas: org.causeAreas,
  ein: org.ein,
  address: org.address,
  geo: null,
  contactEmail: org.contactEmail,
  contactPhone: null,
  website: null,
  timeZone: SEED_TIME_ZONE,
  photoPaths: [],
  ownerUid: org.owner.uid,
  verified: org.verified,
  verifiedAt: org.verified ? ts(nowMs - 90 * DAY_MS) : null,
  verifiedBy: org.verified ? adminUid : null,
  hasActivity: true,
  archived: false,
  archivedAt: null,
  ...audit(nowMs)
});

export const ownerMemberDoc = (org: DemoOrg, nowMs: number): MemberDoc => ({
  uid: org.owner.uid,
  orgId: org.id,
  role: "owner",
  displayName: nameOf(org.owner),
  canViewContacts: org.owner.years >= 18,
  invitedBy: null,
  joinedAt: ts(nowMs - 120 * DAY_MS),
  ...audit(nowMs)
});

export interface ShiftTimes {
  readonly startMs: number;
  readonly lengthMin: number;
}

export interface InstanceParams {
  readonly opportunity: DemoOpportunity;
  readonly times: ShiftTimes;
  readonly capacity: number;
  readonly signupCount: number;
  readonly checkedInCount?: number;
  readonly waitlist?: InstanceDoc["waitlist"];
  readonly finalized: boolean;
  readonly nowMs: number;
}

export const instanceDoc = (params: InstanceParams): InstanceDoc => {
  const { opportunity, times, nowMs } = params;
  const endMs = times.startMs + times.lengthMin * MINUTE_MS;
  const cutoffMs = times.startMs - DEFAULT_CONFIG.waitlistCutoffMin * MINUTE_MS;
  const finalizeMs = endMs + DEFAULT_CONFIG.checkoutGraceMin * MINUTE_MS;
  const waitlist = params.waitlist ?? [];
  return {
    orgId: opportunity.org.id,
    opportunityId: opportunity.id,
    seriesId: null,
    title: opportunity.title,
    orgName: opportunity.org.name,
    orgVerified: opportunity.org.verified,
    minAge: opportunity.minAge,
    timeZone: SEED_TIME_ZONE,
    start: ts(times.startMs),
    end: ts(endMs),
    capacity: params.capacity,
    signupCount: params.signupCount,
    waitlist,
    waitlistSeq: waitlist.length,
    checkedInCount: params.checkedInCount ?? 0,
    status: params.finalized ? "finalized" : "scheduled",
    cutoffAt: ts(cutoffMs),
    finalizeAt: ts(finalizeMs),
    cutoffDoneAt: params.finalized ? ts(cutoffMs) : null,
    finalizedAt: params.finalized ? ts(finalizeMs) : null,
    nextActionAt: params.finalized ? null : ts(cutoffMs),
    sequence: 0,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    ...audit(nowMs)
  };
};

/** How a seeded signup ended (or stands): drives status, times, and history. */
export type SignupOutcome =
  | { readonly kind: "confirmed" }
  | { readonly kind: "waitlisted"; readonly seq: number }
  | { readonly kind: "completed"; readonly checkInMs: number; readonly checkOutMs: number }
  | { readonly kind: "no-show" };

const historyFor = (uid: string, outcome: SignupOutcome, signedUpMs: number, endMs: number): SignupDoc["history"] => {
  const entry = (from: SignupStatus | null, to: SignupStatus, actor: string, op: SignupDoc["history"][number]["op"], atMs: number) => ({
    from,
    to,
    actor,
    op,
    at: ts(atMs)
  });
  if (outcome.kind === "waitlisted") return [entry(null, "waitlisted", uid, "signup", signedUpMs)];
  const joined = entry(null, "confirmed", uid, "signup", signedUpMs);
  if (outcome.kind === "confirmed") return [joined];
  if (outcome.kind === "no-show") return [joined, entry("confirmed", "no-show", "system", "runDueJobs", endMs)];
  return [
    joined,
    entry("confirmed", "checked-in", uid, "checkIn", outcome.checkInMs),
    entry("checked-in", "completed", uid, "checkOut", outcome.checkOutMs)
  ];
};

export const signupDoc = (person: DemoPerson, instance: InstanceDoc, instanceId: string, outcome: SignupOutcome, nowMs: number): SignupDoc => {
  const signedUpMs = Math.min(nowMs, instance.start.toMillis()) - 7 * DAY_MS;
  const completed = outcome.kind === "completed" ? outcome : null;
  return {
    instanceId,
    opportunityId: instance.opportunityId,
    orgId: instance.orgId,
    uid: person.uid,
    displayName: nameOf(person),
    instanceStart: instance.start,
    instanceEnd: instance.end,
    status: outcome.kind,
    waitlistSeq: outcome.kind === "waitlisted" ? outcome.seq : null,
    walkUp: false,
    promotedAt: null,
    lateCancel: false,
    cancelReason: null,
    cancelledAt: null,
    checkInAt: completed ? ts(completed.checkInMs) : null,
    checkOutAt: completed ? ts(completed.checkOutMs) : null,
    autoCompleted: false,
    excuseReason: null,
    attendance: null,
    disputeOpen: false,
    dispute: null,
    history: historyFor(person.uid, outcome, signedUpMs, instance.end.toMillis()),
    ...audit(nowMs)
  };
};

/**
 * Contact snapshot (SPEC#dm-signupcontacts). A minor at an unverified org is
 * hidden: display name only, no PII fields at all (T4).
 */
export const signupContactDoc = (
  person: DemoPerson & { readonly email?: string },
  instance: InstanceDoc,
  instanceId: string,
  reliability: Reliability,
  nowMs: number
): SignupContactDoc => {
  const isMinor = person.years < 18;
  const hidden = isMinor && !instance.orgVerified;
  const base = { orgId: instance.orgId, instanceId, uid: person.uid, hidden, isMinor, reliability, frozen: instance.status === "finalized", refreshedAt: ts(nowMs), ...audit(nowMs) };
  if (hidden) return base;
  return { ...base, fullName: fullNameFor(person.first, person.last), email: person.email ?? `${person.uid}@demo.fbla2027.test`, phone: null };
};

export const shiftHoursLog = (signupId: string, signup: SignupDoc, minutes: number, nowMs: number): HoursLogDoc => ({
  uid: signup.uid,
  orgId: signup.orgId,
  instanceId: signup.instanceId,
  signupId,
  source: "kiosk",
  date: signup.instanceStart,
  minutes,
  status: "approved",
  needsReview: false,
  description: null,
  reviewedBy: null,
  reviewedAt: null,
  rejectReason: null,
  ...audit(nowMs)
});

/** SPEC 7.2 reliability from finished signups (no late cancels in the seed). */
export const reliabilityOf = (attended: number, noShows: number): Reliability => {
  const total = attended + noShows;
  if (total < 3) return { ...NEW_VOLUNTEER_RELIABILITY, attended, noShows, total };
  return { attended, noShows, lateCancels: 0, total, score: attended / total, isNew: false };
};

/** users/{uid}: the public totals recomputeVolunteerStats would write for these logs. */
export const publicUserDoc = (person: DemoPerson, approvedLogs: readonly HoursLogDoc[], nowMs: number): UserPublicDoc => {
  const hours = totalApprovedHours(approvedLogs.map((log) => log.minutes));
  return {
    displayName: nameOf(person),
    avatarPath: null,
    badges: badgesFor(hours),
    totalApprovedHours: hours,
    orgsHelpedCount: new Set(approvedLogs.map((log) => log.orgId)).size,
    streakWeeks: 0,
    ...audit(nowMs)
  };
};

export const privateProfileDoc = (
  person: DemoPerson & { readonly email: string },
  reliability: Reliability,
  windowFromMs: number | null,
  nowMs: number
): PrivateProfileDoc => ({
  firstName: person.first,
  lastName: person.last,
  fullName: fullNameFor(person.first, person.last),
  email: person.email,
  phone: null,
  birthDate: birthDateFor(person.years, nowMs),
  isMinor: person.years < 18,
  interests: ["hunger-food-security", "education-youth"],
  skills: [],
  availability: null,
  zip: "78204",
  homeGeohash: null,
  profileComplete: true,
  profileCompletedAt: ts(nowMs - 60 * DAY_MS),
  turnstileVerifiedAt: null,
  reliability: { ...reliability, windowFrom: windowFromMs === null ? null : ts(windowFromMs) },
  ...audit(nowMs)
});
