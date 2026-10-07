/**
 * AssistantPanel.test.tsx
 * The Ask box for signed-in people (SPEC 9.6, D7, 12.1 "assistant panel"):
 * the AI label and cited article links, the From Help Center label and the
 * limit copy for fallbacks, model text rendered as text (never HTML), the
 * error fallback, and the finish-your-profile path. The op is a fake.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AskAssistantOutput } from "@fbla/shared";
import { createFixtureLibrary } from "@/lib/help/testFixtures";
import { ApiError, NETWORK_USER_ERROR } from "@/lib/api";
import { AssistantPanel, type AskAssistantFn } from "./AssistantPanel";
import type { AssistantAccess } from "./useAssistantAccess";

const library = createFixtureLibrary();

const renderPanel = (ask: AskAssistantFn, access: AssistantAccess = "ready") =>
  render(
    <MemoryRouter initialEntries={["/me/shifts"]}>
      <AssistantPanel library={library} ask={ask} access={access} />
    </MemoryRouter>
  );

const askQuestion = (text = "when does check-in open") => {
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
};

const result = (overrides: Partial<AskAssistantOutput>): AskAssistantOutput => ({
  answer: "Check-in opens 30 minutes before the shift.",
  source: "ai",
  limited: false,
  articles: [{ slug: "kiosk-check-in", title: "Checking in with the kiosk code" }],
  ...overrides
});

describe("AssistantPanel (signed in)", () => {
  it("sends the question and route, then shows the AI label, the answer, and its sources", async () => {
    const ask = vi.fn<AskAssistantFn>(async () => result({}));
    renderPanel(ask);
    askQuestion();
    expect(await screen.findByText("AI answer, may be wrong")).toBeInTheDocument();
    expect(ask).toHaveBeenCalledWith({ question: "when does check-in open", route: "/me/shifts" });
    expect(screen.getByText("Check-in opens 30 minutes before the shift.")).toBeInTheDocument();
    const sources = screen.getByRole("list", { name: "Cited help articles" });
    expect(within(sources).getByRole("link")).toHaveAttribute("href", "/help/kiosk-check-in");
    expect(screen.queryByRole("link", { name: "Sign in to ask" })).not.toBeInTheDocument();
  });

  it("renders model output as text, never as HTML", async () => {
    renderPanel(async () => result({ answer: "<img src=x onerror=alert(1)> Open My Shifts." }));
    askQuestion();
    expect(await screen.findByText("<img src=x onerror=alert(1)> Open My Shifts.")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("labels server fallbacks From Help Center and shows the limit copy", async () => {
    const limitCopy = "You've reached today's assistant limit; here are matching help articles.";
    renderPanel(async () => result({ source: "help", limited: true, answer: limitCopy }));
    askQuestion();
    expect(await screen.findByText("From Help Center")).toBeInTheDocument();
    expect(screen.getByText(limitCopy)).toBeInTheDocument();
  });

  it("drops cited slugs that are not bundled articles", async () => {
    renderPanel(async () => result({ articles: [{ slug: "not-an-article", title: "Ghost" }] }));
    askQuestion();
    await screen.findByText("AI answer, may be wrong");
    expect(screen.queryByRole("list", { name: "Cited help articles" })).not.toBeInTheDocument();
  });

  it("falls back to Help Center articles when the call fails", async () => {
    renderPanel(async () => Promise.reject(new ApiError(NETWORK_USER_ERROR)));
    askQuestion("how do I check in with a code");
    expect(await screen.findByText(/We couldn't reach the server/)).toBeInTheDocument();
    expect(screen.getByText("From Help Center")).toBeInTheDocument();
  });

  it("never calls the server for an empty question", () => {
    const ask = vi.fn<AskAssistantFn>();
    renderPanel(ask);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByText(/Type a question first/)).toBeInTheDocument();
    expect(ask).not.toHaveBeenCalled();
  });
});

describe("AssistantPanel (not ready)", () => {
  it("asks people without a finished profile to finish it, and answers locally", () => {
    const ask = vi.fn<AskAssistantFn>();
    renderPanel(ask, "needs-profile");
    askQuestion("how do I check in with a code");
    expect(screen.getByText("From Help Center")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Finish your profile" })).toHaveAttribute("href", "/onboarding?next=%2Fme%2Fshifts");
    expect(ask).not.toHaveBeenCalled();
  });
});
