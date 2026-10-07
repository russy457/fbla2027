/**
 * JobRunsPanel.test.tsx
 * Admin job health (SPEC 9.2 "Admin", 10.17): last run time (relative and
 * absolute) or "No runs yet", the recent runs list, and Run due jobs now.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ts } from "@/test/fixtures";
import type { JobRun } from "@/lib/data/adminData";
import { JobRunsView, relativeTime } from "./JobRunsPanel";

const runDueJobs = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, api: { admin: { runDueJobs: (input: unknown) => runDueJobs(input) } } };
});

const NOW = Date.UTC(2026, 9, 17, 15);
const run: JobRun = {
  id: "run1",
  trigger: "schedule",
  startedAt: ts(NOW - 4 * 60_000 - 2000),
  finishedAt: ts(NOW - 4 * 60_000),
  processed: { cutoffs: 1, finalized: 2, seriesExtended: 0 },
  more: false,
  errors: [],
  outcome: "ok"
};

describe("relativeTime", () => {
  it("reads naturally", () => {
    expect(relativeTime(NOW - 10_000, NOW)).toBe("just now");
    expect(relativeTime(NOW - 60_000, NOW)).toBe("1 minute ago");
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3 hours ago");
    expect(relativeTime(NOW - 3 * 86_400_000, NOW)).toBe("3 days ago");
  });
});

describe("JobRunsView", () => {
  it("says when nothing ran yet", () => {
    render(<JobRunsView runs={[]} nowMs={NOW} />);
    expect(screen.getByText("No runs yet")).toBeInTheDocument();
  });

  it("shows the last run and lists recent runs", () => {
    render(<JobRunsView runs={[run]} nowMs={NOW} />);
    expect(screen.getByText(/4 minutes ago/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Recent job runs" })).toHaveTextContent("Scheduled: 2 finalized, 1 cutoffs");
  });

  it("runs due jobs on demand", async () => {
    runDueJobs.mockResolvedValue({ runId: "r", outcome: "ok", processed: { cutoffs: 0, finalized: 1, seriesExtended: 0 }, more: false });
    render(<JobRunsView runs={[run]} nowMs={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Run due jobs now" }));
    expect(runDueJobs).toHaveBeenCalledWith({});
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Due jobs ran (ok): 1 finalized, 0 waitlist cutoffs."));
  });
});
