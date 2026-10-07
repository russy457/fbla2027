/**
 * invites.ts
 * Coordinator invite codes (SPEC 3.5, coordinator.createInvite and
 * redeemInvite). A code is 10 base32 characters (50 random bits), shown once
 * to the owner as "ABCDE-FGHIJ". Only its SHA-256 is stored as the invite id,
 * so a database reader cannot redeem codes. People type codes by hand, so
 * input is normalized: uppercase, spaces and dashes removed.
 */

export const INVITE_CODE_LENGTH = 10;
/** Invites expire this many days after they are created. */
export const INVITE_TTL_DAYS = 7;

/** A normalized code: 10 characters of the RFC 4648 base32 alphabet. */
export const INVITE_CODE_PATTERN = /^[A-Z2-7]{10}$/;

/** Uppercases and strips spaces and dashes, so "abcde-fghij" matches "ABCDEFGHIJ". */
export const normalizeInviteCode = (input: string): string => input.toUpperCase().replace(/[\s-]+/g, "");

/** Groups a code for display: "ABCDE-FGHIJ". */
export const formatInviteCode = (code: string): string =>
  code.length === INVITE_CODE_LENGTH ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
