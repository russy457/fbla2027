/**
 * OnboardingPage.test.tsx
 * The 13+ gate (SPEC#minors G18, D10): birth date is the first question, an
 * under-13 date stops onboarding with the kind parent-or-guardian message,
 * and no account is created. A 13-year-old moves on to account creation.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withFixedNow } from "@fbla/shared";
import { useAuthStore } from "@/store/authStore";
import OnboardingPage from "./OnboardingPage";

const createAccount = vi.fn();
vi.mock("@/lib/authClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/authClient")>();
  return { ...original, createAccount: (email: string, password: string) => createAccount(email, password) };
});

/** Oct 6, 2026, noon in Chicago. */
const TODAY = Date.UTC(2026, 9, 6, 17, 0, 0);

const renderOnboarding = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/onboarding"]}>
        <OnboardingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

const submitBirthDate = async (value: string): Promise<void> => {
  fireEvent.change(screen.getByLabelText("Birth date"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
};

describe("Onboarding 13+ gate", () => {
  beforeEach(() => {
    createAccount.mockReset();
    useAuthStore.setState({ session: { status: "signed-out" } });
  });
  afterEach(() => useAuthStore.setState({ session: { status: "loading" } }));

  it("asks for the birth date first", () => {
    renderOnboarding();
    expect(screen.getByRole("heading", { level: 1, name: "When were you born?" })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 8")).toBeInTheDocument();
  });

  it("stops someone under 13 with kind copy and creates no account", async () => {
    await withFixedNow(TODAY, async () => {
      renderOnboarding();
      await submitBirthDate("2014-01-15");
      expect(await screen.findByRole("heading", { name: "You must be 13 or older to use this app" })).toBeInTheDocument();
      expect(screen.getByText("Ask a parent or guardian about volunteering together.")).toBeInTheDocument();
      expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
      expect(createAccount).not.toHaveBeenCalled();
    });
  });

  it("lets a 13-year-old continue to account creation", async () => {
    await withFixedNow(TODAY, async () => {
      renderOnboarding();
      await submitBirthDate("2013-10-06");
      expect(await screen.findByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    });
  });

  it("explains a future birth date instead of stopping", async () => {
    await withFixedNow(TODAY, async () => {
      renderOnboarding();
      await submitBirthDate("2030-01-01");
      expect(await screen.findByText("A birth date can't be in the future.")).toBeInTheDocument();
    });
  });

  it("can go back from the stop screen to fix a typo", async () => {
    await withFixedNow(TODAY, async () => {
      renderOnboarding();
      await submitBirthDate("2020-01-01");
      fireEvent.click(await screen.findByRole("button", { name: "I entered the wrong date" }));
      expect(await screen.findByRole("heading", { name: "When were you born?" })).toBeInTheDocument();
    });
  });
});
