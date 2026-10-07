/**
 * DemoArc.test.tsx
 * The check-out success state (SPEC#screen-demo-arc, D11): approved kiosk
 * hours show "N hours logged at ORG" with the letter button; a 0-minute
 * check-out (needsReview) says a coordinator will review and offers no
 * letter, because nothing was approved.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DemoArc } from "./DemoArc";
import type { CheckOutResult } from "./CheckInPanel";

const renderArc = (result: CheckOutResult) =>
  render(
    <MemoryRouter>
      <DemoArc result={result} onDismiss={vi.fn()} />
    </MemoryRouter>
  );

describe("DemoArc", () => {
  it("approved hours: names the hours and the org and offers a letter", () => {
    renderArc({ status: "completed", minutes: 225, orgName: "Common Table Pantry", totalApprovedHours: 26.25, needsReview: false });
    expect(screen.getByRole("heading", { name: "3.75 hours logged at Common Table Pantry" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "Get verified letter" })).toBeInTheDocument();
  });

  it("0-minute check-out: says 0 hours counted and the coordinator will review, with no letter button", () => {
    renderArc({ status: "completed", minutes: 0, orgName: "Common Table Pantry", totalApprovedHours: 0, needsReview: true });
    expect(screen.getByRole("heading", { name: "0 hours counted, your coordinator will review" })).toHaveFocus();
    expect(screen.queryByText(/already approved/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Get verified letter" })).not.toBeInTheDocument();
  });
});
