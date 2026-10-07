/**
 * PlannerBox.test.tsx
 * Tier 2 lane B "Improve with AI" (SPEC 8.4, 9.14): it calls
 * ai.shiftPlannerParse for the org in the URL, pre-fills (never saves) with
 * the AI description added, says who drafted it, explains a parser fallback,
 * shows the catalog error on failure, and needs text first.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePlannerText } from "@fbla/shared";
import { SHIFT_START_MS } from "@/test/fixtures";
import { apiErrorFor } from "@/test/apiErrors";
import { PlannerBox } from "./PlannerBox";

const ai = vi.hoisted(() => ({ shiftPlannerParse: vi.fn(), failWith: null as unknown }));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  // A rejecting vi.fn is reported by the runner even when the code under test catches it,
  // so failures go through a plain async function instead.
  const shiftPlannerParse = async (input: unknown) => {
    if (ai.failWith !== null) throw ai.failWith;
    return ai.shiftPlannerParse(input);
  };
  return { ...original, api: { ai: { shiftPlannerParse } } };
});

const TEXT = "need 12 people Sat 9-1 sorting at the food bank";
const draft = parsePlannerText(TEXT, { referenceDate: "2026-10-14" });

const renderBox = () => {
  const onPrefill = vi.fn();
  render(
    <MemoryRouter initialEntries={["/org/org-1/shifts/new"]}>
      <Routes>
        <Route path="/org/:orgId/shifts/new" element={<PlannerBox timeZone="America/Chicago" nowMs={SHIFT_START_MS} onPrefill={onPrefill} />} />
      </Routes>
    </MemoryRouter>
  );
  return onPrefill;
};

beforeEach(() => {
  ai.shiftPlannerParse.mockReset();
  ai.failWith = null;
});

describe("PlannerBox Improve with AI", () => {
  it("needs a sentence first", () => {
    renderBox();
    fireEvent.click(screen.getByRole("button", { name: "Improve with AI" }));
    expect(screen.getByText("Write a sentence about the shift first.")).toBeInTheDocument();
    expect(ai.shiftPlannerParse).not.toHaveBeenCalled();
  });

  it("pre-fills from the AI draft, including the description", async () => {
    ai.shiftPlannerParse.mockResolvedValue({ draft, description: "Help sort food.", source: "ai", limited: false });
    const onPrefill = renderBox();
    fireEvent.change(screen.getByLabelText("Shift description"), { target: { value: TEXT } });
    fireEvent.click(screen.getByRole("button", { name: "Improve with AI" }));
    await waitFor(() => expect(onPrefill).toHaveBeenCalledWith(expect.objectContaining({ description: "Help sort food.", capacity: 12 })));
    expect(ai.shiftPlannerParse).toHaveBeenCalledWith({ orgId: "org-1", text: TEXT });
    expect(screen.getByText(/Drafted with AI/)).toBeInTheDocument();
    expect(screen.getByText(/and description\. Check each highlighted field/)).toBeInTheDocument();
  });

  it("explains a parser fallback at the AI limit", async () => {
    ai.shiftPlannerParse.mockResolvedValue({ draft, description: null, source: "parser", limited: true });
    renderBox();
    fireEvent.change(screen.getByLabelText("Shift description"), { target: { value: TEXT } });
    fireEvent.click(screen.getByRole("button", { name: "Improve with AI" }));
    expect(await screen.findByText(/reached today's AI limit/)).toBeInTheDocument();
  });

  it("shows the error and pre-fills nothing when the call fails", async () => {
    ai.failWith = apiErrorFor("INPUT_TOO_LONG");
    const onPrefill = renderBox();
    fireEvent.change(screen.getByLabelText("Shift description"), { target: { value: TEXT } });
    fireEvent.click(screen.getByRole("button", { name: "Improve with AI" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onPrefill).not.toHaveBeenCalled();
  });
});
