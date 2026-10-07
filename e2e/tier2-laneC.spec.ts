/**
 * tier2-laneC.spec.ts
 * Tier 2 lane C end-to-end checks:
 *   1. Ctrl+K opens the command palette from anywhere, the keyboard picks a
 *      result, and Enter navigates (focus moves into the new screen);
 *      the "?" quick-help shortcut still works and the palette never opens
 *      on top of it,
 *   2. the header bell menu lists the demo volunteer's seeded unread alerts
 *      (SPEC 10.7: two hours-approved alerts), Esc returns focus to the bell,
 *      and Mark all read clears the count,
 *   3. Explore with the palette open has zero serious or critical axe
 *      violations.
 * Needs the emulators and the demo seed; skipped without them. The alerts
 * are reset to unread first so the spec does not depend on run order.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect as baseExpect, test } from "@playwright/test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ACCOUNTS, PROJECT_ID, signInWithForm } from "./support/tier0Helpers";

const expect = baseExpect.configure({ timeout: 30_000 });
const VOLUNTEER_UID = "demo-volunteer";
const SEEDED_ALERT_PREFIX = "hours-approved_";

test.skip(!process.env.FIRESTORE_EMULATOR_HOST, "Needs the emulators and the demo seed");
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);
test.use({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });

/** Marks the seeded hours-approved alerts unread again (emulator Admin SDK, like the other e2e fixtures). */
const resetSeededAlertsToUnread = async (): Promise<number> => {
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: PROJECT_ID }));
  const items = await db.collection(`notifications/${VOLUNTEER_UID}/items`).get();
  const seeded = items.docs.filter((item) => item.id.startsWith(SEEDED_ALERT_PREFIX));
  await Promise.all(seeded.map((item) => item.ref.update({ read: false })));
  return seeded.length;
};

test("Ctrl+K opens the command palette and navigates with the keyboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Explore" })).toBeVisible();

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Search and jump" });
  await expect(palette).toBeVisible();
  const field = palette.getByRole("combobox");
  await expect(field).toBeFocused();

  await field.pressSequentially("verify");
  const firstOption = palette.getByRole("option").first();
  await expect(firstOption).toContainText("Verify a letter");
  await expect(firstOption).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(palette).toBeHidden();
  await expect(page).toHaveURL(/\/verify$/);
  await expect(page.getByRole("heading", { level: 1, name: /Verify/ })).toBeVisible();
  // The layout moves focus to the new screen (its h1, or <main> while a lazy screen loads), never <body>.
  await expect(page.locator("#main:focus, #main h1:focus")).toHaveCount(1);

  // Arrow keys reach a help article; the header button opens the palette too.
  await page.getByRole("button", { name: "Search" }).click();
  await palette.getByRole("combobox").pressSequentially("kiosk");
  const helpGroup = palette.getByRole("group", { name: "Help articles" });
  await expect(helpGroup.getByRole("option").first()).toBeVisible();
  const helpTitle = (await helpGroup.getByRole("option").first().locator("span.font-medium").textContent()) ?? "";
  const helpId = await helpGroup.getByRole("option").first().getAttribute("id");
  for (let press = 0; press < 20 && (await palette.getByRole("combobox").getAttribute("aria-activedescendant")) !== helpId; press += 1) {
    await page.keyboard.press("ArrowDown");
  }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/help\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: helpTitle })).toBeVisible();

  // "?" still opens quick help, and Ctrl+K does not stack a second modal on it.
  // Focus is on the article's heading (not a text field), so "?" is the shortcut, not a typed character.
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Quick help" })).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(palette).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Quick help" })).toBeHidden();
});

test("the bell menu shows the seeded unread alerts and marks them read", async ({ page }) => {
  expect(await resetSeededAlertsToUnread()).toBeGreaterThanOrEqual(2);
  await signInWithForm(page, ACCOUNTS.volunteer, "/");

  const bell = page.getByRole("button", { name: /^Notifications, \d+ unread$/ });
  await expect(bell).toBeVisible();
  await bell.click();
  const menu = page.getByRole("dialog", { name: "Notifications" });
  await expect(menu).toBeVisible();
  const list = menu.getByRole("listbox", { name: "Latest alerts" });
  await expect(list).toBeFocused();
  await expect(list.getByRole("option").filter({ hasText: /hours approved at/ })).toHaveCount(2);
  await expect(list.getByText("New").first()).toBeVisible();

  // Esc closes and returns focus to the bell.
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(bell).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Mark all read" }).click();
  await expect(menu.getByText("All caught up.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Mark all read" })).toBeDisabled();

  await menu.getByRole("link", { name: "See all notifications" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await expect(menu).toBeHidden();
});

test("Explore with the command palette open has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Explore" })).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Search and jump" })).toBeVisible();
  await page.getByRole("combobox").pressSequentially("pantry");
  await expect(page.getByRole("option").first()).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(blocking.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(" ")).join(", ")})`)).toEqual([]);
});
