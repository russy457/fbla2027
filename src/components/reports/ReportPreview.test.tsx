/**
 * ReportPreview.test.tsx
 * The preview shows the same aggregated numbers the PDF prints (SPEC 8.6),
 * only for the selected sections, with empty sections saying so.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildOrgReport, buildVolunteerReport, type ReportLogRow } from "@fbla/shared";
import { ReportPreview } from "./ReportPreview";

const TZ = "America/Chicago";
const SEP1 = Date.UTC(2026, 8, 1, 5);
const range = { fromMs: SEP1, toExclusiveMs: SEP1 + 30 * 86_400_000 };
const log = (id: string, uid: string, minutes: number): ReportLogRow => ({
  id,
  uid,
  orgId: "orgA",
  instanceId: "i1",
  source: "kiosk",
  status: "approved",
  minutes,
  dateMs: SEP1 + 86_400_000
});
const shifts = { i1: { title: "Sort food", opportunityId: "oppA" } };

describe("ReportPreview", () => {
  it("renders org summary numbers and top volunteers", () => {
    const data = buildOrgReport({
      logs: [log("a", "u1", 120), log("b", "u2", 90)],
      signups: [
        { id: "s1", uid: "u1", displayName: "Jordan R.", instanceId: "i1", opportunityId: "oppA", status: "completed", startMs: SEP1 + 86_400_000 },
        { id: "s2", uid: "u2", displayName: "Sam L.", instanceId: "i1", opportunityId: "oppA", status: "no-show", startMs: SEP1 + 86_400_000 }
      ],
      shifts,
      range,
      timeZone: TZ,
      opportunityId: null
    });
    render(<ReportPreview preview={{ kind: "org-participation", data }} sections={["summary", "topVolunteers"]} from="2026-09-01" to="2026-09-30" />);
    const summary = screen.getByRole("region", { name: "Summary" });
    expect(within(summary).getByText("50%")).toBeInTheDocument();
    expect(within(summary).getByText("3.50")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Jordan R." })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Hours by month" })).not.toBeInTheDocument();
  });

  it("renders volunteer sections and empty notes", () => {
    const data = buildVolunteerReport({ logs: [log("a", "u1", 120)], orgs: { orgA: { name: "Common Table", verified: true } }, shifts, range, timeZone: TZ });
    render(<ReportPreview preview={{ kind: "volunteer-hours", data }} sections={["hoursByOrg", "hoursByMonth", "milestones"]} from="2026-09-01" to="2026-09-30" />);
    expect(screen.getByRole("cell", { name: "Common Table" })).toBeInTheDocument();
    expect(screen.getByText("2.00 h")).toBeInTheDocument();
    expect(screen.getByText(/2\.00 lifetime hours/)).toBeInTheDocument();
  });

  it("says when a section has no data", () => {
    const data = buildVolunteerReport({ logs: [], orgs: {}, shifts, range, timeZone: TZ });
    render(<ReportPreview preview={{ kind: "volunteer-hours", data }} sections={["shiftList"]} from="2026-09-01" to="2026-09-30" />);
    expect(screen.getByText("No data in this range.")).toBeInTheDocument();
  });
});
