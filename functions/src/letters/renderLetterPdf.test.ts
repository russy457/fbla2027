/**
 * renderLetterPdf.test.ts
 * The letter PDF renders to a real one-page PDF (SPEC#letters 8.2), including
 * a long organization list that collapses into "and N more", and the ported
 * color helpers behave as before. Also checks letter id determinism.
 */
import { describe, expect, it } from "vitest";
import { hexToRgb, mixHexColor, normalizeHexColor } from "../reports/pdf/helpers/colorUtils";
import { letterIdFor, newVerifyCode } from "./letterIds";
import { renderLetterPdf, type LetterPdfInput } from "./renderLetterPdf";

const baseInput: LetterPdfInput = {
  fullName: "Jordan Rivera",
  issuedAtLabel: "Oct 17, 2026",
  verifyCode: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  verifyUrl: "http://localhost:5173/verify/ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  from: "2026-08-01",
  to: "2026-10-15",
  rows: [
    { orgId: "a", orgName: "Common Table Pantry", verified: true, minutes: 735 },
    { orgId: "b", orgName: "Westside Literacy Project", verified: true, minutes: 360 }
  ],
  totalMinutes: 1095,
  excludedUnverifiedMinutes: 0
};

const pageCount = (pdf: Buffer): number => (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

describe("renderLetterPdf", () => {
  it("produces a one-page PDF", async () => {
    const pdf = await renderLetterPdf(baseInput);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(pdf)).toBe(1);
  });

  it("stays on one page with many organizations and excluded hours", async () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({ orgId: `o${index}`, orgName: `Organization number ${index} with a long name`, verified: true, minutes: 60 }));
    const pdf = await renderLetterPdf({ ...baseInput, rows, totalMinutes: 1800, excludedUnverifiedMinutes: 120 });
    expect(pageCount(pdf)).toBe(1);
  });
});

describe("ported color helpers", () => {
  it("normalizes, converts, and mixes hex colors", () => {
    expect(normalizeHexColor("1d4ed8")).toBe("#1D4ED8");
    expect(normalizeHexColor("not a color")).toBe("#2E7D32");
    expect(normalizeHexColor(null, "#000000")).toBe("#000000");
    expect(hexToRgb("#FF8000")).toEqual({ r: 255, g: 128, b: 0 });
    expect(mixHexColor("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mixHexColor("#000000", "#FFFFFF", 2)).toBe("#FFFFFF");
  });
});

describe("letter ids", () => {
  it("letterId is deterministic per uid, scope, and nonce; verify codes are random base32", () => {
    expect(letterIdFor("u1", "ALL:2026-01-01:2026-10-01", "n1")).toBe(letterIdFor("u1", "ALL:2026-01-01:2026-10-01", "n1"));
    expect(letterIdFor("u1", "ALL:2026-01-01:2026-10-01", "n2")).not.toBe(letterIdFor("u1", "ALL:2026-01-01:2026-10-01", "n1"));
    expect(letterIdFor("u1", "k", "n")).toMatch(/^[0-9a-f]{32}$/);
    const code = newVerifyCode();
    expect(code).toMatch(/^[A-Z2-7]{26}$/);
    expect(newVerifyCode()).not.toBe(code);
  });
});
