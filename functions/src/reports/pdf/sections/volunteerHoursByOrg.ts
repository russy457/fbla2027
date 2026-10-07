/**
 * volunteerHoursByOrg.ts
 * Volunteer report "Hours by organization" (SPEC 8.6): approved hours per
 * organization with its verification state in words (never color alone).
 */
import type { OrgMinutes } from "@fbla/shared";
import type { PdfReportBuilder } from "../reportBuilder";
import { hoursText } from "./format";

export const renderVolunteerHoursByOrg = (builder: PdfReportBuilder, rows: readonly OrgMinutes[]): void => {
  builder.beginSection("Hours by organization", "Hours at unverified organizations do not appear on verified letters.");
  if (rows.length === 0) {
    builder.emptyNote();
    return;
  }
  builder.drawTable(
    [
      { header: "Organization", width: 0.6 },
      { header: "Verified", width: 0.2 },
      { header: "Hours", width: 0.2, align: "right" }
    ],
    rows.map((row) => [row.orgName, row.verified ? "Yes" : "No", hoursText(row.minutes)])
  );
};
