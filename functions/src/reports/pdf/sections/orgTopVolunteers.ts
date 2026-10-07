/**
 * orgTopVolunteers.ts
 * Organization report "Top volunteers" (SPEC 8.6): up to ten volunteers by
 * approved hours. Display names only (first name + last initial), never
 * contact details or ages (SPEC Appendix B item 26).
 */
import type { TopVolunteer } from "@fbla/shared";
import type { PdfReportBuilder } from "../reportBuilder";
import { hoursText } from "./format";

export const renderOrgTopVolunteers = (builder: PdfReportBuilder, rows: readonly TopVolunteer[]): void => {
  builder.beginSection("Top volunteers", "By approved hours in this range.");
  if (rows.length === 0) {
    builder.emptyNote();
    return;
  }
  builder.drawTable(
    [
      { header: "#", width: 0.08 },
      { header: "Volunteer", width: 0.52 },
      { header: "Shifts", width: 0.2, align: "right" },
      { header: "Hours", width: 0.2, align: "right" }
    ],
    rows.map((row, index) => [String(index + 1), row.displayName, String(row.shifts), hoursText(row.minutes)])
  );
};
