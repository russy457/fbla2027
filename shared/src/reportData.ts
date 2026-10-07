/**
 * reportData.ts
 * Pure aggregation for the two reports (SPEC 8.6). The Functions PDF
 * pipeline and the client builder (preview + CSV export) feed the same rows
 * into these functions, so the numbers in a downloaded PDF, the on-screen
 * preview, and the CSV always agree.
 *
 *   buildOrgReport(input)        organization participation report
 *   buildVolunteerReport(input)  volunteer hours report
 *   reportCsv(columns, rows)     CSV text (RFC 4180 quoting, formula-safe)
 *
 * Only `approved` logs count as hours (SPEC 3.12); pending minutes are shown
 * separately so a coordinator knows what is still waiting for review.
 * Inputs are plain epoch-ms rows, so this file has no Firestore dependency.
 */
import { formatInTimeZone } from "date-fns-tz";
import { MILESTONES } from "./config";
import { minutesToHours, nextMilestone } from "./hours";
import type { HoursSource, HoursStatus, SignupStatus } from "./schemas/common";
import { SIGNUP_STATUSES } from "./schemas/common";
// Tier 2 lane B: reliability charts (SPEC 8.6)
import { reliabilityDistribution, trackRecordFor, type ReliabilityDistribution, type ReliabilityReportSignup, type TrackRecordReport } from "./reliabilityReport";

export interface ReportRange {
  /** Inclusive start instant. */
  readonly fromMs: number;
  /** Exclusive end instant (start of the day after `to`). */
  readonly toExclusiveMs: number;
}

export interface ReportLogRow {
  readonly id: string;
  readonly uid: string;
  readonly orgId: string;
  readonly instanceId: string | null;
  readonly source: HoursSource;
  readonly status: HoursStatus;
  readonly minutes: number;
  readonly dateMs: number;
  /** Shown for manual entries, which have no signup to take a name from. */
  readonly displayName?: string | null;
}

export interface ReportSignupRow {
  readonly id: string;
  readonly uid: string;
  readonly displayName: string;
  readonly instanceId: string;
  readonly opportunityId: string;
  readonly status: SignupStatus;
  readonly startMs: number;
  /** Tier 2 lane B: feeds the reliability distribution; missing means false. */
  readonly lateCancel?: boolean;
}

export interface ReportShiftInfo {
  readonly title: string;
  readonly opportunityId: string;
}

export interface ReportOrgInfo {
  readonly name: string;
  readonly verified: boolean;
}

export interface MonthMinutes {
  /** "YYYY-MM" in the report's time zone. */
  readonly month: string;
  /** "Oct 2026". */
  readonly label: string;
  readonly minutes: number;
}

/** Title used for hours that are not tied to a shift (manual entries). */
export const MANUAL_ENTRY_TITLE = "Manual entries (off-platform)";
export const UNKNOWN_SHIFT_TITLE = "Shift";
export const UNKNOWN_VOLUNTEER_NAME = "Volunteer";
export const TOP_VOLUNTEER_LIMIT = 10;

const inRange = (ms: number, range: ReportRange): boolean => ms >= range.fromMs && ms < range.toExclusiveMs;
const sumMinutes = (logs: readonly ReportLogRow[]): number => logs.reduce((total, log) => total + log.minutes, 0);
const approvedOnly = (logs: readonly ReportLogRow[]): ReportLogRow[] => logs.filter((log) => log.status === "approved");

const monthKey = (ms: number, timeZone: string): string => formatInTimeZone(new Date(ms), timeZone, "yyyy-MM");
const monthLabel = (key: string): string => formatInTimeZone(new Date(`${key}-15T12:00:00Z`), "UTC", "MMM yyyy");

/** Every month touched by the range, oldest first, with the approved minutes dated in it. */
export const hoursByMonth = (logs: readonly ReportLogRow[], range: ReportRange, timeZone: string): MonthMinutes[] => {
  const first = monthKey(range.fromMs, timeZone);
  const last = monthKey(Math.max(range.fromMs, range.toExclusiveMs - 1), timeZone);
  const months: string[] = [];
  let [year, month] = first.split("-").map(Number) as [number, number];
  for (let key = first; key <= last; key = `${year}-${String(month).padStart(2, "0")}`) {
    months.push(key);
    month = month === 12 ? 1 : month + 1;
    year = month === 1 ? year + 1 : year;
  }
  const totals = approvedOnly(logs).reduce<Map<string, number>>((map, log) => {
    const key = monthKey(log.dateMs, timeZone);
    return new Map(map).set(key, (map.get(key) ?? 0) + log.minutes);
  }, new Map());
  return months.map((key) => ({ month: key, label: monthLabel(key), minutes: totals.get(key) ?? 0 }));
};

