/**
 * rosterRows.ts
 * Joins a shift's signups with the coordinator's contact snapshots into the
 * rows the roster shows (SPEC#screen-inventory "Shift roster", D23).
 * Contact rules:
 *   - no snapshot readable (minor coordinator, G14): "Not shared with you"
 *   - snapshot hidden (minor at an unverified org, T4):
 *       "Contact hidden until your organization is verified"
 *   - otherwise: email and phone.
 * Cancelled signups are left off; everyone else is sorted arrivals first.
 */
import type { SignupStatus } from "@fbla/shared";

export interface RosterSignup {
  readonly id: string;
  readonly displayName: string;
  readonly status: SignupStatus;
  readonly walkUp: boolean;
  readonly checkInAt: { toMillis(): number } | null;
  readonly checkOutAt: { toMillis(): number } | null;
}

export interface RosterContact {
  readonly id: string;
  readonly hidden: boolean;
  readonly email?: string | undefined;
  readonly phone?: string | null | undefined;
}

export type ContactCell =
  | { readonly kind: "shown"; readonly email: string | null; readonly phone: string | null }
  | { readonly kind: "hidden-unverified" }
  | { readonly kind: "not-shared" };

export interface RosterRow {
  readonly id: string;
  readonly displayName: string;
  readonly status: SignupStatus;
  readonly walkUp: boolean;
  readonly checkInAtMs: number | null;
  readonly checkOutAtMs: number | null;
  readonly contact: ContactCell;
}

const STATUS_ORDER: Readonly<Record<SignupStatus, number>> = {
  "checked-in": 0,
  completed: 1,
  confirmed: 2,
  waitlisted: 3,
  "no-show": 4,
  excused: 5,
  cancelled: 6
};

export const contactCellFor = (contact: RosterContact | undefined, canViewContacts: boolean): ContactCell => {
  if (!canViewContacts || contact === undefined) return { kind: "not-shared" };
  if (contact.hidden) return { kind: "hidden-unverified" };
  return { kind: "shown", email: contact.email ?? null, phone: contact.phone ?? null };
};

export const buildRosterRows = (
  signups: readonly RosterSignup[],
  contacts: readonly RosterContact[],
  canViewContacts: boolean
): RosterRow[] => {
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  return signups
    .filter((signup) => signup.status !== "cancelled")
    .map((signup) => ({
      id: signup.id,
      displayName: signup.displayName,
      status: signup.status,
      walkUp: signup.walkUp,
      checkInAtMs: signup.checkInAt?.toMillis() ?? null,
      checkOutAtMs: signup.checkOutAt?.toMillis() ?? null,
      contact: contactCellFor(contactById.get(signup.id), canViewContacts)
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.displayName.localeCompare(b.displayName));
};
