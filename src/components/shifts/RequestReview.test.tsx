/**
 * RequestReview.test.tsx
 * "Request review" on a no-show in My Shifts (T3, SPEC 5.2
 * requestAttendanceReview): shown only for no-shows inside the 30-day
 * window, the note is required (10+ characters), the op receives the signup
 * id and trimmed note, pending until it returns, then "Review requested";
 * errors use the catalog copy; open or resolved disputes show their state.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DAY_MS } from "@fbla/shared";
import { apiErrorFor } from "@/test/apiErrors";
import { SHIFT_END_MS, makeSignup, ts } from "@/test/fixtures";
import { MyShiftRow } from "./MyShiftRow";
import { RequestReview } from "./RequestReview";

const requestAttendanceReview = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, api: { volunteer: { requestAttendanceReview: (input: unknown) => requestAttendanceReview(input) } } };
});
vi.mock("@/hooks/useShiftData", async () => {
  const { makeInstance } = await import("@/test/fixtures");
  return { useInstance: () => ({ data: makeInstance(), error: null, isLoading: false }) };
});

const NOW = SHIFT_END_MS + 2 * DAY_MS;
const noShow = makeSignup({ status: "no-show" });

describe("RequestReview", () => {
  // A block body: a function returned from beforeEach would run as a teardown hook.
  beforeEach(() => {
    requestAttendanceReview.mockReset();
  });

  it("is offered on a past no-show row in My Shifts", () => {
    render(
      <ul>
        <MyShiftRow signup={noShow} nowMs={NOW} />
      </ul>
    );
    expect(screen.getByRole("button", { name: "Request review" })).toBeInTheDocument();
  });

  it("is not offered for other statuses or after the 30-day window", () => {
    const { rerender, container } = render(<RequestReview signup={makeSignup({ status: "completed" })} nowMs={NOW} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<RequestReview signup={noShow} nowMs={SHIFT_END_MS + 31 * DAY_MS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("requires a note, then sends it and confirms after the op returns", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    requestAttendanceReview.mockReturnValue(new Promise((done) => (resolve = done)));
    render(<RequestReview signup={noShow} nowMs={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Request review" }));
    const note = screen.getByLabelText("What happened?");
    expect(note).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(screen.getByText(/Write at least 10 characters/)).toBeInTheDocument();
    expect(requestAttendanceReview).not.toHaveBeenCalled();

    fireEvent.change(note, { target: { value: "  I signed the paper list at the door.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(requestAttendanceReview).toHaveBeenCalledWith({ signupId: "shift-1_uid-1", note: "I signed the paper list at the door." });
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();

    resolve({ disputeOpen: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Review requested. The organization will look at it.");
  });

  it("shows the catalog message when the window has closed on the server", async () => {
    const closed = apiErrorFor("DISPUTE_WINDOW_CLOSED");
    requestAttendanceReview.mockRejectedValue(closed);
    render(
      <MemoryRouter>
        <RequestReview signup={noShow} nowMs={NOW} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Request review" }));
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "I was there the whole time." } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(screen.getByText(closed.userError.message)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
  });

  it("Cancel closes the form and returns focus to the button", () => {
    render(<RequestReview signup={noShow} nowMs={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Request review" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Request review" })).toHaveFocus();
  });

  it("shows an open or resolved review instead of the button", () => {
    const openDispute = { note: "I was there", openedAt: ts(NOW), resolvedAt: null, resolvedBy: null };
    const { rerender } = render(<RequestReview signup={makeSignup({ status: "no-show", disputeOpen: true, dispute: openDispute })} nowMs={NOW} />);
    expect(screen.getByRole("status")).toHaveTextContent("Review requested");
    rerender(<RequestReview signup={makeSignup({ status: "no-show", dispute: { ...openDispute, resolvedAt: ts(NOW), resolvedBy: "coord" } })} nowMs={NOW} />);
    expect(screen.getByText("The organization reviewed this.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
