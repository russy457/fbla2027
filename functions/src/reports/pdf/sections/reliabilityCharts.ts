/**
 * reliabilityCharts.ts
 * Tier 2 lane B reliability charts (SPEC 8.6 "reliability distribution
 * (Tier 2 charts)", SPEC 7.2, D12), drawn server-side with pdfkit through the
 * builder's bar chart. The numbers come from the shared aggregation
 * (shared/src/reliabilityReport.ts), the same rows the on-screen preview
 * charts and their data tables use, so preview and PDF always agree.
 *
 *   renderOrgReliability       org report: volunteers per attendance band
 *                              (counts only, no names; T3)
 *   renderVolunteerTrackRecord volunteer report: attended / no-shows / late
 *                              cancels with the neutral sentence (D12)
 *
 * Every bar prints its value as text, so the chart never relies on color
 * or shape alone, and an empty range prints the standard empty note.
 */
import type { ReliabilityDistribution, TrackRecordReport } from "@fbla/shared";
import type { PdfReportBuilder } from "../reportBuilder";

/** Wide enough for "New (fewer than 3 shifts)" at the chart's 9.5 pt label size. */
const BAND_LABEL_WIDTH = 140;

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

export const renderOrgReliability = (builder: PdfReportBuilder, distribution: ReliabilityDistribution): void => {
  builder.beginSection(
    "Reliability distribution",
    "Volunteers by share of finished shifts attended in this range (late cancels count half). Counts only; no names."
  );
  if (distribution.volunteers === 0) {
    builder.emptyNote("No finished shifts in this range.");
    return;
  }
  builder.drawBarChart(
    distribution.buckets.map((row) => ({ label: row.label, value: row.volunteers, valueLabel: plural(row.volunteers, "volunteer") })),
    BAND_LABEL_WIDTH
  );
  builder.paragraph(`${plural(distribution.volunteers, "volunteer")} finished at least one shift in this range.`);
};

export const renderVolunteerTrackRecord = (builder: PdfReportBuilder, record: TrackRecordReport): void => {
  builder.beginSection("Track record", "Your recent finished shifts in this range. Excused absences and early cancels never count.");
  if (record.total === 0) {
    builder.emptyNote("No finished shifts in this range.");
    return;
  }
  builder.paragraph(record.summary);
  builder.drawBarChart(record.rows.map((row) => ({ label: row.label, value: row.count, valueLabel: plural(row.count, "shift") })));
};
