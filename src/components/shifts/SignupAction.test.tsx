/**
 * SignupAction.test.tsx
 * The rendered signup button matrix (D5): what a volunteer sees for each
 * Tier 0 state, that Sign up calls the op and shows pending until it
 * returns (no optimistic UI), that Cancel needs a second confirmation, and
 * that a refusal shows the catalog message (D22).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorFor } from "@/test/apiErrors";
import { MINUTE, SHIFT_START_MS, makeInstance, makeSignup } from "@/test/fixtures";
import { SignupAction } from "./SignupAction";

const signup = vi.fn();
const cancelSignup = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, api: { volunteer: { signup: (input: unknown) => signup(input), cancelSignup: (input: unknown) => cancelSignup(input) } } };
});

const BEFORE = SHIFT_START_MS - 60 * MINUTE;
const ADULT = "2000-05-01";

const renderAction = (props: Partial<Parameters<typeof SignupAction>[0]> = {}) =>
  render(
    <MemoryRouter>
      <SignupAction instance={makeInstance()} signup={null} birthDate={ADULT} signedIn nowMs={BEFORE} {...props} />
    </MemoryRouter>
  );

describe("SignupAction", () => {
  beforeEach(() => {
    signup.mockReset();
    cancelSignup.mockReset();
  });

  it.each([
    ["full shift", { instance: makeInstance({ signupCount: 3 }) }, "Full"],
    ["started shift", { nowMs: SHIFT_START_MS }, "Shift started"],
    ["cancelled shift", { instance: makeInstance({ status: "cancelled" }) }, "Cancelled by organization"],
    ["age limit", { instance: makeInstance({ minAge: 18 }), birthDate: "2011-01-01" }, "Ages 18+"],
    ["minor at unverified org", { instance: makeInstance({ orgVerified: false }), birthDate: "2011-01-01" }, "Not available yet"]
  ])("shows a disabled %s button", (_name, props, label) => {
    renderAction(props);
    expect(screen.getByRole("button", { name: label })).toBeDisabled();
  });

  it("explains the age limit in words", () => {
    renderAction({ instance: makeInstance({ minAge: 18 }), birthDate: "2011-01-01" });
    expect(screen.getByText("You must be at least 18 to join this shift.")).toBeInTheDocument();
  });

  it("signs up, showing pending until the server answers", async () => {
    let resolveSignup: (value: unknown) => void = () => undefined;
    signup.mockReturnValue(new Promise((resolve) => (resolveSignup = resolve)));
    renderAction();
    fireEvent.click(screen.getByRole("button", { name: /Sign up/ }));
    expect(signup).toHaveBeenCalledWith({ instanceId: "shift-1" });
    expect(screen.getByRole("button", { name: /Signing up/ })).toBeDisabled();
    resolveSignup({ signupId: "x", status: "confirmed", waitlistPosition: null, waitlistSize: null });
    await waitFor(() => expect(screen.queryByText("Signing up...")).not.toBeInTheDocument());
  });

  it("shows Signed up with check-in time and asks before cancelling", async () => {
    cancelSignup.mockResolvedValue({ status: "cancelled", lateCancel: true, promotedSignupId: null });
    renderAction({ signup: makeSignup() });
    expect(screen.getByText("Signed up")).toBeInTheDocument();
    expect(screen.getByText("Check-in opens 8:30 AM CDT")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(cancelSignup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel my spot" }));
    expect(cancelSignup).toHaveBeenCalledWith({ signupId: "shift-1_uid-1" });
    await waitFor(() => expect(screen.queryByText("Cancelling...")).not.toBeInTheDocument());
  });

  it("shows the catalog message when the server refuses", async () => {
    signup.mockRejectedValue(apiErrorFor("SHIFT_FULL"));
    renderAction();
    fireEvent.click(screen.getByRole("button", { name: /Sign up/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This shift and its waitlist are full.");
  });

  it("sends signed-out visitors to sign in instead of calling the op", async () => {
    renderAction({ signedIn: false, birthDate: null });
    fireEvent.click(screen.getByRole("button", { name: /Sign up/ }));
    expect(signup).not.toHaveBeenCalled();
  });
});
