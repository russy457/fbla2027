/**
 * fixtures.ts
 * Test-only builders for the documents screens read: a Timestamp stand-in
 * (anything with toMillis/toDate satisfies the shared schemas) and complete
 * instance and signup documents with sensible defaults, so each test only
 * spells out the fields it is about.
 */
import type { TimestampLike } from "@fbla/shared";
import type { Instance } from "@/lib/data/instances";
import type { Signup } from "@/lib/data/signups";

export const ts = (ms: number): TimestampLike => ({ toMillis: () => ms, toDate: () => new Date(ms) });

/** 2026-10-17 09:00 America/Chicago (CDT, UTC-5). */
export const SHIFT_START_MS = Date.UTC(2026, 9, 17, 14, 0, 0);
export const SHIFT_END_MS = SHIFT_START_MS + 2 * 60 * 60 * 1000;
export const MINUTE = 60_000;

export const makeInstance = (overrides: Partial<Instance> = {}): Instance => ({
  id: "shift-1",
  orgId: "org-1",
  opportunityId: "opp-1",
  seriesId: null,
  title: "Sort and pack food boxes",
  orgName: "Common Table Pantry",
  orgVerified: true,
  minAge: 13,
  timeZone: "America/Chicago",
  start: ts(SHIFT_START_MS),
  end: ts(SHIFT_END_MS),
  capacity: 3,
  signupCount: 1,
  waitlist: [],
  waitlistSeq: 0,
  checkedInCount: 0,
  status: "scheduled",
  cutoffAt: ts(SHIFT_START_MS - 120 * MINUTE),
  finalizeAt: ts(SHIFT_END_MS + 30 * MINUTE),
  cutoffDoneAt: null,
  finalizedAt: null,
  nextActionAt: null,
  sequence: 0,
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
  createdAt: ts(0),
  updatedAt: ts(0),
  ...overrides
});

export const makeSignup = (overrides: Partial<Signup> = {}): Signup => ({
  id: "shift-1_uid-1",
  instanceId: "shift-1",
  opportunityId: "opp-1",
  orgId: "org-1",
  uid: "uid-1",
  displayName: "Jordan R.",
  instanceStart: ts(SHIFT_START_MS),
  instanceEnd: ts(SHIFT_END_MS),
  status: "confirmed",
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
  createdAt: ts(0),
  updatedAt: ts(0),
  ...overrides
});
