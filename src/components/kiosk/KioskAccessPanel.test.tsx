/**
 * KioskAccessPanel.test.tsx
 * Kiosk exit (SPEC#kiosk "Kiosk lock", G15): the person signing in is checked
 * as an owner or coordinator of the shift's org on an isolated app BEFORE the
 * kiosk session is replaced. A volunteer, a coordinator of another org, or a
 * wrong password gets an error and this device's session is never touched;
 * a coordinator of this org exits. Firebase is mocked at the SDK boundary so
 * the real lib/kioskExit.ts ordering is what runs.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOT_A_COORDINATOR_MESSAGE } from "@/lib/kioskExit";
import { KioskAccessPanel } from "./KioskAccessPanel";

const mocks = vi.hoisted(() => ({
  isolatedSignIn: vi.fn(),
  memberRole: null as string | null,
  dispose: vi.fn(),
  mainSignIn: vi.fn()
}));

vi.mock("@/lib/firebase", () => ({
  createIsolatedServices: () => ({ auth: { name: "isolated" }, db: { name: "isolated-db" }, dispose: mocks.dispose })
}));
vi.mock("firebase/auth", () => ({ signInWithEmailAndPassword: (...args: unknown[]) => mocks.isolatedSignIn(...args) }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  getDoc: async (ref: { path: string }) => ({
    path: ref.path,
    exists: () => mocks.memberRole !== null,
    get: (field: string) => (field === "role" ? mocks.memberRole : undefined)
  })
}));
vi.mock("@/lib/authClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/authClient")>();
  return { ...actual, signInWithEmail: (...args: unknown[]) => mocks.mainSignIn(...args), switchToKioskSession: vi.fn() };
});
vi.mock("@/lib/api", () => ({ api: {}, ApiError: class ApiError extends Error {}, NETWORK_USER_ERROR: {} }));

const renderExit = () => {
  const onExited = vi.fn();
  render(<KioskAccessPanel mode="exit" orgId="common-table-pantry" instanceId="demo-shift" shiftTitle="Sort and pack food boxes" onExited={onExited} onCancelExit={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "someone@demo.fbla2027.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "fbla2027-demo-2027" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in and exit kiosk" }));
  return { onExited };
};

describe("KioskAccessPanel exit", () => {
  beforeEach(() => {
    mocks.isolatedSignIn.mockReset().mockResolvedValue({ user: { uid: "demo-volunteer" } });
    mocks.mainSignIn.mockReset().mockResolvedValue(undefined);
    mocks.dispose.mockReset().mockResolvedValue(undefined);
    mocks.memberRole = null;
  });

  it("a non-coordinator gets an error and the kiosk session is never replaced", async () => {
    const { onExited } = renderExit();
    expect(await screen.findByRole("alert")).toHaveTextContent(NOT_A_COORDINATOR_MESSAGE);
    expect(mocks.mainSignIn).not.toHaveBeenCalled();
    expect(onExited).not.toHaveBeenCalled();
    expect(mocks.dispose).toHaveBeenCalledTimes(1);
    // The check reads the caller's own members doc in the shift's org.
    expect(mocks.isolatedSignIn).toHaveBeenCalledWith({ name: "isolated" }, "someone@demo.fbla2027.test", "fbla2027-demo-2027");
  });

  it("a wrong password is refused on the isolated app, before touching this device", async () => {
    mocks.isolatedSignIn.mockRejectedValue({ code: "auth/invalid-credential" });
    const { onExited } = renderExit();
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password don't match.");
    expect(mocks.mainSignIn).not.toHaveBeenCalled();
    expect(onExited).not.toHaveBeenCalled();
  });

  it("a coordinator of this org is verified first, then signs in and exits", async () => {
    mocks.isolatedSignIn.mockResolvedValue({ user: { uid: "demo-coordinator" } });
    mocks.memberRole = "owner";
    const { onExited } = renderExit();
    await waitFor(() => expect(onExited).toHaveBeenCalledTimes(1));
    expect(mocks.mainSignIn).toHaveBeenCalledWith("someone@demo.fbla2027.test", "fbla2027-demo-2027");
    expect(mocks.isolatedSignIn.mock.invocationCallOrder[0]).toBeLessThan(mocks.mainSignIn.mock.invocationCallOrder[0] ?? 0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
