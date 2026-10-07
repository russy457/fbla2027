/**
 * demoExtras.ts
 * The E1 demo dataset (SPEC 1.2 Tier 1, PORT_PLAN E1): extra data layered on
 * the SPEC 10.7 seed so every Tier 1 screen has something real to show,
 * without changing any SPEC 10.7 fact (Jordan's 22.5 hours and 8 past
 * shifts, Sam's history, the one letter, the demo shift):
 *   - four more opportunities in new cause areas (seniors, environment,
 *     health, education) so Explore filters and recommendations have range,
 *   - upcoming shifts over the next two weeks with fellow volunteers signed up,
 *   - past pantry shifts for the background volunteers so the coordinator's
 *     attendance rate, reports, and hours-by-month have numbers,
 *   - a Needs attention queue on the pantry dashboard: one auto-completed
 *     shift log awaiting review (needsReview), one pending manual hours
 *     submission, and one open no-show dispute.
 * Pure: every time is derived from nowMs. Only the background people (no
 * sign-in) appear here, so the four demo accounts look exactly as SPEC says.
 */
import { createHash } from "node:crypto";
import { HOUR_MS, MINUTE_MS, signupIdFor, type HoursLogDoc, type InstanceDoc, type SignupDoc } from "@fbla/shared";
import { ts } from "../lib/firestore";
import { BACKGROUND, ORGS, type DemoOpportunity, type DemoPerson } from "./demoCast";
import { localShiftStart, type SeedWrite } from "./demoHistory";
import { instanceDoc, shiftHoursLog, signupDoc } from "./seedBuilders";

/** E1 opportunities. Titles never contain another seeded title (the e2e matches by text). */
export const EXTRA_OPPORTUNITIES = {
  seniorDelivery: {
    id: "pantry-senior-delivery",
    org: ORGS.pantry,
    title: "Deliver groceries to homebound seniors",
    description: "Ride along with a driver and carry grocery bags to seniors who cannot get to the pantry. Adults drive; teens carry.",
    causeArea: "seniors",
    minAge: 14
  },
  snackBags: {
    id: "pantry-weekend-snack-bags",
    org: ORGS.pantry,
    title: "Fill weekend snack bags for students",
    description: "Fill take-home snack bags that local schools send home with students on Fridays.",
    causeArea: "health-wellness",
    minAge: 13
  },
  homeworkHelp: {
    id: "westside-homework-help",
    org: ORGS.reading,
    title: "Homework help night",
    description: "Help third to fifth graders with reading and math homework at the Westside branch library.",
    causeArea: "education-youth",
    minAge: 15
  },
  riverCleanup: {
    id: "trails-river-cleanup",
    org: ORGS.trails,
    title: "Riverbank trash pickup",
    description: "Pick up litter along the river trail near the rescue's play yard. Gloves and bags provided.",
    causeArea: "environment",
    minAge: 13
  }
} satisfies Record<string, DemoOpportunity>;

type Seat = { readonly person: DemoPerson; readonly result: "confirmed" | "attended" | "auto-completed" | "no-show" | "disputed"; readonly minutes?: number };

interface ExtraShift {
  readonly id: string;
  readonly opportunity: DemoOpportunity;
  /** Local days from seed day (negative = past). */
  readonly dayOffset: number;
  readonly hour: number;
  readonly lengthMin: number;
  readonly capacity: number;
  readonly seats: readonly Seat[];
}

const { maria, dev, ana, luis } = BACKGROUND;

const EXTRA_SHIFTS: readonly ExtraShift[] = [
  // Past pantry shifts (finalized): attendance, hours by month, and the review queue.
  { id: "past-pantry-senior-delivery-45d", opportunity: EXTRA_OPPORTUNITIES.seniorDelivery, dayOffset: -45, hour: 10, lengthMin: 180, capacity: 4, seats: [{ person: maria, result: "attended", minutes: 180 }, { person: ana, result: "attended", minutes: 165 }] },
  { id: "past-pantry-snack-bags-18d", opportunity: EXTRA_OPPORTUNITIES.snackBags, dayOffset: -18, hour: 16, lengthMin: 120, capacity: 6, seats: [{ person: maria, result: "attended", minutes: 120 }, { person: dev, result: "attended", minutes: 105 }, { person: luis, result: "no-show" }] },
  { id: "past-pantry-senior-delivery-4d", opportunity: EXTRA_OPPORTUNITIES.seniorDelivery, dayOffset: -4, hour: 10, lengthMin: 180, capacity: 4, seats: [{ person: ana, result: "auto-completed", minutes: 180 }, { person: dev, result: "disputed" }, { person: maria, result: "attended", minutes: 180 }] },
  // Upcoming: Explore has range across causes and days.
  { id: "pantry-snack-bags-upcoming", opportunity: EXTRA_OPPORTUNITIES.snackBags, dayOffset: 5, hour: 16, lengthMin: 120, capacity: 8, seats: [{ person: maria, result: "confirmed" }, { person: dev, result: "confirmed" }] },
  { id: "pantry-senior-delivery-upcoming", opportunity: EXTRA_OPPORTUNITIES.seniorDelivery, dayOffset: 6, hour: 10, lengthMin: 180, capacity: 4, seats: [{ person: ana, result: "confirmed" }] },
  { id: "westside-homework-help-upcoming", opportunity: EXTRA_OPPORTUNITIES.homeworkHelp, dayOffset: 8, hour: 17, lengthMin: 90, capacity: 5, seats: [{ person: luis, result: "confirmed" }] },
  { id: "trails-river-cleanup-upcoming", opportunity: EXTRA_OPPORTUNITIES.riverCleanup, dayOffset: 10, hour: 8, lengthMin: 180, capacity: 12, seats: [] }
];

