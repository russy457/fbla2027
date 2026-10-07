/**
 * ids.ts
 * Deterministic document ids and derived names (SPEC#data-model). Ids built
 * from their inputs make retries idempotent: a second signup for the same
 * person and shift lands on the same document instead of creating a twin.
 */

/** signups/{instanceId}_{uid} (SPEC#dm-signups). Also the hoursLogs id for shift logs. */
export const signupIdFor = (instanceId: string, uid: string): string => `${instanceId}_${uid}`;

/** Letter scope: one org or every org, over an inclusive date range. */
export interface LetterScope {
  readonly orgId: string;
  readonly from: string;
  readonly to: string;
}

/** The org id that means "every organization" in a letter scope. */
export const ALL_ORGS = "ALL";

/** `{orgId or ALL}:{from}:{to}`; same scope means exact string match (SPEC#dm-letters). */
export const scopeKeyFor = (scope: LetterScope): string => `${scope.orgId}:${scope.from}:${scope.to}`;

/**
 * Public display name: first name + last initial for everyone (SPEC Appendix
 * B item 26), for example "Jordan R.". Full names appear only in coordinator
 * contact snapshots and the volunteer's own PDF.
 */
export const displayNameFor = (firstName: string, lastName: string): string => {
  const first = firstName.trim();
  const initial = lastName.trim().charAt(0).toUpperCase();
  return initial ? `${first} ${initial}.` : first;
};

export const fullNameFor = (firstName: string, lastName: string): string => `${firstName.trim()} ${lastName.trim()}`.trim();
