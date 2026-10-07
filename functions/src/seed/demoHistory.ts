/**
 * demoHistory.ts
 * The finished past of the demo seed (SPEC#demo-accounts, 10.7):
 *   - Jordan (adult volunteer) has 8 past shifts: 7 attended with approved
 *     kiosk logs totaling 22.5 hours (so the live demo check-out crosses the
 *     25-hour milestone) and 1 no-show, which gives reliability 7 of 8,
 *   - one of those shifts is at the unverified org, so letters show hours
 *     excluded for verification,
 *   - Sam (minor) attended two shifts; at the unverified org their contact
 *     snapshot is hidden (T4),
 *   - one valid letter for Jordan covering the older half of that history.
 * Pure: every time is derived from nowMs.
 */
import {
  ALL_ORGS,
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  PATHS,
  displayNameFor,
  localDateIn,
  scopeKeyFor,
  signupIdFor,
  startOfLocalDay,
  startOfNextLocalDay,
  summarizeEvidence,
  type HoursLogDoc,
  type LetterDoc,
  type LetterRefDoc,
  type LetterScope,
  type LetterVerificationDoc
} from "@fbla/shared";
import { ts } from "../lib/firestore";
import { letterIdFor } from "../letters/letterIds";
import { LETTER_RENDERER_VERSION } from "../letters/renderLetterPdf";
import { MINOR, OPPORTUNITIES, ORGS, VOLUNTEER, type DemoAccount, type DemoOpportunity } from "./demoCast";
import { SEED_TIME_ZONE, instanceDoc, shiftHoursLog, signupDoc, type SignupOutcome } from "./seedBuilders";

export interface SeedWrite {
  readonly path: string;
  readonly data: object;
}

interface PastAttendee {
  readonly account: DemoAccount;
  /** Credited minutes, or null for a no-show. */
  readonly minutes: number | null;
}

interface PastShift {
  readonly daysAgo: number;
  readonly opportunity: DemoOpportunity;
  readonly startHour: number;
  readonly lengthMin: number;
  readonly attendees: readonly PastAttendee[];
}

const jordan = (minutes: number | null): PastAttendee => ({ account: VOLUNTEER, minutes });
const sam = (minutes: number): PastAttendee => ({ account: MINOR, minutes });

/** Weekly history, oldest first. Jordan's attended minutes sum to 1350 (22.5 hours). */
const PAST_SHIFTS: readonly PastShift[] = [
  { daysAgo: 63, opportunity: OPPORTUNITIES.familyMarket, startHour: 9, lengthMin: 240, attendees: [jordan(180)] },
  { daysAgo: 56, opportunity: OPPORTUNITIES.readingBuddies, startHour: 15, lengthMin: 240, attendees: [jordan(240)] },
  { daysAgo: 49, opportunity: OPPORTUNITIES.familyMarket, startHour: 9, lengthMin: 240, attendees: [jordan(180)] },
  { daysAgo: 42, opportunity: OPPORTUNITIES.dogWalk, startHour: 10, lengthMin: 180, attendees: [jordan(150), sam(120)] },
  { daysAgo: 35, opportunity: OPPORTUNITIES.readingBuddies, startHour: 15, lengthMin: 240, attendees: [jordan(240)] },
  { daysAgo: 28, opportunity: OPPORTUNITIES.familyMarket, startHour: 9, lengthMin: 240, attendees: [jordan(195)] },
  { daysAgo: 21, opportunity: OPPORTUNITIES.readingBuddies, startHour: 15, lengthMin: 240, attendees: [jordan(null)] },
  { daysAgo: 14, opportunity: OPPORTUNITIES.familyMarket, startHour: 9, lengthMin: 240, attendees: [jordan(165), sam(180)] }
];

/** The seeded letter covers the history from the first shift through this many days ago. */
const LETTER_TO_DAYS_AGO = 30;
const LETTER_ISSUED_DAYS_AGO = 29;

