/**
 * RankedVolunteersPanel.test.tsx
 * Rank, pick, invite (SPEC 8.4, 9.14): names and "why" chips only, Invite
 * disabled until someone is picked, the refs sent are exactly the picked
 * ones, the result is announced, and an expired list shows the catalog
 * message (REF_EXPIRED "This list is out of date.").
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorFor } from "@/test/apiErrors";
import { RankedVolunteersPanel } from "./RankedVolunteersPanel";

const rankVolunteers = vi.fn();
const inviteVolunteers = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    api: { coordinator: { rankVolunteers: (input: unknown) => rankVolunteers(input), inviteVolunteers: (input: unknown) => inviteVolunteers(input) } }
  };
});

const CANDIDATES = [
  { ref: "ref-jordan", displayName: "Jordan R.", score: 0.82, why: [{ kind: "interest", causeArea: "hunger-food-security" }, { kind: "past-volunteer" }] },
  { ref: "ref-sam", displayName: "Sam L.", score: 0.4, why: [{ kind: "nearby" }] }
];

describe("RankedVolunteersPanel", () => {
  beforeEach(() => {
    rankVolunteers.mockReset();
    inviteVolunteers.mockReset();
  });

  it("ranks, shows names, match, and reasons, then invites only the picked people", async () => {
    rankVolunteers.mockResolvedValue({ candidates: CANDIDATES, refExpiresAt: "2026-10-17T14:00:00.000Z" });
    inviteVolunteers.mockResolvedValue({ sent: 1, skipped: 0 });
    render(<RankedVolunteersPanel instanceId="inst1" />);

    fireEvent.click(screen.getByRole("button", { name: "Rank volunteers" }));
    expect(rankVolunteers).toHaveBeenCalledWith({ instanceId: "inst1" });
    await screen.findByRole("checkbox", { name: "Jordan R." });
    expect(screen.getByRole("status")).toHaveTextContent("Found 2 volunteers to invite.");
    expect(screen.getByText("82% match")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Why Jordan R." })).toHaveTextContent("Cares about hunger and foodVolunteered with you");

    const inviteButton = screen.getByRole("button", { name: "Invite selected (0)" });
    expect(inviteButton).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Jordan R." }));
    fireEvent.click(screen.getByRole("button", { name: "Invite selected (1)" }));
    expect(inviteVolunteers).toHaveBeenCalledWith({ instanceId: "inst1", refs: ["ref-jordan"] });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Invited 1 volunteer."));
    expect(screen.getByRole("button", { name: "Invite selected (0)" })).toBeDisabled();
  });

  it("explains skips and an empty ranking", async () => {
    rankVolunteers.mockResolvedValueOnce({ candidates: CANDIDATES, refExpiresAt: "x" }).mockResolvedValueOnce({ candidates: [], refExpiresAt: "x" });
    inviteVolunteers.mockResolvedValue({ sent: 0, skipped: 2 });
    render(<RankedVolunteersPanel instanceId="inst1" />);
    fireEvent.click(screen.getByRole("button", { name: "Rank volunteers" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Sam L." }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Jordan R." }));
    fireEvent.click(screen.getByRole("button", { name: "Invite selected (2)" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Invited 0 volunteers. 2 skipped"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Sam L." }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Sam L." }));
    fireEvent.click(screen.getByRole("button", { name: "Rank again" }));
    expect(await screen.findByText(/No one to suggest yet. Volunteers appear here/)).toBeInTheDocument();
  });

  it("shows the catalog message when the list is out of date", async () => {
    rankVolunteers.mockResolvedValue({ candidates: CANDIDATES, refExpiresAt: "x" });
    inviteVolunteers.mockRejectedValue(apiErrorFor("REF_EXPIRED"));
    render(<RankedVolunteersPanel instanceId="inst1" />);
    fireEvent.click(screen.getByRole("button", { name: "Rank volunteers" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Jordan R." }));
    fireEvent.click(screen.getByRole("button", { name: "Invite selected (1)" }));
    expect(await screen.findByText("This list is out of date.")).toBeInTheDocument();
  });
});
