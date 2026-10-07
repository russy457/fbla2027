/**
 * SeriesSignupPanel.test.tsx
 * Whole-series signup on the opportunity page (SPEC 9.4): the rule in words,
 * one button for every date, a result list with Signed up / Waitlisted /
 * Skipped chips, "covers through DATE" from the live record, a one-click
 * Extend only when the series has grown past it, sign-in for visitors, and
 * the catalog message on failure.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorFor } from "@/test/apiErrors";
import { ts } from "@/test/fixtures";
import { SeriesSignupPanel } from "./SeriesSignupPanel";

const signupSeries = vi.fn();
const extendSeriesSignup = vi.fn();
const seriesState = { data: null as unknown };
const recordState = { data: null as unknown };

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    api: { volunteer: { signupSeries: (input: unknown) => signupSeries(input), extendSeriesSignup: (input: unknown) => extendSeriesSignup(input) } }
  };
});

vi.mock("@/hooks/useSeries", () => ({
  useSeries: () => ({ data: seriesState.data, error: null, isLoading: false }),
  useMySeriesSignup: () => ({ data: recordState.data, error: null, isLoading: false })
}));

// Shifts exist through Saturday Dec 12, 2026 (materializedThrough = Dec 13 00:00 CST).
const SERIES = {
  id: "s1",
  rule: { frequency: "weekly", weekdays: [6], startTime: "09:00", endTime: "13:00" },
  timeZone: "America/Chicago",
  materializedThrough: ts(Date.UTC(2026, 11, 13, 6, 0, 0))
};

const renderPanel = (uid: string | null = "vol1") =>
  render(
    <MemoryRouter initialEntries={["/opportunity/s1_20261017"]}>
      <Routes>
        <Route path="/opportunity/:id" element={<SeriesSignupPanel seriesId="s1" uid={uid} returnPath="/opportunity/s1_20261017" />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>
  );

describe("SeriesSignupPanel", () => {
  beforeEach(() => {
    signupSeries.mockReset();
    extendSeriesSignup.mockReset();
    seriesState.data = SERIES;
    recordState.data = null;
  });

  it("renders nothing until the series loads", () => {
    seriesState.data = null;
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  it("signs up for every date and lists each outcome", async () => {
    signupSeries.mockResolvedValue({
      coversThrough: "2026-12-12",
      results: [
        { instanceId: "s1_20261017", date: "2026-10-17", outcome: "confirmed" },
        { instanceId: "s1_20261024", date: "2026-10-24", outcome: "waitlisted" },
        { instanceId: "s1_20261031", date: "2026-10-31", outcome: "skipped", reason: "SHIFT_CANCELLED" }
      ]
    });
    renderPanel();
    expect(screen.getByText("Every Saturday, 9:00 AM to 1:00 PM.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign up for the whole series" }));
    expect(signupSeries).toHaveBeenCalledWith({ seriesId: "s1" });
    const list = await screen.findByRole("list", { name: "Series signup results" });
    expect(list).toHaveTextContent("Oct 17, 2026Signed up");
    expect(list).toHaveTextContent("Oct 24, 2026Waitlisted");
    expect(list).toHaveTextContent("Oct 31, 2026Skipped: Cancelled by organization");
  });

  it("shows coverage from the record and offers Extend only for new dates", async () => {
    recordState.data = { coversThrough: "2026-11-28" };
    extendSeriesSignup.mockResolvedValue({ coversThrough: "2026-12-12", results: [] });
    renderPanel();
    expect(screen.getByRole("status")).toHaveTextContent("Series signup covers through Nov 28, 2026.");
    expect(screen.queryByRole("button", { name: "Sign up for the whole series" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Extend through Dec 12, 2026" }));
    expect(extendSeriesSignup).toHaveBeenCalledWith({ seriesId: "s1" });
    expect(await screen.findByText("No new dates to sign up for yet.")).toBeInTheDocument();
  });

  it("has no Extend when coverage already reaches the last date", () => {
    recordState.data = { coversThrough: "2026-12-12" };
    renderPanel();
    expect(screen.queryByRole("button", { name: /Extend/ })).not.toBeInTheDocument();
  });

  it("sends a visitor to sign in first", () => {
    renderPanel(null);
    fireEvent.click(screen.getByRole("button", { name: "Sign in to sign up for the whole series" }));
    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(signupSeries).not.toHaveBeenCalled();
  });

  it("shows the catalog message when the series is gone", async () => {
    signupSeries.mockRejectedValue(apiErrorFor("NOT_FOUND"));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Sign up for the whole series" }));
    expect(await screen.findByText("We couldn't find that.")).toBeInTheDocument();
  });
});
