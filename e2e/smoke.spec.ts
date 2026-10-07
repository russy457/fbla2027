/**
 * smoke.spec.ts
 * First end-to-end check: the landing page and separate Explore route load,
 * and axe finds no serious or critical accessibility violations.
 * Runs with reduced motion so the route fade does not race the axe scan.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("landing and Explore load with headings and no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Make time for good work/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore shifts/ })).toHaveAttribute("href", "/explore");
  await page.goto("/explore");
  await expect(page.getByRole("heading", { level: 1, name: /Find a time that fits your life/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeAttached();

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(blocking.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});

test("unknown routes show the not found screen", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
});
