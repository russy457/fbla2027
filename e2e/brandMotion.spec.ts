import { expect, test } from "@playwright/test";

test("the Tandem bike appears in the shell and stays still when motion is reduced", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Show up." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tandem", exact: true }).locator("svg.tandem-bike")).toBeVisible();

  await page.evaluate("window.scrollTo(0, 500)");
  await expect(page.locator(".site-header")).toHaveAttribute("data-condensed", "true");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Explore" })).toBeVisible();

  await page.goto("/help");
  await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tandem home" }).locator("svg.tandem-bike")).toBeVisible();

  await page.evaluate("document.documentElement.dataset.motion = 'reduced'");
  const animationName = await page.evaluate("getComputedStyle(document.querySelector('.site-footer__brand .tandem-bike')).animationName");
  expect(animationName).toBe("none");
});

test("the route loading state uses the bike and a readable label", async ({ page }) => {
  await page.route(/\/src\/pages\/HelpPage\.tsx/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    await route.continue();
  });
  await page.goto("/help", { waitUntil: "domcontentloaded" });
  const loading = page.locator(".interior-scene__loading");
  await expect(loading).toBeVisible();
  await expect(loading.locator(".loading-state__label")).toHaveText("Loading this screen");
  await expect(loading.locator("svg.tandem-bike")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.evaluate("getComputedStyle(document.querySelector('.interior-scene__loading svg.tandem-bike')).animationName")).toBe("none");
  await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();
});
