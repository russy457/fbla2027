/**
 * reliabilityCharts.test.ts
 * Tier 2 lane B reliability chart sections of the report PDF (SPEC 8.6):
 * the bars drawn are exactly the shared aggregation's rows (so the PDF
 * matches the on-screen preview), empty ranges print the empty note, and
 * full reports with the new sections render as PDFs in every kind.
 */
import { describe, expect, it } from "vitest";
import { buildOrgReport, buildVolunteerReport, type ReportSignupRow } from "@fbla/shared";
import type { BarItem, PdfReportBuilder } from "./pdf/reportBuilder";
import { renderOrgReliability, renderVolunteerTrackRecord } from "./pdf/sections/reliabilityCharts";
import { renderReport } from "./renderReport";

const TZ = "America/Chicago";
const DAY = 86_400_000;
const FROM = Date.UTC(2026, 8, 1, 5);
const range = { fromMs: FROM, toExclusiveMs: FROM + 60 * DAY };

const signup = (uid: string, status: ReportSignupRow["status"], day: number, lateCancel = false): ReportSignupRow & { lateCancel: boolean } => ({
  id: `${uid}_${day}`,
  uid,
  displayName: uid,
  instanceId: `i${day}`,
  opportunityId: "opp",
  status,
  startMs: FROM + day * DAY,
  lateCancel
});

const SIGNUPS = [
  signup("a", "completed", 1),
  signup("a", "completed", 2),
  signup("a", "completed", 3),
  signup("b", "completed", 4),
  signup("b", "no-show", 5),
  signup("b", "no-show", 6),
  signup("c", "completed", 7)
];

interface Recorded {
  readonly bars: BarItem[][];
  readonly text: string[];
  readonly sections: string[];
}

/** A stand-in builder that records what a section draws. */
const recorder = (): { builder: PdfReportBuilder; recorded: Recorded } => {
  const recorded: Recorded = { bars: [], text: [], sections: [] };
  const builder = {
    beginSection: (title: string) => recorded.sections.push(title),
    emptyNote: (text: string) => recorded.text.push(text),
    paragraph: (text: string) => recorded.text.push(text),
    drawBarChart: (items: BarItem[]) => recorded.bars.push(items)
  } as unknown as PdfReportBuilder;
  return { builder, recorded };
};

describe("reliability chart sections", () => {
  it("org: one bar per band with the shared counts", () => {
    const data = buildOrgReport({ logs: [], signups: SIGNUPS, shifts: {}, range, timeZone: TZ, opportunityId: null });
    const { builder, recorded } = recorder();
    renderOrgReliability(builder, data.reliability);
    expect(recorded.sections).toEqual(["Reliability distribution"]);
    expect(recorded.bars[0]?.map((bar) => [bar.label, bar.value, bar.valueLabel])).toEqual(
      data.reliability.buckets.map((row) => [row.label, row.volunteers, `${row.volunteers} volunteer${row.volunteers === 1 ? "" : "s"}`])
    );
    expect(recorded.text).toEqual(["3 volunteers finished at least one shift in this range."]);
  });

  it("volunteer: the D12 sentence and three bars", () => {
    const data = buildVolunteerReport({ logs: [], orgs: {}, shifts: {}, range, timeZone: TZ, signups: SIGNUPS.filter((row) => row.uid === "b") });
    const { builder, recorded } = recorder();
    renderVolunteerTrackRecord(builder, data.trackRecord);
    expect(recorded.text).toEqual(["Attended 1 of 3 recent shifts"]);
    expect(recorded.bars[0]?.map((bar) => bar.valueLabel)).toEqual(["1 shift", "2 shifts", "0 shifts"]);
  });

  it("prints the empty note when nothing finished in the range", () => {
    const org = buildOrgReport({ logs: [], signups: [], shifts: {}, range, timeZone: TZ, opportunityId: null });
    const volunteer = buildVolunteerReport({ logs: [], orgs: {}, shifts: {}, range, timeZone: TZ });
    const { builder, recorded } = recorder();
    renderOrgReliability(builder, org.reliability);
    renderVolunteerTrackRecord(builder, volunteer.trackRecord);
    expect(recorded.bars).toEqual([]);
    expect(recorded.text).toEqual(["No finished shifts in this range.", "No finished shifts in this range."]);
  });

  it("renders full PDFs with the new sections", async () => {
    const common = { from: "2026-09-01", to: "2026-10-30", generatedAt: new Date(Date.UTC(2026, 9, 17, 15)), timeZone: TZ, themeId: "high-contrast" as const };
    const org = await renderReport({
      ...common,
      kind: "org-participation",
      orgName: "Common Table",
      opportunityTitle: null,
      data: buildOrgReport({ logs: [], signups: SIGNUPS, shifts: {}, range, timeZone: TZ, opportunityId: null }),
      sections: ["reliability"]
    });
    const volunteer = await renderReport({
      ...common,
      kind: "volunteer-hours",
      displayName: "Jordan R.",
      data: buildVolunteerReport({ logs: [], orgs: {}, shifts: {}, range, timeZone: TZ, signups: SIGNUPS }),
      sections: ["trackRecord"]
    });
    expect(org.subarray(0, 5).toString()).toBe("%PDF-");
    expect(volunteer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
