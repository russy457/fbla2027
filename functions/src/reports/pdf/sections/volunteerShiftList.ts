/**
 * volunteerShiftList.ts
 * Volunteer report "Shift list" (SPEC 8.6): every approved or pending entry in
 * the range, newest first, with its status in words.
 */
import { formatLongDate, type ShiftListItem } from "@fbla/shared";
import type { PdfReportBuilder } from "../reportBuilder";
import { hoursText } from "./format";

const STATUS_TEXT: Readonly<Record<ShiftListItem["status"], string>> = { approved: "Approved", pending: "Pending", rejected: "Not approved" };

export const renderVolunteerShiftList = (builder: PdfReportBuilder, items: readonly ShiftListItem[], timeZone: string): void => {
  builder.beginSection("Shift list", "Shifts and manual entries in this range.");
  if (items.length === 0) {
    builder.emptyNote();
    return;
  }
  builder.drawTable(
    [
      { header: "Date", width: 0.17 },
      { header: "Shift", width: 0.33 },
      { header: "Organization", width: 0.26 },
      { header: "Status", width: 0.12 },
      { header: "Hours", width: 0.12, align: "right" }
    ],
    items.map((item) => [formatLongDate(new Date(item.dateMs), timeZone), item.title, item.orgName, STATUS_TEXT[item.status], hoursText(item.minutes)])
  );
};
