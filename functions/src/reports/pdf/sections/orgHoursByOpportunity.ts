/**
 * orgHoursByOpportunity.ts
 * Organization report "Hours by opportunity" (SPEC 8.6; reuses the old
 * bizHours table layout): approved hours and entries per opportunity, with
 * manual off-platform entries grouped on their own row.
 */
import type { OpportunityMinutes } from "@fbla/shared";
import type { PdfReportBuilder } from "../reportBuilder";
import { hoursText } from "./format";

export const renderOrgHoursByOpportunity = (builder: PdfReportBuilder, rows: readonly OpportunityMinutes[]): void => {
  builder.beginSection("Hours by opportunity", "Approved hours only.");
  if (rows.length === 0) {
    builder.emptyNote();
    return;
  }
  builder.drawTable(
    [
      { header: "Opportunity", width: 0.6 },
      { header: "Entries", width: 0.2, align: "right" },
      { header: "Hours", width: 0.2, align: "right" }
    ],
    rows.map((row) => [row.title, String(row.logCount), hoursText(row.minutes)])
  );
};