// ---------- organization participation ----------

export interface OrgReportInput {
  readonly logs: readonly ReportLogRow[];
  readonly signups: readonly ReportSignupRow[];
  readonly shifts: Readonly<Record<string, ReportShiftInfo>>;
  readonly range: ReportRange;
  readonly timeZone: string;
  /** Only this opportunity's shifts (manual entries are then left out), or null for all. */
  readonly opportunityId: string | null;
}

export interface OrgSummary {
  /** Signups that held or hold a seat (everything except waitlisted and cancelled). */
  readonly signups: number;
  readonly completed: number;
  readonly noShows: number;
  /** completed / (completed + no-show), or null when nobody finished a shift yet. */
  readonly attendanceRate: number | null;
  readonly approvedMinutes: number;
  readonly pendingMinutes: number;
  readonly volunteers: number;
  readonly shifts: number;
}

export interface OpportunityMinutes {
  readonly key: string;
  readonly title: string;
  readonly minutes: number;
  readonly logCount: number;
}

export interface StatusCount {
  readonly status: SignupStatus;
  readonly count: number;
}

export interface TopVolunteer {
  readonly uid: string;
  readonly displayName: string;
  readonly minutes: number;
  readonly shifts: number;
}

export interface ReportCsvRow {
  readonly date: string;
  readonly volunteer: string;
  readonly organization: string;
  readonly shift: string;
  readonly status: string;
  readonly minutes: number;
  readonly hours: number;
  readonly source: string;
}

export interface OrgReportData {
  readonly summary: OrgSummary;
  readonly hoursByOpportunity: OpportunityMinutes[];
  readonly hoursByMonth: MonthMinutes[];
  readonly attendance: StatusCount[];
  readonly topVolunteers: TopVolunteer[];
  /** Tier 2 lane B: volunteers per attendance band (SPEC 8.6 reliability distribution). */
  readonly reliability: ReliabilityDistribution;
  readonly rows: ReportCsvRow[];
}

const SEAT_STATUSES: readonly SignupStatus[] = ["confirmed", "checked-in", "completed", "no-show", "excused"];

const shiftTitle = (shifts: OrgReportInput["shifts"], instanceId: string | null): string =>
  instanceId === null ? MANUAL_ENTRY_TITLE : (shifts[instanceId]?.title ?? UNKNOWN_SHIFT_TITLE);

const filterOrgInput = (input: OrgReportInput): { logs: ReportLogRow[]; signups: ReportSignupRow[] } => {
  const matches = (instanceId: string | null): boolean =>
    input.opportunityId === null || (instanceId !== null && input.shifts[instanceId]?.opportunityId === input.opportunityId);
  return {
    logs: input.logs.filter((log) => inRange(log.dateMs, input.range) && matches(log.instanceId)),
    signups: input.signups.filter(
      (signup) => inRange(signup.startMs, input.range) && (input.opportunityId === null || signup.opportunityId === input.opportunityId)
    )
  };
};

const orgSummary = (logs: readonly ReportLogRow[], signups: readonly ReportSignupRow[]): OrgSummary => {
  const count = (status: SignupStatus): number => signups.filter((signup) => signup.status === status).length;
  const completed = count("completed");
  const noShows = count("no-show");
  const approved = approvedOnly(logs);
  return {
    signups: signups.filter((signup) => SEAT_STATUSES.includes(signup.status)).length,
    completed,
    noShows,
    attendanceRate: completed + noShows === 0 ? null : completed / (completed + noShows),
    approvedMinutes: sumMinutes(approved),
    pendingMinutes: sumMinutes(logs.filter((log) => log.status === "pending")),
    volunteers: new Set([...approved.map((log) => log.uid), ...signups.map((signup) => signup.uid)]).size,
    shifts: new Set(signups.map((signup) => signup.instanceId)).size
  };
};

const byOpportunity = (logs: readonly ReportLogRow[], shifts: OrgReportInput["shifts"]): OpportunityMinutes[] => {
  const groups = approvedOnly(logs).reduce<Map<string, OpportunityMinutes>>((map, log) => {
    const key = log.instanceId === null ? "manual" : (shifts[log.instanceId]?.opportunityId ?? `instance:${log.instanceId}`);
    const current = map.get(key) ?? { key, title: shiftTitle(shifts, log.instanceId), minutes: 0, logCount: 0 };
    return new Map(map).set(key, { ...current, minutes: current.minutes + log.minutes, logCount: current.logCount + 1 });
  }, new Map());
  return [...groups.values()].sort((a, b) => b.minutes - a.minutes || a.title.localeCompare(b.title));
};

