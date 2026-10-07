/**
 * CodeEntryForm.test.tsx
 * Kiosk code entry (SPEC#screen-kiosk-states "Typed entry"): numeric
 * keyboard hints, zod validation before any call, the catalog messages for
 * an expired code and a closed window, and the RATE_LIMITED countdown that
 * keeps Submit disabled.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { apiErrorFor } from "@/test/apiErrors";
import { CodeEntryForm } from "./CodeEntryForm";

const renderForm = (onSubmitCode = vi.fn().mockResolvedValue(undefined)) => {
  render(
    <MemoryRouter>
      <CodeEntryForm actionLabel="Check in" onSubmitCode={onSubmitCode} />
    </MemoryRouter>
  );
  return { onSubmitCode, input: screen.getByLabelText("Check in code"), submit: screen.getByRole("button", { name: "Submit code" }) };
};

const typeAndSubmit = (input: HTMLElement, submit: HTMLElement, value: string): void => {
  fireEvent.change(input, { target: { value } });
  fireEvent.click(submit);
};

describe("CodeEntryForm", () => {
  it("asks phones for the numeric keyboard and one-time-code autofill", () => {
    const { input } = renderForm();
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
  });

  it.each([
    ["", "Enter the 6-digit code shown on the kiosk."],
    ["12ab56", "Use numbers only."],
    ["12345", "The code has exactly 6 digits."]
  ])("rejects %j before calling the server", async (value, message) => {
    const { input, submit, onSubmitCode } = renderForm();
    typeAndSubmit(input, submit, value);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(onSubmitCode).not.toHaveBeenCalled();
  });

  it("sends a valid code without spaces", async () => {
    const { input, submit, onSubmitCode } = renderForm();
    typeAndSubmit(input, submit, "482 913");
    await waitFor(() => expect(onSubmitCode).toHaveBeenCalledWith("482913"));
  });

  it("shows the catalog message for a wrong or expired code and clears the field", async () => {
    const { input, submit } = renderForm(vi.fn().mockRejectedValue(apiErrorFor("KIOSK_CODE_INVALID")));
    typeAndSubmit(input, submit, "111111");
    expect(await screen.findByRole("alert")).toHaveTextContent("That code is wrong or expired. Enter the code shown on the kiosk now.");
    expect(input).toHaveValue("");
  });

  it("shows when check-in opens if the window is closed", async () => {
    const { input, submit } = renderForm(vi.fn().mockRejectedValue(apiErrorFor("CHECKIN_NOT_OPEN", { opensAtLabel: "8:30 AM CDT" })));
    typeAndSubmit(input, submit, "111111");
    expect(await screen.findByRole("alert")).toHaveTextContent("Check-in for this shift is not open right now. (opens 8:30 AM CDT)");
  });

  it("counts down after too many attempts and keeps Submit disabled until then", async () => {
    const { input, submit } = renderForm(vi.fn().mockRejectedValue(apiErrorFor("RATE_LIMITED", { retryAfterSec: 2 })));
    typeAndSubmit(input, submit, "111111");
    expect(await screen.findByText("You can try again in 2 s.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Too many attempts, wait a minute.");
    expect(screen.getByRole("button", { name: "Submit code" })).toBeDisabled();
    // Real seconds tick by (2 s total): the countdown drops, then Submit comes back.
    expect(await screen.findByText("You can try again in 1 s.", {}, { timeout: 2000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit code" })).toBeEnabled(), { timeout: 2500 });
  });
});
