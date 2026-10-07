/**
 * VerifyPage.test.tsx
 * /verify states (SPEC#letters, D3): the status band comes first with icon
 * and text for valid, superseded, and revoked letters; display name, hours,
 * range, orgs, issue date, and code follow; malformed codes are answered
 * without a lookup; unknown codes get the SPEC's not-found sentence.
 */
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LetterVerification } from "@/lib/data/records";
import { ts } from "@/test/fixtures";
import VerifyPage, { MALFORMED_MESSAGE, NOT_FOUND_MESSAGE } from "./VerifyPage";

const getLetterVerification = vi.fn();
vi.mock("@/lib/data/records", () => ({ getLetterVerification: (code: string) => getLetterVerification(code) }));

const CODE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ISSUED_MS = Date.UTC(2026, 9, 17, 17, 0, 0);

const verification = (overrides: Partial<LetterVerification> = {}): LetterVerification => ({
  id: CODE,
  displayName: "Jordan R.",
  orgNames: ["Alamo Community Pantry"],
  totalMinutes: 135,
  from: "2026-08-01",
  to: "2026-10-17",
  issuedAt: ts(ISSUED_MS),
  status: "valid",
  supersededByIssuedAt: null,
  revokeReasonLabel: null,
  ...overrides
});

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/verify/:code" element={<VerifyPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("VerifyPage", () => {
  beforeEach(() => getLetterVerification.mockReset());

  it("shows Valid first, then the letter facts", async () => {
    getLetterVerification.mockResolvedValue(verification());
    renderAt(`/verify/${CODE}`);
    const band = await screen.findByRole("status");
    expect(band).toHaveTextContent("Valid");
    expect(band).toHaveTextContent("This letter is current.");
    expect(screen.getByText("Jordan R.")).toBeInTheDocument();
    expect(screen.getByText("2.25 hours")).toBeInTheDocument();
    expect(screen.getByText("Aug 1, 2026 to Oct 17, 2026")).toBeInTheDocument();
    expect(screen.getByText("Alamo Community Pantry")).toBeInTheDocument();
    expect(screen.getByText("Oct 17, 2026")).toBeInTheDocument();
    expect(screen.getByText("ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What this means" })).toBeInTheDocument();
    // The band precedes the facts in reading order.
    expect(band.compareDocumentPosition(screen.getByText("Jordan R.")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("explains a superseded letter with the newer issue date", async () => {
    getLetterVerification.mockResolvedValue(verification({ status: "superseded", supersededByIssuedAt: ts(Date.UTC(2026, 9, 20, 17)) }));
    renderAt(`/verify/${CODE}`);
    const band = await screen.findByRole("status");
    expect(band).toHaveTextContent("Superseded");
    expect(band).toHaveTextContent("A newer letter was issued on Oct 20, 2026.");
  });

  it("explains a superseded letter whose hours changed", async () => {
    getLetterVerification.mockResolvedValue(verification({ status: "superseded" }));
    renderAt(`/verify/${CODE}`);
    expect(await screen.findByRole("status")).toHaveTextContent("The hours on this letter changed after it was issued.");
  });

  it("shows a revoked letter with the public reason label only", async () => {
    getLetterVerification.mockResolvedValue(verification({ status: "revoked", revokeReasonLabel: "Hours disputed" }));
    renderAt(`/verify/${CODE}`);
    const band = await screen.findByRole("status");
    expect(band).toHaveTextContent("Revoked");
    expect(band).toHaveTextContent("This letter was revoked: Hours disputed.");
  });

  it("normalizes a printed code with dashes and lowercase before looking it up", async () => {
    getLetterVerification.mockResolvedValue(verification());
    renderAt("/verify/abcd-efgh-ijkl-mnop-qrst-uvwx-yz");
    await screen.findByRole("status");
    expect(getLetterVerification).toHaveBeenCalledWith(CODE);
  });

  it("answers a malformed code without a lookup", () => {
    renderAt("/verify/not-a-code");
    expect(screen.getByText(MALFORMED_MESSAGE)).toBeInTheDocument();
    expect(getLetterVerification).not.toHaveBeenCalled();
  });

  it("says when no letter has the code", async () => {
    getLetterVerification.mockResolvedValue(null);
    renderAt(`/verify/${CODE}`);
    expect(await screen.findByText(NOT_FOUND_MESSAGE)).toBeInTheDocument();
  });

  it("offers a code box on /verify", () => {
    renderAt("/verify");
    expect(screen.getByLabelText("Letter code")).toBeInTheDocument();
  });
});
