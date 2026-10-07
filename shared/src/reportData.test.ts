/**
 * reportData.test.ts
 * Report aggregation shared by the PDF and the client preview/CSV (SPEC 8.6):
 * month buckets (year boundary, DST, empty range), the org participation
 * report (opportunity filter, attendance rate, top volunteers), the volunteer
 * hours report (rejected logs, unknown orgs, milestones), and CSV output.
 */
import { describe, expect, it } from "vitest";
import {
  MANUAL_ENTRY_TITLE,
  ORG_CSV_COLUMNS,
  TOP_VOLUNTEER_LIMIT,
  UNKNOWN_ORG_LABEL,
  UNKNOWN_SHIFT_TITLE,
  UNKNOWN_VOLUNTEER_NAME,
  VOLUNTEER_CSV_COLUMNS,
  buildOrgReport,
  buildVolunteerReport,
  csvCell,
  hoursByMonth,
  milestoneProgress,
  reportCsv,
  type ReportLogRow,
  type ReportSignupRow
} from "./reportData";

const TZ = "America/Chicago";
const DAY = 86_400_000;
/** Midnight CDT, Sep 1 2026. */
const SEP1 = Date.UTC(2026, 8, 1, 5);
const range = { fromMs: SEP1, toExclusiveMs: SEP1 + 61 * DAY };

const log = (id: string, extra: Partial<ReportLogRow> = {}): ReportLogRow => ({
  id,
  uid: "u1",
  orgId: "orgA",
  instanceId: "i1",
  source: "kiosk",
  status: "approved",
  minutes: 60,
  dateMs: SEP1 + DAY,
  ...extra
});

const signup = (id: string, extra: Partial<ReportSignupRow> = {}): ReportSignupRow => ({
  id,
  uid: "u1",
  displayName: "Jordan R.",
  instanceId: "i1",
  opportunityId: "oppA",
  status: "completed",
  startMs: SEP1 + DAY,
  ...extra
});

const shifts = { i1: { title: "Sort food", opportunityId: "oppA" }, i2: { title: "Pack boxes", opportunityId: "oppB" } };

describe("hoursByMonth", () => {
  it("buckets approved minutes by local month across a year boundary", () => {
    const winter = { fromMs: Date.UTC(2026, 10, 15, 6), toExclusiveMs: Date.UTC(2027, 1, 2, 6) };
    const logs = [
      log("a", { dateMs: Date.UTC(2026, 11, 31, 12) }),
      log("b", { dateMs: Date.UTC(2027, 0, 1, 5, 30) }), // Dec 31, 11:30 PM CST
      log("c", { dateMs: Date.UTC(2027, 0, 10), status: "pending" })
    ];
    expect(hoursByMonth(logs, winter, TZ)).toEqual([
      { month: "2026-11", label: "Nov 2026", minutes: 0 },
      { month: "2026-12", label: "Dec 2026", minutes: 120 },
      { month: "2027-01", label: "Jan 2027", minutes: 0 },
      { month: "2027-02", label: "Feb 2027", minutes: 0 }
    ]);
  });

  it("handles an empty range and a DST change inside the month", () => {
    expect(hoursByMonth([], { fromMs: SEP1, toExclusiveMs: SEP1 }, TZ)).toEqual([{ month: "2026-09", label: "Sep 2026", minutes: 0 }]);
    const november = { fromMs: Date.UTC(2026, 10, 1, 5), toExclusiveMs: Date.UTC(2026, 11, 1, 6) };
    expect(hoursByMonth([log("d", { dateMs: Date.UTC(2026, 10, 1, 8) })], november, TZ)).toEqual([{ month: "2026-11", label: "Nov 2026", minutes: 60 }]);
  });
});