/** 9:00 local (or startHour) on the local day `daysOffset` from seed day. */
export const localShiftStart = (nowMs: number, daysOffset: number, hour: number, minute = 0): number => {
  const ymd = localDateIn(new Date(nowMs + daysOffset * DAY_MS), SEED_TIME_ZONE);
  return startOfLocalDay(ymd, SEED_TIME_ZONE).getTime() + hour * HOUR_MS + minute * MINUTE_MS;
};

export interface PersonHistory {
  readonly approvedLogs: HoursLogDoc[];
  readonly attended: number;
  readonly noShows: number;
  /** Start of the oldest finished signup (reliability windowFrom), or null. */
  readonly windowFromMs: number | null;
}

export interface DemoHistory {
  readonly writes: SeedWrite[];
  /** Contact snapshots are written later, once reliability is known; these name what to write. */
  readonly contacts: Array<{ readonly account: DemoAccount; readonly instanceId: string; readonly instance: ReturnType<typeof instanceDoc> }>;
  readonly byUid: ReadonlyMap<string, PersonHistory>;
  readonly logIds: ReadonlyMap<string, HoursLogDoc>;
}

const outcomeFor = (attendee: PastAttendee, startMs: number): SignupOutcome =>
  attendee.minutes === null
    ? { kind: "no-show" }
    : { kind: "completed", checkInMs: startMs, checkOutMs: startMs + attendee.minutes * MINUTE_MS };

export const buildHistory = (nowMs: number): DemoHistory => {
  const writes: SeedWrite[] = [];
  const contacts: Array<DemoHistory["contacts"][number]> = [];
  const logIds = new Map<string, HoursLogDoc>();
  const byUid = new Map<string, PersonHistory>();
  const historyOf = (uid: string): PersonHistory => byUid.get(uid) ?? { approvedLogs: [], attended: 0, noShows: 0, windowFromMs: null };

  for (const shift of PAST_SHIFTS) {
    const startMs = localShiftStart(nowMs, -shift.daysAgo, shift.startHour);
    const instanceId = `past-${shift.opportunity.id}-${shift.daysAgo}d`;
    const attendedCount = shift.attendees.filter((attendee) => attendee.minutes !== null).length;
    const instance = instanceDoc({
      opportunity: shift.opportunity,
      times: { startMs, lengthMin: shift.lengthMin },
      capacity: 10,
      signupCount: attendedCount,
      checkedInCount: attendedCount,
      finalized: true,
      nowMs
    });
    writes.push({ path: `instances/${instanceId}`, data: instance });

    for (const attendee of shift.attendees) {
      const signupId = signupIdFor(instanceId, attendee.account.uid);
      const signup = signupDoc(attendee.account, instance, instanceId, outcomeFor(attendee, startMs), nowMs);
      writes.push({ path: `signups/${signupId}`, data: signup });
      contacts.push({ account: attendee.account, instanceId, instance });
      const before = historyOf(attendee.account.uid);
      const windowFromMs = before.windowFromMs ?? startMs;
      if (attendee.minutes === null) {
        byUid.set(attendee.account.uid, { ...before, noShows: before.noShows + 1, windowFromMs });
        continue;
      }
      const log = shiftHoursLog(signupId, signup, attendee.minutes, nowMs);
      writes.push({ path: `hoursLogs/${signupId}`, data: log });
      logIds.set(signupId, log);
      byUid.set(attendee.account.uid, { ...before, approvedLogs: [...before.approvedLogs, log], attended: before.attended + 1, windowFromMs });
    }
  }
  return { writes, contacts, byUid, logIds };
};

export interface SeededLetter {
  readonly letterId: string;
  readonly letter: LetterDoc;
  readonly fullName: string;
  readonly writes: SeedWrite[];
}

