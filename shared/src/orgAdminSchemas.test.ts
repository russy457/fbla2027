/**
 * orgAdminSchemas.test.ts
 * Tier 1 lane B schemas and helpers (SPEC 5.2): organization ops (EIN,
 * time zone, website, cause areas, patch rules), opportunity and instance
 * inputs (virtual location rule, ISO instants), hours ops (15-minute steps,
 * bulk limits), report inputs (ordered range, distinct sections), invite
 * code normalization, and the Tier 1 document schemas.
 */
import { describe, expect, it } from "vitest";
import {
  EIN_PATTERN,
  PATHS,
  INVITE_CODE_PATTERN,
  approveHoursInput,
  formatInviteCode,
  generateOrgReportInput,
  generateVolunteerReportInput,
  inviteDocSchema,
  isHttpUrl,
  isValidTimeZone,
  normalizeInviteCode,
  orgPatchSchema,
  registerOrganizationInput,
  reportDocSchema,
  setAttendanceInput,
  submitManualHoursInput,
  updateOrganizationInput,
  upsertOpportunityInput
} from "./index";

const NONCE = "3b241101-e2bb-4255-8caf-4136c566a962";
const stamp = { toMillis: () => 0, toDate: () => new Date(0) };

const registration = {
  name: "Tool Library",
  mission: "Lends tools.",
  causeAreas: ["community-development"],
  ein: "anything",
  address: { line1: "1 Main", city: "San Antonio", state: "TX", zip: "78205" },
  contactEmail: "a@example.test",
  timeZone: "America/Denver",
  requestNonce: NONCE
};

describe("organization schemas", () => {
  it("accepts a registration and leaves the EIN format to the handler", () => {
    expect(registerOrganizationInput.safeParse(registration).success).toBe(true);
    expect(EIN_PATTERN.test("74-1234567")).toBe(true);
    expect(EIN_PATTERN.test("741234567")).toBe(false);
  });

  it("rejects repeated causes, unknown zones, lowercase states, and non-http websites", () => {
    expect(registerOrganizationInput.safeParse({ ...registration, causeAreas: ["seniors", "seniors"] }).success).toBe(false);
    expect(registerOrganizationInput.safeParse({ ...registration, timeZone: "Nowhere/Land" }).success).toBe(false);
    expect(registerOrganizationInput.safeParse({ ...registration, address: { ...registration.address, state: "tx" } }).success).toBe(false);
    expect(registerOrganizationInput.safeParse({ ...registration, website: "javascript:alert(1)" }).success).toBe(false);
    expect(registerOrganizationInput.safeParse({ ...registration, website: "https://tools.example.org/about" }).success).toBe(true);
  });

  it("validates zones and links directly", () => {
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("EST5EDT")).toBe(false);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isHttpUrl("http://localhost")).toBe(false);
    expect(isHttpUrl("http://example.org:8080/x?y=1")).toBe(true);
  });

  it("patches need at least one editable field and never verified or owner fields", () => {
    expect(orgPatchSchema.safeParse({}).success).toBe(false);
    expect(orgPatchSchema.safeParse({ mission: "x" }).success).toBe(true);
    expect(orgPatchSchema.safeParse({ verified: true }).success).toBe(false);
    expect(updateOrganizationInput.safeParse({ orgId: "o1", action: "archive" }).success).toBe(true);
    expect(updateOrganizationInput.safeParse({ orgId: "o1", action: "delete", patch: { mission: "x" } }).success).toBe(false);
  });
});

describe("opportunity and hours schemas", () => {
  const fields = {
    title: "Garden day",
    description: "",
    causeArea: "environment",
    type: "virtual",
    skills: [],
    minAge: 13,
    location: null
  };

  it("virtual listings have no location; others need one", () => {
    expect(upsertOpportunityInput.safeParse({ orgId: "o1", requestNonce: NONCE, fields }).success).toBe(true);
    expect(upsertOpportunityInput.safeParse({ opportunityId: "p1", fields: { ...fields, type: "one-time" } }).success).toBe(false);
  });

  it("minutes move in 15-minute steps, bulk approvals are distinct and capped", () => {
    expect(setAttendanceInput.safeParse({ signupId: "s", to: "completed", minutes: 45, note: "ok!" }).success).toBe(true);
    expect(setAttendanceInput.safeParse({ signupId: "s", to: "completed", minutes: 50, note: "ok!" }).success).toBe(false);
    expect(submitManualHoursInput.safeParse({ orgId: "o", date: "2026-10-01", minutes: 0, description: "ten chars!!", requestNonce: NONCE }).success).toBe(false);
    expect(approveHoursInput.safeParse({ logIds: ["a", "a"] }).success).toBe(false);
    expect(approveHoursInput.safeParse({ logIds: ["a", "b"] }).success).toBe(true);
  });
});

describe("report inputs", () => {
  const base = { from: "2026-09-01", to: "2026-10-01", themeId: "blue", requestNonce: NONCE };

  it("needs an ordered range and distinct, known sections", () => {
    expect(generateVolunteerReportInput.safeParse({ ...base, sections: ["summary", "milestones"] }).success).toBe(true);
    expect(generateVolunteerReportInput.safeParse({ ...base, sections: ["summary", "summary"] }).success).toBe(false);
    expect(generateVolunteerReportInput.safeParse({ ...base, from: "2026-11-01", sections: ["summary"] }).success).toBe(false);
    expect(generateOrgReportInput.safeParse({ ...base, orgId: "o1", sections: ["attendance"], opportunityId: null }).success).toBe(true);
    expect(generateOrgReportInput.safeParse({ ...base, orgId: "o1", sections: ["milestones"] }).success).toBe(false);
  });
});

describe("invite codes and Tier 1 documents", () => {
  it("normalizes typed codes and formats them for display", () => {
    expect(normalizeInviteCode(" abcde-fghij ")).toBe("ABCDEFGHIJ");
    expect(INVITE_CODE_PATTERN.test("ABCDEFGHIJ")).toBe(true);
    expect(formatInviteCode("ABCDEFGHIJ")).toBe("ABCDE-FGHIJ");
    expect(formatInviteCode("SHORT")).toBe("SHORT");
    expect(PATHS.reportPdf("u1", "r1")).toBe("reports/u1/r1.pdf");
  });

  it("parses invite and report documents", () => {
    expect(inviteDocSchema.safeParse({ orgId: "o", role: "coordinator", createdBy: "u", expiresAt: stamp, redeemedBy: null, redeemedAt: null, createdAt: stamp, updatedAt: stamp }).success).toBe(true);
    const report = {
      ownerUid: "u",
      kind: "org-participation",
      orgId: "o",
      params: { from: "2026-01-01", to: "2026-02-01", sections: ["summary"], themeId: "neutral", opportunityId: null },
      status: "ready",
      pdfPath: "reports/u/r.pdf",
      createdAt: stamp,
      updatedAt: stamp
    };
    expect(reportDocSchema.safeParse(report).success).toBe(true);
    expect(reportDocSchema.safeParse({ ...report, kind: "other" }).success).toBe(false);
  });
});
