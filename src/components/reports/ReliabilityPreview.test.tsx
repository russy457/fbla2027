/**
 * ReliabilityPreview.test.tsx
 * Tier 2 lane B report preview charts (SPEC 8.6, 9.16): the SVG has a title
 * and description, each value is printed as text, the data table holds the
 * same numbers as the shared aggregation, and an empty range says so.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { reliabilityDistribution, trackRecordFor } from "@fbla/shared";
import { OrgReliabilityPreview, TrackRecordPreview } from "./ReliabilityPreview";

const DAY = 86_400_000;
const range = { fromMs: 0, toExclusiveMs: 60 * DAY };
const signup = (uid: string, status: "completed" | "no-show", day: number) => ({ uid, status, lateCancel: false, startMs: day * DAY });
const SIGNUPS = [signup("a", "completed", 1), signup("a", "completed", 2), signup("a", "completed", 3), signup("b", "completed", 4)];

describe("OrgReliabilityPreview", () => {
  it("draws an accessible chart whose table matches the aggregation", () => {
    const distribution = reliabilityDistribution(SIGNUPS, range);
    render(<OrgReliabilityPreview distribution={distribution} />);
    const chart = screen.getByRole("img", { name: /Reliability distribution/ });
    expect(chart).toHaveAccessibleName(expect.stringContaining("New (fewer than 3 shifts): 1 volunteer"));
    expect(within(chart).getAllByText("1 volunteer")).toHaveLength(2);
    const table = screen.getByRole("table", { name: "Reliability distribution" });
    const rows = within(table).getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(rows).toEqual(distribution.buckets.map((bucket) => `${bucket.label}${bucket.volunteers}`));
    expect(screen.getByText(/2 volunteers finished at least one shift/)).toBeInTheDocument();
  });

  it("says when nothing finished in the range", () => {
    render(<OrgReliabilityPreview distribution={reliabilityDistribution([], range)} />);
    expect(screen.getByText("No finished shifts in this range.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("TrackRecordPreview", () => {
  it("shows the neutral sentence and the three counts", () => {
    render(<TrackRecordPreview record={trackRecordFor([...SIGNUPS.filter((row) => row.uid === "a"), signup("a", "no-show", 5)], range)} />);
    expect(screen.getAllByText("Attended 3 of 4 recent shifts")[0]).toBeInTheDocument();
    const chart = screen.getByRole("img", { name: /Track record/ });
    expect(within(chart).getByText("3 shifts")).toBeInTheDocument();
    expect(within(chart).getByText("0 shifts")).toBeInTheDocument();
  });

  it("is empty with no finished shifts", () => {
    render(<TrackRecordPreview record={trackRecordFor([], range)} />);
    expect(screen.getByText("No finished shifts in this range.")).toBeInTheDocument();
  });
});
