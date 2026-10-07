/**
 * orgAttendance.ts
 * Organization report "Attendance breakdown" (SPEC 8.6): signup counts by
 * status, in plain words (status is never shown by color alone, D14).
 */
import type { SignupStatus, StatusCount } from "@fbla/shared";
import type { PdfReportBuilder } from "../reportBuilder";

export const SIGNUP_STATUS_TEXT: Readonly<Record<SignupStatus, string>> = {
  confirmed: "Signed up",
  waitlisted: "Waitlisted",
  "checked-in": "Checked in",
  completed: "Completed",
  "no-show": "No-show",
  excused: "Excused",
  cancelled: "Cancelled"
};

export const renderOrgAttendance = (builder: PdfReportBuilder, counts: readonly StatusCount[]): void => {
  builder.beginSection("Attendance breakdown", "Signups for shifts in this range, by their current status.");
  if (counts.every((row) => row.count === 0)) {
    builder.emptyNote();
    return;
  }
  builder.drawTable(
    [
      { header: "Status", width: 0.7 },
      { header: "Signups", width: 0.3, align: "right" }
    ],
    counts.map((row) => [SIGNUP_STATUS_TEXT[row.status], String(row.count)])
  );
};
