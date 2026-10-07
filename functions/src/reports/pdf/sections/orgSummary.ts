/**
 * orgSummary.ts
 * Organization participation report "Summary" (SPEC 8.6; rewrite of the old
 * bizPerformance section): signups, attendance rate = completed /
 * (completed + no-show), total approved hours, volunteers, and shifts.
 */
import type { OrgSummary } from "@fbla/shared";
import type { PdfReportBuilder } from "../reportBuilder";
import { hoursText, percentText } from "./format";

export const renderOrgSummary = (builder: PdfReportBuilder, summary: OrgSummary): void => {
  builder.beginSection("Summary", "Attendance rate is completed shifts divided by completed shifts plus no-shows.");
  builder.drawStatGrid(
    [
      { label: "Signups", value: String(summary.signups), note: `${summary.shifts} shifts` },
      { label: "Attendance rate", value: percentText(summary.attendanceRate), note: `${summary.completed} completed, ${summary.noShows} no-shows` },
      { label: "Approved hours", value: hoursText(summary.approvedMinutes), note: `${hoursText(summary.pendingMinutes)} hours pending review` },
      { label: "Volunteers", value: String(summary.volunteers) }
    ],
    2
  );
};
