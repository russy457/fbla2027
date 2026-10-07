/**
 * assistantLegal.spec.ts
 * Tier 1 lane C end-to-end checks:
 *   1. legal pages: the footer links reach Privacy, Terms, and the
 *      Accessibility statement, each with its heading, the minors section,
 *      and no serious axe violations (runs with or without emulators),
 *   2. the assistant: a signed-in volunteer opens Quick help from the
 *      header, asks a question, and gets the deterministic fallback answer
 *      (AI is off on the emulators) labeled "From Help Center" with cited
 *      article links; a visitor sees "Sign in to ask" (needs the emulators).
 */
import { expect as baseExpect, test } from "@playwright/test";
import { ACCOUNTS, seriousAxeViolations, signInWithForm } from "./support/tier0Helpers";

const expect = baseExpect.configure({ timeout: 30_000 });
test.use({ reducedMotion: "reduce" });

const LEGAL_PAGES = [
  { link: "Privacy", path: "/privacy", heading: "Privacy policy" },
  { link: "Terms", path: "/terms", heading: "Terms of use" },
  { link: "Accessibility", path: "/accessibility", heading: "Accessibility statement" }
] as const;

test("footer links open each legal page", async ({ page }) => {
  await page.goto("/help");
  for (const legal of LEGAL_PAGES) {
    await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: legal.link, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${legal.path}$`));
    await expect(page.getByRole("heading", { level: 1, name: legal.heading })).toBeVisible();
    expect(await seriousAxeViolations(page)).toEqual([]);
  }
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /minors/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /How long we keep data/i })).toBeVisible();
});

test.describe("help assistant", () => {
  test.skip(!process.env.FIRESTORE_EMULATOR_HOST, "Needs the emulators: run the e2e under firebase emulators:exec");

  test("a visitor is asked to sign in", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("link", { name: "Sign in to ask" })).toBeVisible();
  });

  test("a signed-in volunteer asks from the header and gets cited help articles", async ({ page }) => {
    await signInWithForm(page, ACCOUNTS.volunteer, "/me/shifts");
    await page.goto("/me/shifts");
    await page.getByRole("button", { name: /Quick help/ }).click();
    const dialog = page.getByRole("dialog", { name: "Quick help" });
    await expect(dialog.getByText("The assistant answers from Help Center articles and links its sources.")).toBeVisible();
    await dialog.getByLabel("Your question").fill("When does check-in open before my shift?");
    await dialog.getByRole("button", { name: "Ask", exact: true }).click();

    const answer = dialog.getByTestId("assistant-answer");
    await expect(answer.getByText("From Help Center")).toBeVisible();
    await expect(answer.getByText("These Help Center articles best match your question.")).toBeVisible();
    const cited = answer.getByRole("list", { name: "Cited help articles" }).getByRole("button");
    await expect(cited).toHaveCount(3);
    await expect(answer.getByRole("list", { name: "Cited help articles" })).toContainText("Checking in with the kiosk code");
  });
});