/** uid -> display name, from signups (and manual logs that carry a name). */
const nameIndex = (logs: readonly ReportLogRow[], signups: readonly ReportSignupRow[]): ReadonlyMap<string, string> =>
  new Map([
    ...logs.flatMap((log): Array<[string, string]> => (log.displayName ? [[log.uid, log.displayName]] : [])),
    ...signups.map((signup): [string, string] => [signup.uid, signup.displayName])
  ]);

const topVolunteers = (logs: readonly ReportLogRow[], names: ReadonlyMap<string, string>): TopVolunteer[] => {
  const totals = approvedOnly(logs).reduce<Map<string, TopVolunteer>>((map, log) => {
    const current = map.get(log.uid) ?? { uid: log.uid, displayName: names.get(log.uid) ?? UNKNOWN_VOLUNTEER_NAME, minutes: 0, shifts: 0 };
    return new Map(map).set(log.uid, {
      ...current,
      minutes: current.minutes + log.minutes,
      shifts: current.shifts + (log.instanceId === null ? 0 : 1)
    });
  }, new Map());
  return [...totals.values()]
    .sort((a, b) => b.minutes - a.minutes || a.displayName.localeCompare(b.displayName))
    .slice(0, TOP_VOLUNTEER_LIMIT);
};

const csvDate = (ms: number, timeZone: string): string => formatInTimeZone(new Date(ms), timeZone, "yyyy-MM-dd");

/** Logs newest first as CSV-ready rows. */
const logRows = (
  logs: readonly ReportLogRow[],
  timeZone: string,
  label: (log: ReportLogRow) => { volunteer: string; organization: string; shift: string }
): ReportCsvRow[] =>
  [...logs]
    .sort((a, b) => b.dateMs - a.dateMs || a.id.localeCompare(b.id))
    .map((log) => ({
      date: csvDate(log.dateMs, timeZone),
      ...label(log),
      status: log.status,
      minutes: log.minutes,
      hours: minutesToHours(log.minutes),
      source: log.source
    }));

export const buildOrgReport = (input: OrgReportInput): OrgReportData => {
  const { logs, signups } = filterOrgInput(input);
  const names = nameIndex(logs, signups);
  return {
    summary: orgSummary(logs, signups),
    hoursByOpportunity: byOpportunity(logs, input.shifts),
    hoursByMonth: hoursByMonth(logs, input.range, input.timeZone),
    attendance: SIGNUP_STATUSES.map((status) => ({ status, count: signups.filter((signup) => signup.status === status).length })),
    topVolunteers: topVolunteers(logs, names),
    reliability: reliabilityDistribution(
      signups.map((signup) => ({ uid: signup.uid, status: signup.status, lateCancel: signup.lateCancel ?? false, startMs: signup.startMs })),
      input.range
    ),
    rows: logRows(logs, input.timeZone, (log) => ({
      volunteer: names.get(log.uid) ?? UNKNOWN_VOLUNTEER_NAME,
      organization: "",
      shift: shiftTitle(input.shifts, log.instanceId)
    }))
  };
};

// ---------- volunteer hours ----------

export interface VolunteerReportInput {
  /** All of the volunteer's logs (any status, any date); the range is applied here. */
  readonly logs: readonly ReportLogRow[];
  readonly orgs: Readonly<Record<string, ReportOrgInfo>>;
  readonly shifts: Readonly<Record<string, ReportShiftInfo>>;
  readonly range: ReportRange;
  readonly timeZone: string;
  /** Tier 2 lane B: the volunteer's own signups, for the track record chart; missing means none. */
  readonly signups?: readonly ReliabilityReportSignup[];
}

export interface VolunteerSummary {
  readonly approvedMinutes: number;
  readonly pendingMinutes: number;
  readonly orgsHelped: number;
  readonly shiftsCompleted: number;
  readonly manualEntries: number;
}

export interface OrgMinutes {
  readonly orgId: string;
  readonly orgName: string;
  readonly verified: boolean;
  readonly minutes: number;
}

export interface ShiftListItem {
  readonly id: string;
  readonly dateMs: number;
  readonly title: string;
  readonly orgName: string;
  readonly minutes: number;
  readonly status: HoursStatus;
}

export interface MilestoneProgress {
  /** Lifetime approved hours (not limited to the range). */
  readonly lifetimeHours: number;
  readonly reached: number[];
  readonly next: number | null;
  readonly hoursToNext: number | null;
}

