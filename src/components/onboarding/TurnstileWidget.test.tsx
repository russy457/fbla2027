import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readClientEnv, type ClientEnv } from "@/lib/env";
import { TurnstileWidget } from "./TurnstileWidget";

vi.mock("@/lib/env", () => ({ readClientEnv: vi.fn() }));

const clientEnv = (localFunctions: boolean): ClientEnv => ({
  VITE_FIREBASE_API_KEY: "test-key",
  VITE_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "test-project",
  VITE_FIREBASE_STORAGE_BUCKET: "test.firebasestorage.app",
  VITE_FIREBASE_APP_ID: "test-app",
  VITE_USE_EMULATORS: false,
  VITE_FUNCTIONS_EMULATOR: localFunctions,
  VITE_STORAGE_EMULATOR: localFunctions,
  VITE_TURNSTILE_SITE_KEY: undefined,
  VITE_MAPBOX_TOKEN: undefined,
  VITE_APPCHECK_SITE_KEY: undefined,
  VITE_APPCHECK_DEBUG_TOKEN: undefined
});

describe("onboarding human check", () => {
  beforeEach(() => vi.mocked(readClientEnv).mockReset());

  it("lets the cloud Firestore demo finish when its local Functions server skips verification", async () => {
    vi.mocked(readClientEnv).mockReturnValue({ ok: true, env: clientEnv(true) });
    const onStatus = vi.fn();
    render(<TurnstileWidget onToken={vi.fn()} onStatus={onStatus} />);

    expect(await screen.findByText("Human check skipped for this local demo.")).toBeInTheDocument();
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("skipped"));
    expect(document.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();
  });

  it("still requires a configured human check for a deployed Functions server", async () => {
    vi.mocked(readClientEnv).mockReturnValue({ ok: true, env: clientEnv(false) });
    const onStatus = vi.fn();
    render(<TurnstileWidget onToken={vi.fn()} onStatus={onStatus} />);

    expect(await screen.findByText(/We couldn't load the human check/)).toBeInTheDocument();
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("unavailable"));
  });
});
