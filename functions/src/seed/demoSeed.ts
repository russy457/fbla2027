/**
 * demoSeed.ts
 * Builds every document of the demo seed (SPEC#demo-accounts, 10.7) as a
 * plain list of writes, with no I/O, so it can be unit-tested against the
 * shared schemas and reused by a server-side reset later. Upcoming shifts:
 *   - the demo shift starting in `shiftStartsInMs`, capacity 3 with one seat
 *     left (Jordan and Maria confirmed); 3 hours long, so attending it in
 *     full takes Jordan from 22.5 past the 25-hour milestone,
 *   - a full shift at the second verified org with two people waitlisted,
 *   - a shift at the unverified org (Sam, a minor, is blocked from it),
 *   - another pantry shift later in the week.
 * The finished history and the past letter come from demoHistory.ts.
 */
import { DAY_MS, NEW_VOLUNTEER_RELIABILITY, signupIdFor, type InstanceDoc, type OpportunityDoc } from "@fbla/shared";
import { ts } from "../lib/firestore";
import { ADMIN, BACKGROUND, DEMO_ACCOUNTS, OPPORTUNITIES, ORGS, VOLUNTEER, type DemoAccount, type DemoOpportunity, type DemoPerson } from "./demoCast";
import { buildHistory, buildPastLetter, localShiftStart, reliabilityInputs, type SeedWrite, type SeededLetter } from "./demoHistory";
import {
  instanceDoc,
  organizationDoc,
  ownerMemberDoc,
  privateProfileDoc,
  publicUserDoc,
  reliabilityOf,
  signupContactDoc,
  signupDoc,
  type SignupOutcome
} from "./seedBuilders";

/** Bump when the seed's shape changes; demo:reset reseeds when it differs. */
export const SEED_SCHEMA_VERSION = 2;
export const DEMO_INSTANCE_ID = "demo-shift";
export const FULL_INSTANCE_ID = "reading-buddies-full";
export const DEMO_SHIFT_LENGTH_MIN = 180;

export interface DemoSeedParams {
  readonly nowMs: number;
  readonly shiftStartsInMs: number;
  /** Kiosk key salt for one instance (random base64 in real runs; fixed in tests). */
  readonly saltFor: (instanceId: string) => string;
  readonly letterVerifyCode: string;
  readonly letterNonce: string;
}

export interface DemoSeed {
  readonly accounts: readonly DemoAccount[];
  readonly writes: readonly SeedWrite[];
  readonly letter: SeededLetter;
  readonly demoShiftStartMs: number;
}

interface UpcomingSeat {
  readonly person: DemoPerson;
  readonly outcome: SignupOutcome;
}

interface UpcomingShift {
  readonly id: string;
  readonly opportunity: DemoOpportunity;
  readonly startMs: number;
  readonly lengthMin: number;
  readonly capacity: number;
  readonly seats: readonly UpcomingSeat[];
}

const confirmed = (person: DemoPerson): UpcomingSeat => ({ person, outcome: { kind: "confirmed" } });
const waitlisted = (person: DemoPerson, seq: number): UpcomingSeat => ({ person, outcome: { kind: "waitlisted", seq } });

const upcomingShifts = (nowMs: number, demoStartMs: number): UpcomingShift[] => [
  { id: DEMO_INSTANCE_ID, opportunity: OPPORTUNITIES.sortAndPack, startMs: demoStartMs, lengthMin: DEMO_SHIFT_LENGTH_MIN, capacity: 3, seats: [confirmed(VOLUNTEER), confirmed(BACKGROUND.maria)] },
  {
    id: FULL_INSTANCE_ID,
    opportunity: OPPORTUNITIES.readingBuddies,
    startMs: localShiftStart(nowMs, 2, 15, 30),
    lengthMin: 90,
    capacity: 2,
    seats: [confirmed(BACKGROUND.maria), confirmed(BACKGROUND.dev), waitlisted(BACKGROUND.ana, 1), waitlisted(BACKGROUND.luis, 2)]
  },
  { id: "trails-dog-walk-upcoming", opportunity: OPPORTUNITIES.dogWalk, startMs: localShiftStart(nowMs, 3, 10), lengthMin: 120, capacity: 6, seats: [confirmed(BACKGROUND.luis)] },
  { id: "pantry-family-market-upcoming", opportunity: OPPORTUNITIES.familyMarket, startMs: localShiftStart(nowMs, 4, 9), lengthMin: 240, capacity: 8, seats: [confirmed(BACKGROUND.ana)] }
];

const opportunityDoc = (opportunity: DemoOpportunity, nextStartMs: number | null, nowMs: number): OpportunityDoc => ({
  orgId: opportunity.org.id,
  orgName: opportunity.org.name,
  orgVerified: opportunity.org.verified,
  title: opportunity.title,
  description: opportunity.description,
  causeArea: opportunity.causeArea,
  type: "one-time",
  skills: [],
  minAge: opportunity.minAge,
  location: { address: opportunity.org.address, geo: null },
  seriesId: null,
  status: "active",
  nextInstanceStart: nextStartMs === null ? null : ts(nextStartMs),
  createdBy: opportunity.org.owner.uid,
  createdAt: ts(nowMs - 30 * DAY_MS),
  updatedAt: ts(nowMs)
});

interface UpcomingResult {
  readonly writes: SeedWrite[];
  readonly contacts: Array<{ readonly person: DemoPerson; readonly instanceId: string; readonly instance: InstanceDoc }>;
}