describe("buildOrgReport", () => {
  const logs = [
    log("l1"),
    log("l2", { uid: "u2", instanceId: "i2", minutes: 120 }),
    log("l3", { uid: "u3", instanceId: null, source: "manual", displayName: "Maria G.", minutes: 30 }),
    log("l4", { uid: "u4", instanceId: "gone", minutes: 15 }),
    log("l5", { status: "pending", minutes: 45 }),
    log("l6", { dateMs: SEP1 - DAY }) // out of range
  ];
  const signups = [
    signup("s1"),
    signup("s2", { uid: "u2", displayName: "Ben B.", instanceId: "i2", opportunityId: "oppB", status: "no-show" }),
    signup("s3", { uid: "u5", displayName: "Wait L.", status: "waitlisted" }),
    signup("s4", { startMs: SEP1 + 90 * DAY })
  ];

  it("summarizes signups, attendance, hours, opportunities, and names", () => {
    const report = buildOrgReport({ logs, signups, shifts, range, timeZone: TZ, opportunityId: null });
    expect(report.summary).toEqual({ signups: 2, completed: 1, noShows: 1, attendanceRate: 0.5, approvedMinutes: 225, pendingMinutes: 45, volunteers: 5, shifts: 2 });
    expect(report.hoursByOpportunity).toEqual([
      { key: "oppB", title: "Pack boxes", minutes: 120, logCount: 1 },
      { key: "oppA", title: "Sort food", minutes: 60, logCount: 1 },
      { key: "manual", title: MANUAL_ENTRY_TITLE, minutes: 30, logCount: 1 },
      { key: "instance:gone", title: UNKNOWN_SHIFT_TITLE, minutes: 15, logCount: 1 }
    ]);
    expect(report.topVolunteers.map((row) => [row.displayName, row.minutes, row.shifts])).toEqual([
      ["Ben B.", 120, 1],
      ["Jordan R.", 60, 1],
      ["Maria G.", 30, 0],
      [UNKNOWN_VOLUNTEER_NAME, 15, 1]
    ]);
    expect(report.attendance.find((row) => row.status === "waitlisted")?.count).toBe(1);
    expect(report.rows.map((row) => row.volunteer)).toContain("Maria G.");
  });

  it("filters to one opportunity, leaving out manual entries and unknown shifts", () => {
    const report = buildOrgReport({ logs, signups, shifts, range, timeZone: TZ, opportunityId: "oppA" });
    expect(report.summary).toMatchObject({ approvedMinutes: 60, pendingMinutes: 45, completed: 1, noShows: 0, attendanceRate: 1 });
    expect(report.hoursByOpportunity).toEqual([{ key: "oppA", title: "Sort food", minutes: 60, logCount: 1 }]);
  });

  it("reports a null attendance rate with no finished shifts, groups repeats, and caps top volunteers", () => {
    const many = Array.from({ length: TOP_VOLUNTEER_LIMIT + 2 }, (_, index) => log(`m${index}`, { uid: `v${index}`, displayName: `V${String(index).padStart(2, "0")}`, instanceId: null }));
    const report = buildOrgReport({ logs: [...many, log("x1"), log("x2")], signups: [], shifts, range, timeZone: TZ, opportunityId: null });
    expect(report.summary.attendanceRate).toBeNull();
    expect(report.topVolunteers).toHaveLength(TOP_VOLUNTEER_LIMIT);
    expect(report.topVolunteers[0]).toMatchObject({ uid: "u1", minutes: 120, shifts: 2 });
    expect(report.topVolunteers[1]?.displayName).toBe("V00"); // ties sort by name
    expect(report.hoursByOpportunity.find((row) => row.key === "manual")?.logCount).toBe(TOP_VOLUNTEER_LIMIT + 2);
    expect(report.rows.map((row) => row.date)).toEqual(Array(report.rows.length).fill("2026-09-02"));
  });

  it("breaks hours ties by title and row ties by id", () => {
    const tie = [log("b", { instanceId: "i2" }), log("a")];
    const report = buildOrgReport({ logs: tie, signups: [], shifts, range, timeZone: TZ, opportunityId: null });
    expect(report.hoursByOpportunity.map((row) => row.title)).toEqual(["Pack boxes", "Sort food"]);
    expect(report.rows.map((row) => row.shift)).toEqual(["Sort food", "Pack boxes"]);
  });
});

describe("buildVolunteerReport", () => {
  const orgs = { orgA: { name: "Alamo", verified: true }, orgB: { name: "Bexar", verified: false } };

  it("aggregates the range, ignores rejected logs, and names unknown orgs", () => {
    const logs = [
      log("a", { minutes: 120 }),
      log("b", { orgId: "orgB", instanceId: null, source: "manual", minutes: 60, dateMs: SEP1 + 2 * DAY }),
      log("c", { orgId: "ghost", instanceId: "i2", minutes: 60 }),
      log("d", { status: "pending", minutes: 30 }),
      log("e", { status: "rejected", minutes: 600 }),
      log("f", { minutes: 1500, dateMs: SEP1 - 5 * DAY }) // before the range: lifetime only
    ];
    const report = buildVolunteerReport({ logs, orgs, shifts, range, timeZone: TZ });
    expect(report.summary).toEqual({ approvedMinutes: 240, pendingMinutes: 30, orgsHelped: 3, shiftsCompleted: 2, manualEntries: 1 });
    expect(report.hoursByOrg).toEqual([
      { orgId: "orgA", orgName: "Alamo", verified: true, minutes: 120 },
      { orgId: "orgB", orgName: "Bexar", verified: false, minutes: 60 },
      { orgId: "ghost", orgName: UNKNOWN_ORG_LABEL, verified: false, minutes: 60 }
    ]);
    expect(report.shiftList.map((item) => item.id)).toEqual(["b", "a", "c", "d"]);
    expect(report.shiftList[0]).toMatchObject({ title: MANUAL_ENTRY_TITLE, orgName: "Bexar" });
    expect(report.milestones).toEqual({ lifetimeHours: 29, reached: [25], next: 50, hoursToNext: 21 });
    expect(report.rows[0]).toMatchObject({ organization: "Bexar", volunteer: "", hours: 1 });
  });

  it("reports progress before and after every milestone", () => {
    expect(milestoneProgress(0)).toEqual({ lifetimeHours: 0, reached: [], next: 25, hoursToNext: 25 });
    expect(milestoneProgress(100 * 60)).toEqual({ lifetimeHours: 100, reached: [25, 50, 100], next: null, hoursToNext: null });
  });
});

describe("CSV", () => {
  it("quotes, neutralizes formulas, and keeps numbers", () => {
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('Say "hi", ok')).toBe('"Say ""hi"", ok"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });

  it("writes a header and the chosen columns with CRLF line endings", () => {
    const row = { date: "2026-09-02", volunteer: "Jordan R.", organization: "Alamo", shift: "Sort, food", status: "approved", minutes: 60, hours: 1, source: "kiosk" };
    expect(reportCsv(["date", "shift", "hours"], [row])).toBe('Date,Shift,Hours\r\n2026-09-02,"Sort, food",1');
    expect(reportCsv(ORG_CSV_COLUMNS, [])).toBe("Date,Volunteer,Shift,Status,Minutes,Hours,Source");
    expect(reportCsv(VOLUNTEER_CSV_COLUMNS, [row]).split("\r\n")).toHaveLength(2);
  });
});
