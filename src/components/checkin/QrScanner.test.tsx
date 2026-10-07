/**
 * QrScanner.test.tsx
 * SPEC#screen-kiosk-states "Scanner (Tier 1)" and D20: camera denied falls
 * back to typing with "Camera blocked. Type the code instead." and focus in
 * the code field; no readable code within 10 s falls back the same way;
 * "Scan QR" and the kiosk QR render only in a secure context (G20).
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KioskQr } from "@/components/kiosk/KioskQr";
import { MINUTE, SHIFT_START_MS, makeInstance, makeSignup } from "@/test/fixtures";
import { CheckInPanel } from "./CheckInPanel";
import { CAMERA_BLOCKED_MESSAGE, QR_UNREADABLE_MESSAGE, QrScanner, SCAN_TIMEOUT_MS } from "./QrScanner";

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, api: { kiosk: { checkIn: vi.fn(), checkOut: vi.fn() } } };
});

const setSecure = (secure: boolean): void => {
  Object.defineProperty(window, "isSecureContext", { value: secure, configurable: true });
};
const setCamera = (getUserMedia: (() => Promise<MediaStream>) | undefined): void => {
  Object.defineProperty(navigator, "mediaDevices", { value: getUserMedia ? { getUserMedia } : undefined, configurable: true });
};
const denied = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));

const renderPanel = () =>
  render(
    <MemoryRouter>
      <CheckInPanel instance={makeInstance()} signup={makeSignup()} nowMs={SHIFT_START_MS - 10 * MINUTE} onCheckedOut={() => undefined} />
    </MemoryRouter>
  );

describe("QR check-in", () => {
  beforeEach(() => setSecure(true));
  afterEach(() => {
    vi.useRealTimers();
    setCamera(undefined);
  });

  it("falls back to the typed code with focus when the camera is blocked", async () => {
    setCamera(denied);
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    fireEvent.click(screen.getByRole("button", { name: "Scan QR" }));
    expect(await screen.findByText(CAMERA_BLOCKED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText("Check in code")).toHaveFocus();
  });

  it("falls back after 10 seconds without a readable code", async () => {
    vi.useFakeTimers();
    setCamera(() => new Promise(() => undefined));
    const onFallback = vi.fn();
    render(<QrScanner instanceId="shift-1" onCode={vi.fn()} onFallback={onFallback} />);
    expect(screen.getByLabelText(/Camera view/)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(SCAN_TIMEOUT_MS);
    });
    expect(onFallback).toHaveBeenCalledWith(QR_UNREADABLE_MESSAGE);
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it("falls back when the browser has no camera API at all", async () => {
    setCamera(undefined);
    const onFallback = vi.fn();
    render(<QrScanner instanceId="shift-1" onCode={vi.fn()} onFallback={onFallback} />);
    await act(async () => undefined);
    expect(onFallback).toHaveBeenCalledWith(CAMERA_BLOCKED_MESSAGE);
  });

  it("hides Scan QR and the kiosk QR outside a secure context", () => {
    setSecure(false);
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    expect(screen.queryByRole("button", { name: "Scan QR" })).toBeNull();
    const { container } = render(<KioskQr payload="https://pitchin.example/checkin?i=a&c=123456" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the kiosk QR in a secure context", () => {
    render(<KioskQr payload="https://pitchin.example/checkin?i=a&c=123456" />);
    expect(screen.getByTestId("kiosk-qr")).toBeInTheDocument();
  });
});