export interface ExtraContact {
  readonly person: DemoPerson;
  readonly instanceId: string;
  readonly instance: InstanceDoc;
}

export interface DemoExtras {
  readonly writes: SeedWrite[];
  /** Signups that need a signupContacts snapshot (written by demoSeed once reliability is known). */
  readonly contacts: ExtraContact[];
  /** Approved minutes per background uid, folded into users/{uid} totals. */
  readonly approvedLogs: ReadonlyMap<string, HoursLogDoc[]>;
  /** Earliest upcoming start per opportunity id. */
  readonly nextStarts: ReadonlyMap<string, number>;
}

const isFinishedSeat = (seat: Seat): boolean => seat.result !== "confirmed";

const signupFor = (seat: Seat, instance: InstanceDoc, instanceId: string, startMs: number, nowMs: number): SignupDoc => {
  if (seat.result === "confirmed") return signupDoc(seat.person, instance, instanceId, { kind: "confirmed" }, nowMs);
  if (seat.result === "no-show" || seat.result === "disputed") {
    const base = signupDoc(seat.person, instance, instanceId, { kind: "no-show" }, nowMs);
    if (seat.result === "no-show") return base;
    const openedAt = ts(instance.end.toMillis() + 20 * HOUR_MS);
    return { ...base, disputeOpen: true, dispute: { note: "I was there; the kiosk code expired while I was typing it.", openedAt, resolvedAt: null, resolvedBy: null } };
  }
  const checkOutMs = startMs + (seat.minutes ?? 0) * MINUTE_MS;
  const completed = signupDoc(seat.person, instance, instanceId, { kind: "completed", checkInMs: startMs, checkOutMs }, nowMs);
  return seat.result === "auto-completed" ? { ...completed, autoCompleted: true, checkOutAt: instance.end } : completed;
};

/** Hours log for a finished seat: approved kiosk log, or pending + needsReview for auto-completed. */
const logFor = (seat: Seat, signupId: string, signup: SignupDoc, nowMs: number): HoursLogDoc | null => {
  if (seat.minutes === undefined) return null;
  const log = shiftHoursLog(signupId, signup, seat.minutes, nowMs);
  return seat.result === "auto-completed" ? { ...log, source: "finalize", status: "pending", needsReview: true } : log;
};

/** A pending manual hours submission (SPEC 3.12 id: manual_{sha256(uid|requestNonce)}). */
const manualLog = (person: DemoPerson, nowMs: number): SeedWrite => {
  const id = `manual_${createHash("sha256").update(`${person.uid}|demo-manual-1`).digest("hex")}`;
  const data: HoursLogDoc = {
    uid: person.uid,
    orgId: ORGS.pantry.id,
    instanceId: null,
    signupId: null,
    source: "manual",
    date: ts(localShiftStart(nowMs, -9, 9)),
    minutes: 150,
    status: "pending",
    needsReview: false,
    description: "Helped unload the Saturday delivery truck before the market opened.",
    reviewedBy: null,
    reviewedAt: null,
    rejectReason: null,
    createdAt: ts(nowMs - 2 * HOUR_MS),
    updatedAt: ts(nowMs - 2 * HOUR_MS)
  };
  return { path: `hoursLogs/${id}`, data };
};

export const buildDemoExtras = (nowMs: number, saltFor: (instanceId: string) => string): DemoExtras => {
  const writes: SeedWrite[] = [];
  const contacts: ExtraContact[] = [];
  const approvedLogs = new Map<string, HoursLogDoc[]>();
  const nextStarts = new Map<string, number>();

  for (const shift of EXTRA_SHIFTS) {
    const startMs = localShiftStart(nowMs, shift.dayOffset, shift.hour);
    const finalized = shift.dayOffset < 0;
    const checkedIn = shift.seats.filter((seat) => seat.minutes !== undefined).length;
    const instance = instanceDoc({
      opportunity: shift.opportunity,
      times: { startMs, lengthMin: shift.lengthMin },
      capacity: shift.capacity,
      signupCount: finalized ? shift.seats.filter(isFinishedSeat).length : shift.seats.length,
      checkedInCount: finalized ? checkedIn : 0,
      finalized,
      nowMs
    });
    writes.push({ path: `instances/${shift.id}`, data: instance });
    if (!finalized) {
      writes.push({ path: `instanceSecrets/${shift.id}`, data: { salt: saltFor(shift.id), keyVersion: 1, createdAt: ts(nowMs), updatedAt: ts(nowMs) } });
      const current = nextStarts.get(shift.opportunity.id);
      if (current === undefined || startMs < current) nextStarts.set(shift.opportunity.id, startMs);
    }
    for (const seat of shift.seats) {
      const signupId = signupIdFor(shift.id, seat.person.uid);
      const signup = signupFor(seat, instance, shift.id, startMs, nowMs);
      writes.push({ path: `signups/${signupId}`, data: signup });
      contacts.push({ person: seat.person, instanceId: shift.id, instance });
      const log = logFor(seat, signupId, signup, nowMs);
      if (!log) continue;
      writes.push({ path: `hoursLogs/${signupId}`, data: log });
      if (log.status === "approved") approvedLogs.set(log.uid, [...(approvedLogs.get(log.uid) ?? []), log]);
    }
  }
  writes.push(manualLog(luis, nowMs));
  return { writes, contacts, approvedLogs, nextStarts };
};
