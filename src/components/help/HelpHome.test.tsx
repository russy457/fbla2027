/**
 * HelpHome.test.tsx
 * Component tests for the /help page: search results with highlighted
 * terms, the announced result count, the "No articles match" empty state,
 * the topic index, and the Ask box for visitors (help articles plus
 * "Sign in to ask"; the signed-in assistant is in AssistantPanel.test.tsx).
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "@/store/authStore";
import { createFixtureLibrary } from "@/lib/help/testFixtures";
import HelpPage from "@/pages/HelpPage";

const library = createFixtureLibrary();

beforeEach(() => {
  useAuthStore.setState({ session: { status: "signed-out" } });
});

const renderHelp = (path = "/help") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/help" element={<HelpPage library={library} />} />
        <Route path="/help/:slug" element={<HelpPage library={library} />} />
      </Routes>
    </MemoryRouter>
  );

const typeQuery = (value: string) =>
  fireEvent.change(screen.getByLabelText("Search help articles"), { target: { value } });

describe("Help Center home", () => {
  it("shows topics grouped by audience before any search", () => {
    renderHelp();
    expect(screen.getByRole("heading", { level: 1, name: "Help Center" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Volunteering" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Running shifts" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("lists ranked results with matched words highlighted and announces the count", () => {
    renderHelp();
    typeQuery("letter ");
    const results = screen.getByRole("list", { name: "Search results" });
    const firstLink = within(results).getAllByRole("link")[0]!;
    expect(firstLink).toHaveAttribute("href", "/help/verified-letters");
    expect(within(firstLink).getAllByText("letter", { selector: "mark" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent(/article(s)? match/);
  });

  it("reads the query from the URL", () => {
    renderHelp("/help?q=contrast");
    expect(screen.getByLabelText("Search help articles")).toHaveValue("contrast");
    expect(screen.getByRole("status")).toHaveTextContent("1 article matches.");
  });

  it("shows the empty state and the topic index when nothing matches", () => {
    renderHelp();
    typeQuery("<b>zzqx</b>");
    expect(screen.getByRole("status")).toHaveTextContent("No articles match.");
    // The typed text is shown literally, never parsed as markup.
    expect(screen.getByText("<b>zzqx</b>")).toBeInTheDocument();
    expect(document.querySelector("b")).toBeNull();
    expect(screen.getByRole("heading", { name: "Using the app" })).toBeInTheDocument();
  });

  it("clears the search with the Clear button", () => {
    renderHelp();
    typeQuery("kiosk");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByLabelText("Search help articles")).toHaveValue("");
  });

  it("answers a question from help articles with the From Help Center label", () => {
    renderHelp();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "how do I check in with a code" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByText("From Help Center")).toBeInTheDocument();
    const answers = screen.getByRole("list", { name: "Suggested answers" });
    expect(within(answers).getAllByRole("link")[0]).toHaveAttribute("href", "/help/kiosk-check-in");
    expect(screen.getByRole("link", { name: "Sign in to ask" })).toHaveAttribute("href", "/login?next=%2Fhelp");
  });

  it("shows the counter near the limit and blocks questions that are too long", () => {
    renderHelp();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "a".repeat(2001) } });
    expect(screen.getByText("2,001 of 2,000 characters")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Keep it under 2,000 characters.");
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
  });

  it("tells the user when a question matches nothing or is empty", () => {
    renderHelp();
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByText(/Type a question first/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "qqqq zzzz" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByText(/Try other words/)).toBeInTheDocument();
  });
});

describe("Help article page", () => {
  it("renders the article body safely with related links", () => {
    renderHelp("/help/kiosk-check-in");
    expect(screen.getByRole("heading", { level: 1, name: "Checking in with the kiosk code" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Check in" })).toBeInTheDocument();
    expect(screen.getByText("My Shifts", { selector: "strong span" })).toBeInTheDocument();
    const related = screen.getByRole("navigation", { name: "Related articles" });
    expect(within(related).getByRole("link")).toHaveAttribute("href", "/help/verified-letters");
  });

  it("shows a friendly message for an unknown slug", () => {
    renderHelp("/help/does-not-exist");
    expect(screen.getByRole("heading", { name: "We couldn't find that article" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All help topics" })).toHaveAttribute("href", "/help");
  });
});