export interface VolunteerReportData {
  readonly summary: VolunteerSummary;
  readonly hoursByOrg: OrgMinutes[];
  readonly hoursByMonth: MonthMinutes[];
  readonly shiftList: ShiftListItem[];
  readonly milestones: MilestoneProgress;
  /** Tier 2 lane B: attended / no-shows / late cancels in the range (SPEC 7.2, D12). */
  readonly trackRecord: TrackRecordReport;
  readonly rows: ReportCsvRow[];
}

export const UNKNOWN_ORG_LABEL = "Unknown organization";

const orgInfo = (orgs: VolunteerReportInput["orgs"], orgId: string): ReportOrgInfo => orgs[orgId] ?? { name: UNKNOWN_ORG_LABEL, verified: false };

export const milestoneProgress = (lifetimeMinutes: number): MilestoneProgress => {
  const lifetimeHours = minutesToHours(lifetimeMinutes);
  const next = nextMilestone(lifetimeHours);
  return {
    lifetimeHours,
    reached: MILESTONES.filter((milestone) => lifetimeHours >= milestone),
    next,
    hoursToNext: next === null ? null : Math.round((next - lifetimeHours) * 100) / 100
  };
};

export const buildVolunteerReport = (input: VolunteerReportInput): VolunteerReportData => {
  const visible = input.logs.filter((log) => log.status !== "rejected");
  const logs = visible.filter((log) => inRange(log.dateMs, input.range));
  const approved = approvedOnly(logs);
  const perOrg = approved.reduce<Map<string, number>>((map, log) => new Map(map).set(log.orgId, (map.get(log.orgId) ?? 0) + log.minutes), new Map());
  return {
    summary: {
      approvedMinutes: sumMinutes(approved),
      pendingMinutes: sumMinutes(logs.filter((log) => log.status === "pending")),
      orgsHelped: perOrg.size,
      shiftsCompleted: approved.filter((log) => log.instanceId !== null).length,
      manualEntries: approved.filter((log) => log.instanceId === null).length
    },
    hoursByOrg: [...perOrg.entries()]
      .map(([orgId, minutes]) => ({ orgId, orgName: orgInfo(input.orgs, orgId).name, verified: orgInfo(input.orgs, orgId).verified, minutes }))
      .sort((a, b) => b.minutes - a.minutes || a.orgName.localeCompare(b.orgName)),
    hoursByMonth: hoursByMonth(logs, input.range, input.timeZone),
    shiftList: [...logs]
      .sort((a, b) => b.dateMs - a.dateMs || a.id.localeCompare(b.id))
      .map((log) => ({
        id: log.id,
        dateMs: log.dateMs,
        title: shiftTitle(input.shifts, log.instanceId),
        orgName: orgInfo(input.orgs, log.orgId).name,
        minutes: log.minutes,
        status: log.status
      })),
    milestones: milestoneProgress(sumMinutes(approvedOnly(visible))),
    trackRecord: trackRecordFor(input.signups ?? [], input.range),
    rows: logRows(logs, input.timeZone, (log) => ({
      volunteer: "",
      organization: orgInfo(input.orgs, log.orgId).name,
      shift: shiftTitle(input.shifts, log.instanceId)
    }))
  };
};

// ---------- CSV ----------

export const ORG_CSV_COLUMNS = ["date", "volunteer", "shift", "status", "minutes", "hours", "source"] as const;
export const VOLUNTEER_CSV_COLUMNS = ["date", "organization", "shift", "status", "minutes", "hours", "source"] as const;
export type CsvColumn = keyof ReportCsvRow;

export const CSV_COLUMN_LABELS: Readonly<Record<CsvColumn, string>> = {
  date: "Date",
  volunteer: "Volunteer",
  organization: "Organization",
  shift: "Shift",
  status: "Status",
  minutes: "Minutes",
  hours: "Hours",
  source: "Source"
};

/**
 * One CSV cell. Quotes when needed (RFC 4180) and neutralizes values a
 * spreadsheet would run as a formula (leading = + - @, tab, or CR) by
 * prefixing an apostrophe, since names come from other people.
 */
export const csvCell = (value: string | number): string => {
  const text = typeof value === "number" ? String(value) : /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV text with a header row, CRLF line endings, and only the chosen columns. */
export const reportCsv = (columns: readonly CsvColumn[], rows: readonly ReportCsvRow[]): string =>
  [columns.map((column) => csvCell(CSV_COLUMN_LABELS[column])).join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join(
    "\r\n"
  );