const buildUpcoming = (params: DemoSeedParams, shifts: readonly UpcomingShift[]): UpcomingResult => {
  const { nowMs } = params;
  const writes: SeedWrite[] = [];
  const contacts: Array<UpcomingResult["contacts"][number]> = [];
  for (const shift of shifts) {
    const holding = shift.seats.filter((seat) => seat.outcome.kind === "confirmed");
    const waitlist = shift.seats.flatMap((seat) =>
      seat.outcome.kind === "waitlisted" ? [{ uid: seat.person.uid, signupId: signupIdFor(shift.id, seat.person.uid), seq: seat.outcome.seq }] : []
    );
    const instance = instanceDoc({
      opportunity: shift.opportunity,
      times: { startMs: shift.startMs, lengthMin: shift.lengthMin },
      capacity: shift.capacity,
      signupCount: holding.length,
      waitlist,
      finalized: false,
      nowMs
    });
    writes.push({ path: `instances/${shift.id}`, data: instance });
    writes.push({ path: `instanceSecrets/${shift.id}`, data: { salt: params.saltFor(shift.id), keyVersion: 1, createdAt: ts(nowMs), updatedAt: ts(nowMs) } });
    for (const seat of shift.seats) {
      writes.push({ path: `signups/${signupIdFor(shift.id, seat.person.uid)}`, data: signupDoc(seat.person, instance, shift.id, seat.outcome, nowMs) });
      contacts.push({ person: seat.person, instanceId: shift.id, instance });
    }
  }
  return { writes, contacts };
};

const nextStartByOpportunity = (shifts: readonly UpcomingShift[]): ReadonlyMap<string, number> =>
  shifts.reduce((map, shift) => {
    const current = map.get(shift.opportunity.id);
    return current === undefined || shift.startMs < current ? new Map(map).set(shift.opportunity.id, shift.startMs) : map;
  }, new Map<string, number>());

const accountOf = (person: DemoPerson): DemoAccount | undefined => DEMO_ACCOUNTS.find((account) => account.uid === person.uid);

export const buildDemoSeed = (params: DemoSeedParams): DemoSeed => {
  const { nowMs } = params;
  const demoShiftStartMs = nowMs + params.shiftStartsInMs;
  const history = buildHistory(nowMs);
  const shifts = upcomingShifts(nowMs, demoShiftStartMs);
  const upcoming = buildUpcoming(params, shifts);
  const letter = buildPastLetter(nowMs, history, params.letterVerifyCode, params.letterNonce);
  const reliabilityFor = (uid: string) => {
    const inputs = reliabilityInputs(history, uid);
    return inputs.attended + inputs.noShows === 0 ? NEW_VOLUNTEER_RELIABILITY : reliabilityOf(inputs.attended, inputs.noShows);
  };

  const orgWrites = Object.values(ORGS).flatMap((org): SeedWrite[] => [
    { path: `organizations/${org.id}`, data: organizationDoc(org, ADMIN.uid, nowMs) },
    { path: `organizations/${org.id}/members/${org.owner.uid}`, data: ownerMemberDoc(org, nowMs) }
  ]);
  const nextStarts = nextStartByOpportunity(shifts);
  const opportunityWrites = Object.values(OPPORTUNITIES).map(
    (opportunity): SeedWrite => ({ path: `opportunities/${opportunity.id}`, data: opportunityDoc(opportunity, nextStarts.get(opportunity.id) ?? null, nowMs) })
  );
  const everyone: readonly DemoPerson[] = [...DEMO_ACCOUNTS, ...Object.values(BACKGROUND)];
  const peopleWrites = everyone.flatMap((person): SeedWrite[] => {
    const approved = history.byUid.get(person.uid)?.approvedLogs ?? [];
    const account = accountOf(person);
    const publicDoc: SeedWrite = { path: `users/${person.uid}`, data: publicUserDoc(person, approved, nowMs) };
    if (!account) return [publicDoc];
    const windowFromMs = reliabilityInputs(history, person.uid).windowFromMs;
    return [publicDoc, { path: `users/${person.uid}/private/profile`, data: privateProfileDoc(account, reliabilityFor(person.uid), windowFromMs, nowMs) }];
  });
  const contactWrites = [
    ...history.contacts.map((entry) => ({ person: entry.account as DemoPerson, instanceId: entry.instanceId, instance: entry.instance })),
    ...upcoming.contacts.map((entry) => ({ person: accountOf(entry.person) ?? entry.person, instanceId: entry.instanceId, instance: entry.instance }))
  ].map(
    (entry): SeedWrite => ({
      path: `signupContacts/${signupIdFor(entry.instanceId, entry.person.uid)}`,
      data: signupContactDoc(entry.person, entry.instance, entry.instanceId, reliabilityFor(entry.person.uid), nowMs)
    })
  );

  const systemWrites: SeedWrite[] = [
    { path: "demoClock/global", data: { offsetMs: 0, setBy: "seed", setAt: ts(nowMs) } },
    { path: "meta/seed", data: { schemaVersion: SEED_SCHEMA_VERSION, seededAt: ts(nowMs), shiftStartsAt: ts(demoShiftStartMs) } }
  ];

  return {
    accounts: DEMO_ACCOUNTS,
    writes: [...orgWrites, ...opportunityWrites, ...peopleWrites, ...history.writes, ...upcoming.writes, ...contactWrites, ...letter.writes, ...systemWrites],
    letter,
    demoShiftStartMs
  };
};
