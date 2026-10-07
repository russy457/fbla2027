/**
 * reports.test.ts
 * Report vocabulary (SPEC 8.6, D16): section lists per kind, canonical
 * ordering, and the six preset themes passing 4.5:1 contrast both ways.
 */
import { describe, expect, it } from "vitest";
import {
  MIN_TEXT_CONTRAST,
  ORG_REPORT_SECTIONS,
  REPORT_SECTION_LABELS,
  REPORT_THEMES,
  REPORT_THEME_IDS,
  VOLUNTEER_REPORT_SECTIONS,
  contrastRatio,
  orderSections,
  relativeLuminance,
  sectionsFor
} from "./reports";

describe("report sections", () => {
  it("lists sections per kind, each with a label", () => {
    expect(sectionsFor("volunteer-hours")).toBe(VOLUNTEER_REPORT_SECTIONS);
    expect(sectionsFor("org-participation")).toBe(ORG_REPORT_SECTIONS);
    [...VOLUNTEER_REPORT_SECTIONS, ...ORG_REPORT_SECTIONS].forEach((section) => expect(REPORT_SECTION_LABELS[section]).toBeTruthy());
  });

  it("orders requested sections canonically, dropping unknown and duplicate keys", () => {
    expect(orderSections("org-participation", ["topVolunteers", "summary", "summary", "shiftList", "bogus"])).toEqual(["summary", "topVolunteers"]);
    expect(orderSections("volunteer-hours", ["milestones", "hoursByMonth"])).toEqual(["hoursByMonth", "milestones"]);
  });
});

describe("report themes (D16)", () => {
  it.each(REPORT_THEME_IDS)("%s passes 4.5:1 for text on its accent and accent text on white", (id) => {
    const theme = REPORT_THEMES[id];
    expect(theme.id).toBe(id);
    expect(contrastRatio(theme.onAccent, theme.accent)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(theme.accent, "#FFFFFF")).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it("computes WCAG luminance and a symmetric contrast ratio", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#020202")).toBeCloseTo(0.000607, 5); // low-channel branch
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#1D4ED8", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "#1D4ED8"), 10);
  });
});
