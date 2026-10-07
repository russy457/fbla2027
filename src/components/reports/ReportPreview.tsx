/**
 * ReportPreview.tsx
 * On-screen preview of a report (SPEC 8.6; rewrite of the old
 * ReportBuilder/ReportPreview, PORT_LEDGER 6c). It shows the selected
 * sections from the same shared aggregation the PDF uses, so the numbers on
 * screen are the numbers in the download. Hours by month is a list of bars
 * with the value printed as text (charts never rely on shape or color alone).
 */
import type { ReactElement, ReactNode } from "react";
import {
  MILESTONES,
  REPORT_SECTION_LABELS,
  formatYmd,
  minutesToHours,
  type MonthMinutes,
  type OrgReportData,
  type ReportSection,
  type SignupStatus,
  type VolunteerReportData
} from "@fbla/shared";

export type ReportPreviewData =
  | { readonly kind: "org-participation"; readonly data: OrgReportData }
  | { readonly kind: "volunteer-hours"; readonly data: VolunteerReportData };

const STATUS_TEXT: Readonly<Record<SignupStatus, string>> = {
  confirmed: "Signed up",
  waitlisted: "Waitlisted",
  "checked-in": "Checked in",
  completed: "Completed",
  "no-show": "No-show",
  excused: "Excused",
  cancelled: "Cancelled"
};

const hours = (minutes: number): string => minutesToHours(minutes).toFixed(2);
const EMPTY = <p className="text-sm text-fg-muted">No data in this range.</p>;

const Stat = ({ label, value }: { label: string; value: string }): ReactElement => (
  <div className="flex flex-col rounded-md bg-surface-sunken px-3 py-2">
    <dt className="text-xs font-semibold text-fg-muted">{label}</dt>
    <dd className="font-mono text-xl font-semibold text-fg">{value}</dd>
  </div>
);

const Table = ({ caption, headers, rows }: { caption: string; headers: readonly string[]; rows: ReadonlyArray<readonly string[]> }): ReactElement =>
  rows.length === 0 ? (
    EMPTY
  ) : (
    <table className="w-full text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-border-strong text-fg-muted">
          {headers.map((header) => (
            <th key={header} scope="col" className="py-1.5 pr-3 font-semibold">{header}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="py-1.5 pr-3 text-fg">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

const MonthBars = ({ months }: { months: readonly MonthMinutes[] }): ReactElement => {
  if (months.every((month) => month.minutes === 0)) return EMPTY;
  const max = Math.max(...months.map((month) => month.minutes));
  return (
    <ul className="flex flex-col gap-1.5">
      {months.map((month) => (
        <li key={month.month} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2 text-sm">
          <span className="text-fg-muted">{month.label}</span>
          <span aria-hidden="true" className="h-3 rounded-full bg-accent-subtle">
            <span className="block h-3 rounded-full bg-accent" style={{ width: `${(month.minutes / max) * 100}%` }} />
          </span>
          <span className="text-right font-mono text-fg">{hours(month.minutes)} h</span>
        </li>
      ))}
    </ul>
  );
};

const orgSection = (section: ReportSection, data: OrgReportData): ReactNode => {
  switch (section) {
    case "summary":
      return (
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Stat label="Signups" value={String(data.summary.signups)} />
          <Stat label="Attendance rate" value={data.summary.attendanceRate === null ? "Not yet" : `${Math.round(data.summary.attendanceRate * 100)}%`} />
          <Stat label="Approved hours" value={hours(data.summary.approvedMinutes)} />
          <Stat label="Volunteers" value={String(data.summary.volunteers)} />
        </dl>
      );
    case "hoursByOpportunity":
      return <Table caption="Hours by opportunity" headers={["Opportunity", "Entries", "Hours"]} rows={data.hoursByOpportunity.map((row) => [row.title, String(row.logCount), hours(row.minutes)])} />;
    case "hoursByMonth":
      return <MonthBars months={data.hoursByMonth} />;
    case "attendance":
      return data.attendance.every((row) => row.count === 0) ? EMPTY : <Table caption="Attendance breakdown" headers={["Status", "Signups"]} rows={data.attendance.map((row) => [STATUS_TEXT[row.status], String(row.count)])} />;
    case "topVolunteers":
      return <Table caption="Top volunteers" headers={["Volunteer", "Shifts", "Hours"]} rows={data.topVolunteers.map((row) => [row.displayName, String(row.shifts), hours(row.minutes)])} />;
    default:
      return null;
  }
};

const volunteerSection = (section: ReportSection, data: VolunteerReportData): ReactNode => {
  switch (section) {
    case "summary":
      return (
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Stat label="Approved hours" value={hours(data.summary.approvedMinutes)} />
          <Stat label="Organizations" value={String(data.summary.orgsHelped)} />
          <Stat label="Shifts completed" value={String(data.summary.shiftsCompleted)} />
          <Stat label="Pending hours" value={hours(data.summary.pendingMinutes)} />
        </dl>
      );
    case "hoursByOrg":
      return <Table caption="Hours by organization" headers={["Organization", "Verified", "Hours"]} rows={data.hoursByOrg.map((row) => [row.orgName, row.verified ? "Yes" : "No", hours(row.minutes)])} />;
    case "hoursByMonth":
      return <MonthBars months={data.hoursByMonth} />;
    case "shiftList":
      return <Table caption="Shift list" headers={["Shift", "Organization", "Status", "Hours"]} rows={data.shiftList.map((item) => [item.title, item.orgName, item.status, hours(item.minutes)])} />;
    case "milestones":
      return (
        <p className="text-sm text-fg">
          {data.milestones.lifetimeHours.toFixed(2)} lifetime hours. Reached: {data.milestones.reached.length > 0 ? data.milestones.reached.map((m) => `${m}`).join(", ") : "none yet"} of{" "}
          {MILESTONES.join(", ")}.{data.milestones.next === null ? " Every milestone reached." : ` ${data.milestones.hoursToNext?.toFixed(2)} hours to ${data.milestones.next}.`}
        </p>
      );
    default:
      return null;
  }
};

interface ReportPreviewProps {
  readonly preview: ReportPreviewData;
  readonly sections: readonly ReportSection[];
  readonly from: string;
  readonly to: string;
}

export const ReportPreview = ({ preview, sections, from, to }: ReportPreviewProps): ReactElement => (
  <section aria-labelledby="report-preview-title" className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4">
    <header className="flex flex-col gap-1">
      <h2 id="report-preview-title" className="text-lg font-semibold text-fg">Preview</h2>
      <p className="text-sm text-fg-muted">
        {formatYmd(from)} to {formatYmd(to)}. Only approved hours count.
      </p>
    </header>
    {sections.map((section) => (
      <section key={section} aria-label={REPORT_SECTION_LABELS[section]} className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-fg">{REPORT_SECTION_LABELS[section]}</h3>
        {preview.kind === "org-participation" ? orgSection(section, preview.data) : volunteerSection(section, preview.data)}
      </section>
    ))}
  </section>
);
