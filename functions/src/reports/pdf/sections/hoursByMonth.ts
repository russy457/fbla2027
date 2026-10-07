/**
 * hoursByMonth.ts
 * "Hours by month" section, shared by both reports (SPEC 8.6): a server-side
 * bar chart of approved hours per month with the value printed beside each bar.
 */
import type { MonthMinutes } from "@fbla/shared";
import type { PdfReportBuilder } from "../reportBuilder";
import { hoursText } from "./format";

export const renderHoursByMonth = (builder: PdfReportBuilder, months: readonly MonthMinutes[]): void => {
  builder.beginSection("Hours by month", "Approved hours, by the month of the shift or service date.");
  if (months.every((month) => month.minutes === 0)) {
    builder.emptyNote();
    return;
  }
  builder.drawBarChart(months.map((month) => ({ label: month.label, value: month.minutes, valueLabel: `${hoursText(month.minutes)} h` })));
};
