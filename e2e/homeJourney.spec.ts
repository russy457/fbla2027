import { expect, test } from "@playwright/test";

test("home stories and the bike advance with scroll, then release the page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const journey = page.locator(".home-journey");
  await expect(journey).toBeVisible();
  const box = await journey.boundingBox();
  expect(box).not.toBeNull();
  const scrollY = (await page.evaluate("window.scrollY")) as number;
  const top = (box?.y ?? 0) + scrollY;
  const travel = (box?.height ?? 0) - 900;
  await page.evaluate("document.documentElement.style.scrollBehavior = 'auto'");

  const bikePositions: number[] = [];
  for (const [fraction, heading] of [[0.12, "Food banks"], [0.5, "Green spaces"], [0.88, "Youth programs"]] as const) {
    await page.evaluate(`window.scrollTo(0, ${top + travel * fraction})`);
    await expect(journey.locator(".home-journey__story.is-active h3")).toHaveText(heading);
    bikePositions.push((await journey.locator(".home-journey__bike").boundingBox())?.x ?? 0);
  }
  expect(bikePositions[0]).toBeLessThan(bikePositions[1] ?? 0);
  expect(bikePositions[1]).toBeLessThan(bikePositions[2] ?? 0);

  await page.evaluate(`window.scrollTo(0, ${top + (box?.height ?? 0) + 100})`);
  await expect(page.getByRole("heading", { name: "Join in." })).toBeVisible();
});

test("story steps work by keyboard and retain the matching cause link", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const journey = page.locator(".home-journey");
  const first = journey.getByRole("button", { name: "Show Food banks" });
  await first.focus();
  const last = journey.getByRole("button", { name: "Show Youth programs" });
  await last.focus();
  await last.press("Enter");
  await expect(last).toHaveAttribute("aria-current", "step");
  await expect(journey.getByRole("link", { name: "Find learning shifts" })).toHaveAttribute("href", "/explore?cause=education-youth");
});

test("reduced motion shows every story in the normal page flow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const journey = page.locator(".home-journey");
  await expect(journey).toHaveClass(/home-journey--static/);
  await expect(journey.getByRole("link")).toHaveCount(3);
  await expect(journey.getByRole("navigation", { name: "Story steps" })).toHaveCount(0);
});
