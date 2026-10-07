/**
 * OpportunityPage.test.tsx
 * /opportunity/:instanceId (SPEC#screen-inventory "Opportunity", D1): date,
 * time with zone, place, and seats come first, then the D5 signup button,
 * the description, and the organization with the Unverified chip. A
 * signed-out visitor's Sign up returns to this page after sign-in; an
 * unknown id shows a not-found state with a way back to Explore.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Instance } from "@/lib/data/instances";
import { SHIFT_START_MS, makeInstance } from "@/test/fixtures";
import OpportunityPage from "./OpportunityPage";

const state = vi.hoisted(() => ({
  instance: null as Instance | null,
  instanceLoading: false,
  description: "Help sort donated groceries and pack family food boxes." as string | null,
  signedIn: false
}));

vi.mock("@/hooks/useShiftData", () => ({
  useInstance: () => ({ data: state.instance, error: null, isLoading: state.instanceLoading })
}));
vi.mock("@/hooks/useOpportunity", () => ({
  useOpportunity: () => ({
    data:
      state.description === null
        ? null
        : { description: state.description, location: { address: { line1: "418 Mission Commons Dr", city: "San Antonio", state: "TX", zip: "78204" }, geo: null } },
    isLoading: false
  })
}));
vi.mock("@/hooks/useVolunteerData", () => ({
  useMySignups: () => ({ data: [], error: null, isLoading: false }),
  usePrivateProfile: () => ({ data: null, error: null, isLoading: false })
}));
vi.mock("@/store/authStore", () => ({ useSessionUser: () => (state.signedIn ? { uid: "uid-1" } : null) }));
vi.mock("@/hooks/useNow", () => ({ useNow: () => SHIFT_START_MS - 3 * 60 * 60 * 1000 }));
vi.mock("@/lib/api", () => ({ api: {}, ApiError: class ApiError extends Error {} }));

const LoginProbe = () => {
  const location = useLocation();
  return <p>{`login ${location.search}`}</p>;
};

const renderAt = (instanceId: string) =>
  render(
    <MemoryRouter initialEntries={[`/opportunity/${instanceId}`]}>
      <Routes>
        <Route path="/opportunity/:instanceId" element={<OpportunityPage />} />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>
  );

describe("OpportunityPage", () => {
  beforeEach(() => {
    state.instance = makeInstance({ id: "demo-shift", capacity: 3, signupCount: 2 });
    state.instanceLoading = false;
    state.description = "Help sort donated groceries and pack family food boxes.";
    state.signedIn = false;
  });

  it("shows date, time with zone, place, and seats, then the signup button, description, and org", () => {
    renderAt("demo-shift");
    expect(screen.getByRole("heading", { level: 1, name: "Sort and pack food boxes" })).toBeInTheDocument();
    expect(screen.getByText("Saturday, October 17, 2026")).toBeInTheDocument();
    expect(screen.getByText("9:00 AM to 11:00 AM CDT")).toBeInTheDocument();
    expect(screen.getByText("418 Mission Commons Dr, San Antonio, TX 78204")).toBeInTheDocument();
    expect(screen.getByText("1 seat left of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up: Sort and pack food boxes" })).toBeEnabled();
    expect(screen.getByText("Help sort donated groceries and pack family food boxes.")).toBeInTheDocument();
    expect(screen.getByText("Alamo Community Pantry")).toBeInTheDocument();
    expect(screen.queryByText("Unverified")).not.toBeInTheDocument();
  });

  it("marks an unverified organization and shows Full when no seat is left after cutoff", () => {
    state.instance = makeInstance({ id: "x", orgVerified: false, capacity: 2, signupCount: 2, cutoffAt: makeInstance().start });
    renderAt("x");
    expect(screen.getByText("Unverified")).toBeInTheDocument();
    expect(screen.getByText("No seats left of 2")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to sign in and back to this page", () => {
    renderAt("demo-shift");
    fireEvent.click(screen.getByRole("button", { name: "Sign up: Sort and pack food boxes" }));
    expect(screen.getByText(/^login /)).toHaveTextContent(encodeURIComponent("/opportunity/demo-shift"));
  });

  it("shows a not-found state for an unknown shift", () => {
    state.instance = null;
    renderAt("nope");
    expect(screen.getByRole("heading", { level: 1, name: "Shift not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find shifts" })).toHaveAttribute("href", "/explore");
  });
});
