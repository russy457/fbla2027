/**
 * OrganizationPage.test.tsx
 * /organizations/:orgId (SPEC#screen-inventory "Organization"): name with the
 * verification chip, mission, upcoming shifts only (not past or cancelled),
 * Open next shift, Save for signed-in visitors, the D6 empty line, the
 * Unverified chip for an unverified org, and a not-found state.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationDoc } from "@fbla/shared";
import type { Instance } from "@/lib/data/instances";
import { SHIFT_START_MS, makeInstance, ts } from "@/test/fixtures";
import OrganizationPage from "./OrganizationPage";

const DAY = 86_400_000;
const state = vi.hoisted(() => ({ org: null as (OrganizationDoc & { id: string }) | null, shifts: [] as Instance[], signedIn: true }));

vi.mock("@/lib/data/orgs", () => ({ getOrganization: async () => state.org }));
vi.mock("@/hooks/useShiftData", () => ({ useOrgInstances: () => ({ data: state.shifts, error: null, isLoading: false }) }));
vi.mock("@/hooks/useNow", () => ({ useNow: () => SHIFT_START_MS - 60 * 60 * 1000 }));
vi.mock("@/hooks/useInbox", () => ({ useSavedItems: () => ({ data: [], error: null, isLoading: false }) }));
vi.mock("@/store/authStore", () => ({ useSessionUser: () => (state.signedIn ? { uid: "uid-1" } : null) }));
// Tier 2 lane B: reviews have their own tests (src/components/reviews/OrgReviews.test.tsx).
vi.mock("@/components/reviews/OrgReviews", () => ({ OrgReviews: () => null }));

const pantry = (overrides: Partial<OrganizationDoc> = {}): OrganizationDoc & { id: string } => ({
  id: "org-1",
  name: "Common Table Pantry",
  mission: "We sort, pack, and share donated groceries with families.",
  causeAreas: ["hunger-food-security"],
  ein: "74-5550123",
  address: { line1: "418 Community Commons Dr", city: "Example City", state: "TX", zip: "78204" },
  geo: null,
  contactEmail: "hello@example.test",
  contactPhone: null,
  website: "https://example.test",
  timeZone: "America/Chicago",
  photoPaths: [],
  ownerUid: "owner",
  verified: true,
  verifiedAt: ts(0),
  verifiedBy: "admin",
  hasActivity: true,
  archived: false,
  archivedAt: null,
  createdAt: ts(0),
  updatedAt: ts(0),
  ...overrides
});

const renderAt = (orgId = "org-1") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/organizations/${orgId}`]}>
        <Routes>
          <Route path="/organizations/:orgId" element={<OrganizationPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("OrganizationPage", () => {
  beforeEach(() => {
    state.org = pantry();
    state.signedIn = true;
    state.shifts = [
      makeInstance({ id: "past", title: "Past shift", start: ts(SHIFT_START_MS - 2 * DAY) }),
      makeInstance({ id: "next", title: "Sort and pack food boxes" }),
      makeInstance({ id: "gone", title: "Cancelled shift", status: "cancelled", start: ts(SHIFT_START_MS + DAY) })
    ];
  });

  it("shows the name, Verified chip, mission, and only upcoming shifts, with Open next shift and Save", async () => {
    renderAt();
    expect(await screen.findByRole("heading", { level: 1, name: "Common Table Pantry" })).toBeInTheDocument();
    expect(screen.getByText("Verified organization")).toBeInTheDocument();
    expect(screen.getByText(/We sort, pack, and share donated groceries/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open next shift: Sort and pack food boxes" })).toHaveAttribute("href", "/opportunity/next");
    expect(screen.getByRole("link", { name: "Sort and pack food boxes" })).toHaveAttribute("href", "/opportunity/next");
    expect(screen.queryByText("Past shift")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelled shift")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save: Common Table Pantry" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows the Unverified chip and the empty line; signed-out visitors get no Save", async () => {
    state.org = pantry({ verified: false, website: "javascript:alert(1)" });
    state.shifts = [];
    state.signedIn = false;
    renderAt();
    expect(await screen.findByText("Unverified")).toBeInTheDocument();
    expect(screen.getByText("No upcoming shifts right now.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open next shift/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Website" })).not.toBeInTheDocument();
  });

  it("shows not found for an unknown id", async () => {
    state.org = null;
    renderAt("missing");
    expect(await screen.findByRole("heading", { level: 1, name: "Organization not found" })).toBeInTheDocument();
  });
});
