/**
 * renderReport.test.ts
 * The report PDF renderer (SPEC 8.6): both kinds render with empty and full
 * data, every preset theme renders, and a long table spills onto more pages
 * without failing.
 */
import { describe, expect, it } from "vitest";
import {
  ORG_REPORT_SECTIONS,
  REPORT_THEME_IDS,
  VOLUNTEER_REPORT_SECTIONS,
  buildOrgReport,
  buildVolunteerReport,
  type ReportLogRow,
  type ReportSignupRow
} from "@fbla/shared";
import { renderReport } from "./renderReport";

const TZ = "America/Chicago";
const FROM_MS = Date.UTC(2026, 7, 1, 5);
const range = { fromMs: FROM_MS, toExclusiveMs: Date.UTC(2026, 9, 18, 5) };
const generatedAt = new Date(Date.UTC(2026, 9, 17, 15));

const log = (index: number, extra: Partial<ReportLogRow> = {}): ReportLogRow => ({
  id: `log${index}`,
  uid: `vol${index % 4}`,
  orgId: "orgA",
  instanceId: `inst${index % 3}`,
  source: "kiosk",
  status: "approved",
  minutes: 60 + (index % 4) * 15,
  dateMs: FROM_MS + index * 86_400_000,
  ...extra
});

const signup = (index: number): ReportSignupRow => ({
  id: `s${index}`,
  uid: `vol${index % 4}`,
  displayName: `Volunteer ${index % 4}`,
  instanceId: `inst${index % 3}`,
  opportunityId: `opp${index % 2}`,
  status: index % 5 === 0 ? "no-show" : "completed",
  startMs: FROM_MS + index * 86_400_000
});

const LOGS = Array.from({ length: 60 }, (_, index) => log(index));
const SHIFTS = { inst0: { title: "Sort food", opportunityId: "opp0" }, inst1: { title: "Pack boxes", opportunityId: "opp1" }, inst2: { title: "Greeters", opportunityId: "opp0" } };
const orgData = (empty: boolean) =>
  buildOrgReport({ logs: empty ? [] : LOGS, signups: empty ? [] : LOGS.map((_, index) => signup(index)), shifts: SHIFTS, range, timeZone: TZ, opportunityId: null });
const volunteerData = (empty: boolean) =>
  buildVolunteerReport({ logs: empty ? [] : LOGS, orgs: { orgA: { name: "Alamo Community Pantry", verified: true } }, shifts: SHIFTS, range, timeZone: TZ });

const common = { from: "2026-08-01", to: "2026-10-17", generatedAt, timeZone: TZ };
const isPdf = (bytes: Buffer): boolean => bytes.subarray(0, 5).toString() === "%PDF-";

describe("renderReport", () => {
  it.each([true, false])("renders an org report (empty: %s)", async (empty) => {
    const bytes = await renderReport({ ...common, kind: "org-participation", orgName: "Alamo", opportunityTitle: empty ? "Sort food" : null, data: orgData(empty), sections: [...ORG_REPORT_SECTIONS], themeId: "blue" });
    expect(isPdf(bytes)).toBe(true);
  });

  it.each([true, false])("renders a volunteer report (empty: %s)", async (empty) => {
    const bytes = await renderReport({ ...common, kind: "volunteer-hours", displayName: "Jordan R.", data: volunteerData(empty), sections: [...VOLUNTEER_REPORT_SECTIONS], themeId: "green" });
    expect(isPdf(bytes)).toBe(true);
  });

  it.each(REPORT_THEME_IDS)("renders with the %s theme", async (themeId) => {
    const bytes = await renderReport({ ...common, kind: "volunteer-hours", displayName: "Jordan R.", data: volunteerData(false), sections: ["summary"], themeId });
    expect(isPdf(bytes)).toBe(true);
  });

  it("spills a long table onto a few pages, with footers that never add blank pages", async () => {
    const bytes = await renderReport({ ...common, kind: "volunteer-hours", displayName: "Jordan R.", data: volunteerData(false), sections: [...VOLUNTEER_REPORT_SECTIONS], themeId: "purple" });
    const pages = bytes.toString("latin1").match(/\/Type \/Page\b(?!s)/g)?.length ?? 0;
    expect(pages).toBeGreaterThanOrEqual(2);
    expect(pages).toBeLessThanOrEqual(5);
  });

  it("ignores section keys of the other kind", async () => {
    const bytes = await renderReport({ ...common, kind: "org-participation", orgName: "Alamo", opportunityTitle: null, data: orgData(false), sections: ["shiftList", "summary"], themeId: "neutral" });
    expect(isPdf(bytes)).toBe(true);
  });
});
