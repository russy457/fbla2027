/**
 * OrgShiftNewPage.test.tsx
 * The plain-words planner on /org/:orgId/shifts/new (H2, SPEC#screen-planner
 * 9.14): parsing the SPEC example pre-fills the new-opportunity form and,
 * once an opportunity is chosen, the date, times, and capacity, each field
 * highlighted for review; a title matching an existing opportunity selects
 * it; nothing is ever submitted until the coordinator presses a save button.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrgShiftNewPage from "./OrgShiftNewPage";

const ops = vi.hoisted(() => ({ upsertOpportunity: vi.fn(), createInstance: vi.fn() }));
const state = vi.hoisted(() => ({ opportunities: [] as Array<{ id: string; title: string; status: string }> }));

/** Wednesday 2026-10-14, noon in San Antonio: "Sat" is 2026-10-17. */
const NOW = Date.UTC(2026, 9, 14, 17, 0, 0);

vi.mock("@/hooks/useNow", () => ({ useNow: () => NOW }));
vi.mock("@/hooks/useOrgAdmin", () => ({ useOrgOpportunities: () => ({ data: state.opportunities, isError: false, isPending: false }) }));
vi.mock("@/lib/data/orgs", () => ({ getOrganization: async () => ({ id: "org-1", timeZone: "America/Chicago" }) }));
vi.mock("@/components/org/OrgNav", () => ({ OrgNav: () => null }));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, api: { coordinator: ops } };
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/org/org-1/shifts/new"]}>
        <Routes>
          <Route path="/org/:orgId/shifts/new" element={<OrgShiftNewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

const describeShift = async (text: string) => {
  fireEvent.change(await screen.findByLabelText("Shift description"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Fill in the form" }));
};

describe("OrgShiftNewPage planner", () => {
  beforeEach(() => {
    ops.upsertOpportunity.mockReset();
    ops.createInstance.mockReset();
    state.opportunities = [{ id: "opp-sort", title: "Sorting", status: "active" }, { id: "opp-other", title: "Garden day", status: "active" }];
  });

  it("selects a matching opportunity and pre-fills the shift times, highlighted, without submitting", async () => {
    renderPage();
    await describeShift("need 12 people Sat 9-1 sorting at the food bank");

    expect(screen.getByText(/We filled in title, cause area, place, date, start time, end time, and volunteers needed/)).toBeInTheDocument();
    expect(screen.getByText("No AM or PM was given, so we guessed. Check the times.")).toBeInTheDocument();
    expect(screen.getByLabelText("Opportunity")).toHaveValue("opp-sort");
    const when = screen.getByRole("region", { name: "2. When" });
    expect(within(when).getByLabelText("Date")).toHaveValue("2026-10-17");
    expect(within(when).getByLabelText(/^Start time/)).toHaveValue("09:00");
    expect(within(when).getByLabelText(/^End time/)).toHaveValue("13:00");
    expect(within(when).getByLabelText("Capacity")).toHaveValue(12);
    expect(within(when).getByLabelText("Capacity")).toHaveClass("bg-accent-subtle");
    expect(within(when).getAllByText("Filled from your description. Check it.")).toHaveLength(4);
    expect(ops.upsertOpportunity).not.toHaveBeenCalled();
    expect(ops.createInstance).not.toHaveBeenCalled();
  });

  it("opens the new-opportunity form pre-filled when no opportunity matches", async () => {
    state.opportunities = [];
    renderPage();
    await describeShift("need 12 people Sat 9-1 sorting at the food bank");
    expect(screen.getByLabelText("Title")).toHaveValue("Sorting");
    expect(screen.getByLabelText("Title")).toHaveClass("bg-accent-subtle");
    expect(screen.getByLabelText("Cause area")).toHaveValue("hunger-food-security");
    expect(screen.getByLabelText("Street address")).toHaveValue("the food bank");
    expect(ops.upsertOpportunity).not.toHaveBeenCalled();
  });

  it("asks for a sentence when the box is empty and explains when nothing is recognized", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Fill in the form" }));
    expect(screen.getByText("Write a sentence about the shift first.")).toBeInTheDocument();
    await describeShift("???");
    expect(screen.getByText(/We couldn't find shift details in that/)).toBeInTheDocument();
    expect(screen.getByLabelText("Opportunity")).toHaveValue("");
  });
});
