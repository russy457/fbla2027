/**
 * ErrorNotice.test.tsx
 * D22 error presentation: friendly title and message from the catalog, a
 * help link when the catalog has one, Details collapsed for volunteers and
 * expanded for coordinators and admins, a copyable request ID, and the
 * "Something went wrong (ref: ID)" fallback for unknown errors.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toUserError } from "@fbla/shared";
import { apiErrorFor } from "@/test/apiErrors";
import { ErrorNotice } from "./ErrorNotice";

const renderNotice = (error = apiErrorFor("KIOSK_CODE_INVALID", {}, "req-42").userError, expandDetails?: boolean) =>
  render(
    <MemoryRouter>
      <ErrorNotice error={error} expandDetails={expandDetails} />
    </MemoryRouter>
  );

const detailsOf = (): HTMLDetailsElement => screen.getByText("Details").closest("details") as HTMLDetailsElement;

describe("ErrorNotice (D22)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows friendly copy, the next step, and a help link", () => {
    renderNotice();
    expect(screen.getByRole("alert")).toHaveTextContent("Check your entry");
    expect(screen.getByText("That code is wrong or expired. Enter the code shown on the kiosk now.")).toBeInTheDocument();
    expect(screen.getByText("Next step: Re-enter the current code.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read the help article" })).toHaveAttribute("href", "/help/troubleshooting-check-in");
  });

  it("keeps Details collapsed for volunteers", () => {
    renderNotice();
    expect(detailsOf().open).toBe(false);
  });

  it("expands Details for coordinators and admins", () => {
    renderNotice(undefined, true);
    expect(detailsOf().open).toBe(true);
    expect(screen.getByText("req-42")).toBeInTheDocument();
    expect(screen.getByText("KIOSK_CODE_INVALID")).toBeInTheDocument();
  });

  it("copies the request ID", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderNotice(undefined, true);
    fireEvent.click(screen.getByRole("button", { name: "Copy reference" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("req-42"));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("falls back to 'Something went wrong (ref: ID)' for unknown errors", () => {
    renderNotice(toUserError({ details: { code: "NOT_A_REAL_CODE", requestId: "abc-9" } }), true);
    expect(screen.getByText("Something went wrong (ref: abc-9).", { exact: false })).toBeInTheDocument();
  });
});
