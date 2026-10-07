import { describe, expect, it } from "vitest";
import { ALL_ORGS, displayNameFor, fullNameFor, scopeKeyFor, signupIdFor } from "./ids";
import {
  UNKNOWN_ORG_NAME,
  VERIFY_CODE_PATTERN,
  base32Encode,
  formatVerifyCode,
  normalizeVerifyCode,
  summarizeEvidence,
  type EvidenceLog
} from "./letters";
import { COLLECTIONS, PATHS } from "./collections";

const DAY = 86_400_000;
const FROM = Date.UTC(2026, 7, 1);
const TO_EXCLUSIVE = Date.UTC(2026, 9, 16);

const logs: EvidenceLog[] = [
  { id: "a", orgId: "pantry", minutes: 240, dateMs: FROM + DAY },
  { id: "b", orgId: "pantry", minutes: 495, dateMs: FROM + 10 * DAY },
  { id: "c", orgId: "literacy", minutes: 360, dateMs: FROM + 20 * DAY },
  { id: "d", orgId: "garden", minutes: 120, dateMs: FROM + 5 * DAY }, // unverified
  { id: "e", orgId: "ghost", minutes: 60, dateMs: FROM + 6 * DAY }, // org doc missing
  { id: "f", orgId: "pantry", minutes: 90, dateMs: TO_EXCLUSIVE }, // first instant after the range
  { id: "g", orgId: "pantry", minutes: 30, dateMs: FROM - 1 } // before the range
];
const orgs = {
  pantry: { name: "Common Table Pantry", verified: true },
  literacy: { name: "Westside Literacy Project", verified: true },
  garden: { name: "Neighborhood Garden Collective", verified: false }
};

describe("summarizeEvidence (SPEC#fn-issueletter, G19)", () => {
  it("counts verified, in-range hours and reports what was excluded", () => {
    const summary = summarizeEvidence({ logs, orgs, fromMs: FROM, toExclusiveMs: TO_EXCLUSIVE, onlyOrgId: null });
    expect(summary.logIds).toEqual(["a", "b", "c"]);
    expect(summary.totalMinutes).toBe(1095);
    expect(summary.excludedUnverifiedMinutes).toBe(180);
    expect(summary.excludedUnverifiedCount).toBe(2);
    expect(summary.orgIds).toEqual(["pantry", "literacy"]);
    expect(summary.perOrg).toEqual([
      { orgId: "pantry", orgName: "Common Table Pantry", verified: true, minutes: 735 },
      { orgId: "literacy", orgName: "Westside Literacy Project", verified: true, minutes: 360 },
      { orgId: "garden", orgName: "Neighborhood Garden Collective", verified: false, minutes: 120 },
      { orgId: "ghost", orgName: UNKNOWN_ORG_NAME, verified: false, minutes: 60 }
    ]);
  });

  it("limits to one org when scoped and breaks minute ties by name", () => {
    const scoped = summarizeEvidence({ logs, orgs, fromMs: FROM, toExclusiveMs: TO_EXCLUSIVE, onlyOrgId: "literacy" });
    expect(scoped.logIds).toEqual(["c"]);
    const tied = summarizeEvidence({
      logs: [
        { id: "x", orgId: "literacy", minutes: 60, dateMs: FROM },
        { id: "y", orgId: "pantry", minutes: 60, dateMs: FROM }
      ],
      orgs,
      fromMs: FROM,
      toExclusiveMs: TO_EXCLUSIVE,
      onlyOrgId: null
    });
    expect(tied.perOrg.map((row) => row.orgId)).toEqual(["pantry", "literacy"]);
  });

  it("returns zero totals when nothing qualifies", () => {
    const empty = summarizeEvidence({ logs: [], orgs, fromMs: FROM, toExclusiveMs: TO_EXCLUSIVE, onlyOrgId: null });
    expect(empty).toEqual({ logIds: [], perOrg: [], orgIds: [], totalMinutes: 0, excludedUnverifiedMinutes: 0, excludedUnverifiedCount: 0 });
  });
});

describe("verify codes (SPEC#letters)", () => {
  it("base32-encodes per RFC 4648 test vectors", () => {
    const encode = (text: string) => base32Encode(Uint8Array.from(text, (char) => char.charCodeAt(0)));
    expect(encode("")).toBe("");
    expect(encode("f")).toBe("MY");
    expect(encode("fo")).toBe("MZXQ");
    expect(encode("foo")).toBe("MZXW6");
    expect(encode("foob")).toBe("MZXW6YQ");
    expect(encode("fooba")).toBe("MZXW6YTB");
    expect(encode("foobar")).toBe("MZXW6YTBOI");
  });

  it("turns 16 random bytes into a 26-character code", () => {
    const code = base32Encode(new Uint8Array(16).fill(255));
    expect(code).toHaveLength(26);
    expect(VERIFY_CODE_PATTERN.test(code)).toBe(true);
  });

  it("normalizes typed codes and groups them for print", () => {
    expect(normalizeVerifyCode(" abcd-efgh ijkl ")).toBe("ABCDEFGHIJKL");
    expect(formatVerifyCode("ABCDEFGHIJ")).toBe("ABCD-EFGH-IJ");
    expect(formatVerifyCode("")).toBe("");
  });
});

describe("ids and names (SPEC#data-model)", () => {
  it("builds deterministic ids and scope keys", () => {
    expect(signupIdFor("inst1", "uid9")).toBe("inst1_uid9");
    expect(scopeKeyFor({ orgId: ALL_ORGS, from: "2026-08-01", to: "2026-10-15" })).toBe("ALL:2026-08-01:2026-10-15");
  });

  it("derives first name + last initial for public projections", () => {
    expect(displayNameFor(" Jordan ", "rivera")).toBe("Jordan R.");
    expect(displayNameFor("Sam", "  ")).toBe("Sam");
    expect(fullNameFor(" Jordan", "Rivera ")).toBe("Jordan Rivera");
  });

  it("builds document paths", () => {
    expect(COLLECTIONS.signups).toBe("signups");
    expect(PATHS.member("o1", "u1")).toBe("organizations/o1/members/u1");
    expect(PATHS.letterRef("o1", "l1")).toBe("organizations/o1/letterRefs/l1");
    expect(PATHS.privateProfile("u1")).toBe("users/u1/private/profile");
    expect(PATHS.rateLimit("u1", "checkin")).toBe("rateLimits/u1_checkin");
    expect(PATHS.runDueJobsLease()).toBe("jobLeases/runDueJobs");
    expect(PATHS.demoClock()).toBe("demoClock/global");
    expect(PATHS.letterPdf("u1", "l1")).toBe("letters/u1/l1.pdf");
  });
});
