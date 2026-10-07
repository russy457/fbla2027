/**
 * NeedsAttention.test.tsx
 * The Needs attention list (SPEC 9.8, D9): grouped rows, Approve calls
 * approveHours with the log id, Reject needs a reason and sends it to
 * rejectHours, Approve all covers one shift's needsReview logs, a refusal
 * shows the catalog copy, and the empty state.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorFor } from "@/test/apiErrors";
import type { AttentionGroup } from "@/lib/needsAttention";
import { NeedsAttentionList } from "./NeedsAttention";

const approveHours = vi.fn();
const rejectHours = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    api: { coordinator: { approveHours: (input: unknown) => approveHours(input), rejectHours: (input: unknown) => rejectHours(input), setAttendance: vi.fn() } }
  };
});

const GROUPS: AttentionGroup[] = [
  {
    key: "s1",
    title: "Sort food",
    startMs: Date.UTC(2026, 9, 17, 14),
    timeZone: "America/Chicago",
    approvableLogIds: ["s1_a", "s1_b"],
    items: [
      { kind: "log", id: "s1_a", name: "Jordan R.", minutes: 0, source: "kiosk", needsReview: true, description: null },
      { kind: "log", id: "s1_b", name: "Sam L.", minutes: 225, source: "finalize", needsReview: true, description: null },
      { kind: "dispute", id: "s1_c", name: "Ana T.", note: "I was there", status: "no-show", scheduledMinutes: 240 }
    ]
  },
  {
    key: "manual",
    title: "Manual entries",
    startMs: null,
    timeZone: null,
    approvableLogIds: [],
    items: [{ kind: "log", id: "manual_1", name: "Dev P.", minutes: 60, source: "manual", needsReview: false, description: "Food drive" }]
  }
];

const renderList = (groups: AttentionGroup[] = GROUPS) =>
  render(
    <MemoryRouter>
      <NeedsAttentionList groups={groups} />
    </MemoryRouter>
  );

describe("NeedsAttentionList", () => {
  beforeEach(() => {
    approveHours.mockReset();
    rejectHours.mockReset();
  });

  it("groups rows by shift with names, hours, and the dispute note", () => {
    renderList();
    expect(screen.getByRole("heading", { level: 2, name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sort food" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Manual entries" })).toBeInTheDocument();
    expect(screen.getByText("0 hours, Kiosk check-out")).toBeInTheDocument();
    expect(screen.getByText("I was there")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review attendance for Ana T." })).toBeInTheDocument();
  });

  it("approves one log and announces it", async () => {
    approveHours.mockResolvedValue({ approved: 1, skipped: 0 });
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Approve hours for Sam L." }));
    expect(approveHours).toHaveBeenCalledWith({ logIds: ["s1_b"] });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Approved for Sam L.: 3.75 hours."));
  });

  it("requires a reason before rejecting", async () => {
    rejectHours.mockResolvedValue({ logId: "manual_1", alreadyRejected: false });
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Reject hours for Dev P." }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm reject" }));
    expect(screen.getByText("Write a reason (at least 3 characters).")).toBeInTheDocument();
    expect(rejectHours).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Reason for rejecting"), { target: { value: "No record of this event" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm reject" }));
    expect(rejectHours).toHaveBeenCalledWith({ logId: "manual_1", reason: "No record of this event" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Hours for Dev P. were not approved."));
  });

  it("approves all reviewed hours of one shift, and shows refusals", async () => {
    approveHours.mockRejectedValue(apiErrorFor("INVALID_TRANSITION"));
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Approve all reviewed hours for Sort food" }));
    expect(approveHours).toHaveBeenCalledWith({ logIds: ["s1_a", "s1_b"] });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That change isn't allowed for this signup right now."));
  });

  it("shows the empty state", () => {
    renderList([]);
    expect(screen.getByText("Nothing needs your review.")).toBeInTheDocument();
  });
});
