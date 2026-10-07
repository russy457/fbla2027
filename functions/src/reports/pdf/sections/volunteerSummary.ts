/**
 * volunteerSummary.ts
 * Volunteer report "Summary" (SPEC 8.6; ported from the old
 * userActivitySummary section): approved hours, organizations helped, shifts
 * completed, and hours still waiting for review.
 */
import type { VolunteerSummary } from "@fbla/shared";
import type { PdfReportBuilder } from "../reportBuilder";
import { hoursText } from "./format";

export const renderVolunteerSummary = (builder: PdfReportBuilder, summary: VolunteerSummary): void => {
  builder.beginSection("Summary", "Only approved hours count. Pending hours are waiting for a coordinator.");
  builder.drawStatGrid(
    [
      { label: "Approved hours", value: hoursText(summary.approvedMinutes) },
      { label: "Organizations helped", value: String(summary.orgsHelped) },
      { label: "Shifts completed", value: String(summary.shiftsCompleted), note: `${summary.manualEntries} manual entries approved` },
      { label: "Hours pending review", value: hoursText(summary.pendingMinutes) }
    ],
    2
  );
};
