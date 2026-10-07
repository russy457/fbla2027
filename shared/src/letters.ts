/**
 * letters.ts
 * Pure parts of verified hours letters (SPEC#letters, SPEC#fn-issueletter, G19):
 *   - summarizeEvidence: which approved logs count, per-org totals, and what
 *     was excluded because the organization is not verified. issueLetter
 *     freezes this result into the letter; the letter builder preview runs
 *     the same function on the client so the numbers always match.
 *   - base32 verify codes and the input normalizer used by /verify.
 */

export interface EvidenceLog {
  readonly id: string;
  readonly orgId: string;
  readonly minutes: number;
  /** Shift start or service date, epoch ms. */
  readonly dateMs: number;
}

export interface EvidenceOrg {
  readonly name: string;
  readonly verified: boolean;
}

export interface EvidenceRequest {
  readonly logs: readonly EvidenceLog[];
  /** Current org facts by id; an org missing here counts as unverified. */
  readonly orgs: Readonly<Record<string, EvidenceOrg>>;
  /** Inclusive start instant of the range, epoch ms. */
  readonly fromMs: number;
  /** Exclusive end instant of the range (start of the day after `to`), epoch ms. */
  readonly toExclusiveMs: number;
  /** Only this org's hours, or null for every org. */
  readonly onlyOrgId: string | null;
}

export interface PerOrgMinutes {
  readonly orgId: string;
  readonly orgName: string;
  readonly verified: boolean;
  readonly minutes: number;
}

export interface EvidenceSummary {
  /** Logs that count toward the letter (verified orgs, in range). */
  readonly logIds: string[];
  /** Every org with in-range minutes, verified or not, sorted by minutes then name. */
  readonly perOrg: PerOrgMinutes[];
  /** Orgs whose hours count, in perOrg order. */
  readonly orgIds: string[];
  readonly totalMinutes: number;
  readonly excludedUnverifiedMinutes: number;
  readonly excludedUnverifiedCount: number;
}

export const UNKNOWN_ORG_NAME = "Unknown organization";

/** Builds the evidence snapshot for a letter. Pure: same input, same output. */
export const summarizeEvidence = (request: EvidenceRequest): EvidenceSummary => {
  const inScope = request.logs.filter(
    (log) =>
      log.dateMs >= request.fromMs &&
      log.dateMs < request.toExclusiveMs &&
      (request.onlyOrgId === null || log.orgId === request.onlyOrgId)
  );
  const orgOf = (orgId: string): EvidenceOrg => request.orgs[orgId] ?? { name: UNKNOWN_ORG_NAME, verified: false };
  const counted = inScope.filter((log) => orgOf(log.orgId).verified);
  const excluded = inScope.filter((log) => !orgOf(log.orgId).verified);

  const minutesByOrg = inScope.reduce<ReadonlyMap<string, number>>(
    (totals, log) => new Map(totals).set(log.orgId, (totals.get(log.orgId) ?? 0) + log.minutes),
    new Map()
  );
  const perOrg = [...minutesByOrg.entries()]
    .map(([orgId, minutes]) => ({ orgId, orgName: orgOf(orgId).name, verified: orgOf(orgId).verified, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.orgName.localeCompare(b.orgName));

  const sum = (logs: readonly EvidenceLog[]): number => logs.reduce((total, log) => total + log.minutes, 0);
  return {
    logIds: counted.map((log) => log.id).sort(),
    perOrg,
    orgIds: perOrg.filter((row) => row.verified).map((row) => row.orgId),
    totalMinutes: sum(counted),
    excludedUnverifiedMinutes: sum(excluded),
    excludedUnverifiedCount: excluded.length
  };
};

/** RFC 4648 base32 alphabet (no padding is emitted). */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Encodes bytes as RFC 4648 base32 without padding. 16 bytes become 26 characters. */
export const base32Encode = (bytes: Uint8Array): string => {
  let output = "";
  let buffer = 0;
  let bitCount = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitCount += 8;
    while (bitCount >= 5) {
      output += BASE32_ALPHABET[(buffer >>> (bitCount - 5)) & 31];
      bitCount -= 5;
    }
    buffer &= (1 << bitCount) - 1; // keep only bits not yet emitted so the number never overflows
  }
  return bitCount > 0 ? output + BASE32_ALPHABET[(buffer << (5 - bitCount)) & 31] : output;
};

/** A verify code is 26 base32 characters (128 random bits). */
export const VERIFY_CODE_PATTERN = /^[A-Z2-7]{26}$/;

/** /verify input normalizer: uppercase, strip spaces and dashes (SPEC#letters). */
export const normalizeVerifyCode = (input: string): string => input.toUpperCase().replace(/[\s-]+/g, "");

/** Groups a code in fours for print, for example "ABCD-EFGH-...". */
export const formatVerifyCode = (code: string): string => code.match(/.{1,4}/g)?.join("-") ?? "";
