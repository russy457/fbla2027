/**
 * ResetDemoDataControl.test.tsx
 * The admin reset control (E1): a second confirm before anything happens,
 * then admin.resetDemoData and the reload callback; Cancel does nothing;
 * non-admins see it disabled; server refusals show the catalog message.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toUserError } from "@fbla/shared";
import { useAuthStore } from "@/store/authStore";

const resetDemoData = vi.fn();
vi.mock("@/lib/demoMode", () => ({ isDemoMode: () => true }));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, api: { admin: { resetDemoData: (input: unknown) => resetDemoData(input) } } };
});

const { ResetDemoDataControl } = await import("./ResetDemoDataControl");
const { ApiError } = await import("@/lib/api");

const signInAs = (isAdmin: boolean) =>
  useAuthStore.setState({ session: { status: "user", user: { uid: "u1", email: "a@demo.test", isAdmin } } });

beforeEach(() => {
  resetDemoData.mockReset();
  signInAs(true);
});

describe("ResetDemoDataControl", () => {
  it("asks for confirmation, then resets and reloads", async () => {
    resetDemoData.mockResolvedValue({ documents: 180, collectionsCleared: 12, accounts: 4, demoShiftStartsAt: "2026-10-06T15:10:00.000Z" });
    const onReset = vi.fn();
    render(<ResetDemoDataControl onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset demo data" }));
    expect(resetDemoData).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, reset demo data" }));
    expect(await screen.findByText(/180 documents written/)).toBeInTheDocument();
    expect(resetDemoData).toHaveBeenCalledWith({});
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("cancel leaves the data alone", () => {
    render(<ResetDemoDataControl onReset={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset demo data" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(resetDemoData).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Reset demo data" })).toBeEnabled();
  });

  it("is disabled for non-admins", () => {
    signInAs(false);
    render(<ResetDemoDataControl onReset={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Reset demo data" })).toBeDisabled();
    expect(screen.getByText("Only admins can reset demo data.")).toBeInTheDocument();
  });

  it("shows the server's refusal", async () => {
    resetDemoData.mockRejectedValue(new ApiError(toUserError({ details: { code: "DEMO_MODE_REQUIRED" } })));
    const onReset = vi.fn();
    render(<ResetDemoDataControl onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset demo data" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, reset demo data" }));
    expect(await screen.findByRole("button", { name: "Reset demo data" })).toBeEnabled();
    expect(onReset).not.toHaveBeenCalled();
    expect(document.body.textContent).toMatch(/demo/i);
  });
});
