import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EnvValidationError } from "@fbla/shared";
import { DevEnvironmentBanner, describeEnvProblem, describeProbeProblem } from "./DevEnvironmentBanner";
import { parseClientEnv, type ClientEnvResult } from "@/lib/env";

const VALID_ENV: ClientEnvResult = {
  ok: true,
  env: parseClientEnv({
    VITE_FIREBASE_API_KEY: "demo-key",
    VITE_FIREBASE_AUTH_DOMAIN: "demo-fbla2027.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "demo-fbla2027",
    VITE_FIREBASE_STORAGE_BUCKET: "demo-fbla2027.appspot.com",
    VITE_FIREBASE_APP_ID: "demo-app",
    VITE_USE_EMULATORS: "true"
  })
};

describe("DevEnvironmentBanner", () => {
  it("tells the developer which emulator port is down", async () => {
    const probe = vi.fn(async () => ({ reachable: false, unreachable: [{ service: "firestore" as const, port: 8080 }] }));
    render(<DevEnvironmentBanner envResult={VALID_ENV} probe={probe} />);
    expect(await screen.findByText("Emulators not reachable on :8080, run npm run demo")).toBeInTheDocument();
  });

  it("renders nothing when the emulators answer", async () => {
    const probe = vi.fn(async () => ({ reachable: true, unreachable: [] }));
    const { container } = render(<DevEnvironmentBanner envResult={VALID_ENV} probe={probe} />);
    await vi.waitFor(() => expect(probe).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("names missing env variables without probing", () => {
    const probe = vi.fn();
    const error = new EnvValidationError([{ variable: "VITE_FIREBASE_PROJECT_ID", problem: "missing" }], ".env.example");
    render(<DevEnvironmentBanner envResult={{ ok: false, error }} probe={probe} />);
    expect(screen.getByRole("status")).toHaveTextContent("VITE_FIREBASE_PROJECT_ID");
    expect(probe).not.toHaveBeenCalled();
  });

  it("reports a failed probe", async () => {
    const probe = vi.fn(async () => {
      throw new Error("network");
    });
    render(<DevEnvironmentBanner envResult={VALID_ENV} probe={probe} />);
    expect(await screen.findByText(/npm run doctor/)).toBeInTheDocument();
  });
});

describe("banner copy helpers", () => {
  it("lists several unreachable ports", () => {
    expect(
      describeProbeProblem({
        reachable: false,
        unreachable: [
          { service: "auth", port: 9099 },
          { service: "functions", port: 5001 }
        ]
      })
    ).toBe("Emulators not reachable on :9099, :5001, run npm run demo");
  });

  it("explains a generic env error", () => {
    expect(describeEnvProblem(new Error("Bad config."))).toContain("Copy .env.example to .env.local");
  });
});