/** One valid letter for Jordan over the older part of the history, with its public projection and letterRefs. */
export const buildPastLetter = (nowMs: number, history: DemoHistory, verifyCode: string, requestNonce: string): SeededLetter => {
  const orgFacts = Object.fromEntries(Object.values(ORGS).map((org) => [org.id, { name: org.name, verified: org.verified }]));
  const from = localDateIn(new Date(localShiftStart(nowMs, -PAST_SHIFTS[0]!.daysAgo, 0)), SEED_TIME_ZONE);
  const to = localDateIn(new Date(nowMs - LETTER_TO_DAYS_AGO * DAY_MS), SEED_TIME_ZONE);
  const scope: LetterScope = { orgId: ALL_ORGS, from, to };
  const logs = [...history.logIds.entries()]
    .filter(([, log]) => log.uid === VOLUNTEER.uid)
    .map(([id, log]) => ({ id, orgId: log.orgId, minutes: log.minutes, dateMs: log.date.toMillis() }));
  const evidence = summarizeEvidence({
    logs,
    orgs: orgFacts,
    fromMs: startOfLocalDay(from, SEED_TIME_ZONE).getTime(),
    toExclusiveMs: startOfNextLocalDay(to, SEED_TIME_ZONE).getTime(),
    onlyOrgId: null
  });
  const scopeKey = scopeKeyFor(scope);
  const letterId = letterIdFor(VOLUNTEER.uid, scopeKey, requestNonce);
  const issuedAt = ts(nowMs - LETTER_ISSUED_DAYS_AGO * DAY_MS);
  const displayName = displayNameFor(VOLUNTEER.first, VOLUNTEER.last);
  const letter: LetterDoc = {
    uid: VOLUNTEER.uid,
    displayName,
    scope,
    scopeKey,
    orgIds: evidence.orgIds,
    verifyCode,
    status: "valid",
    evidence: {
      logIds: evidence.logIds,
      perOrg: evidence.perOrg,
      totalMinutes: evidence.totalMinutes,
      excludedUnverifiedMinutes: evidence.excludedUnverifiedMinutes,
      excludedUnverifiedCount: evidence.excludedUnverifiedCount,
      from,
      to
    },
    rendererVersion: LETTER_RENDERER_VERSION,
    pdfPath: PATHS.letterPdf(VOLUNTEER.uid, letterId),
    // runDemoSeed renders the PDF next and flips this to "ready" (or "failed").
    pdfStatus: "generating",
    issuedAt,
    supersededAt: null,
    supersededBy: null,
    supersededReason: null,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    revokeNote: null,
    createdAt: issuedAt,
    updatedAt: issuedAt
  };
  const verification: LetterVerificationDoc = {
    displayName,
    orgNames: evidence.perOrg.filter((row) => row.verified).map((row) => row.orgName),
    totalMinutes: evidence.totalMinutes,
    from,
    to,
    issuedAt,
    status: "valid",
    supersededByIssuedAt: null,
    revokeReasonLabel: null
  };
  const refs = evidence.perOrg
    .filter((row) => row.verified)
    .map((row): SeedWrite => {
      const ref: LetterRefDoc = { letterId, uid: VOLUNTEER.uid, displayName, minutesForOrg: row.minutes, status: "valid", issuedAt, createdAt: issuedAt, updatedAt: issuedAt };
      return { path: PATHS.letterRef(row.orgId, letterId), data: ref };
    });
  return {
    letterId,
    letter,
    fullName: `${VOLUNTEER.first} ${VOLUNTEER.last}`,
    writes: [{ path: `letters/${letterId}`, data: letter }, { path: `letterVerifications/${verifyCode}`, data: verification }, ...refs]
  };
};

/** Reliability inputs for one person from their finished history. */
export const reliabilityInputs = (history: DemoHistory, uid: string): { attended: number; noShows: number; windowFromMs: number | null } => {
  const person = history.byUid.get(uid);
  return { attended: person?.attended ?? 0, noShows: person?.noShows ?? 0, windowFromMs: person?.windowFromMs ?? null };
};

