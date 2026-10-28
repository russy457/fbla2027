/** Live volunteer task: spot an overlapping shift before trying to join. */
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, INSTANCE_ID, PROJECT_ID, seriousAxeViolations, signInWithForm } from "./support/tier0Helpers";

test.skip(!process.env.FIRESTORE_EMULATOR_HOST, "Needs the local Firebase emulators");
test.use({ reducedMotion: "reduce" });
test.setTimeout(120_000);

const CLASH_ID = "schedule-clash-review";

test("shows the existing commitment on Explore and the shift page", async ({ page }) => {
  const app = getApps().find((candidate) => candidate.name === "schedule-clash-review") ?? initializeApp({ projectId: PROJECT_ID }, "schedule-clash-review");
  const db = getFirestore(app);
  const original = (await db.collection("instances").doc(INSTANCE_ID).get()).data() as DocumentData;
  expect(original).toBeTruthy();
  const move = 30 * 60_000;
  await db.collection("instances").doc(CLASH_ID).set({
    ...original,
    title: "Another food shift",
    start: Timestamp.fromMillis(original.start.toMillis() + move),
    end: Timestamp.fromMillis(original.end.toMillis() + move),
    cutoffAt: Timestamp.fromMillis(original.cutoffAt.toMillis() + move),
    finalizeAt: Timestamp.fromMillis(original.finalizeAt.toMillis() + move),
    nextActionAt: Timestamp.fromMillis(original.nextActionAt.toMillis() + move),
    signupCount: 0,
    checkedInCount: 0,
    waitlist: [],
    waitlistSeq: 0
  });

  await signInWithForm(page, ACCOUNTS.volunteer, "/explore");
  await page.goto("/explore");
  const clashButton = page.getByRole("button", { name: "Time conflict: Another food shift" });
  await expect(clashButton).toBeDisabled();
  await expect(page.getByText("You have another shift at this time.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View it" })).toHaveAttribute("href", `/opportunity/${INSTANCE_ID}`);
  expect(await seriousAxeViolations(page)).toEqual([]);

  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate("document.fonts.ready");
    await page.screenshot({ path: `test-results/schedule-conflict/explore-${width}.png`, fullPage: true });
    expect(await page.evaluate("document.documentElement.scrollWidth - innerWidth")).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 375, height: 900 });
  await page.evaluate(() => {
    localStorage.setItem(
      "fbla2027:display-preferences",
      JSON.stringify({ textSize: "150", contrast: "high", motion: "reduced" })
    );
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "150");
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  await expect(page.getByRole("button", { name: "Time conflict: Another food shift" })).toBeDisabled();
  expect(await seriousAxeViolations(page)).toEqual([]);
  expect(await page.evaluate("document.documentElement.scrollWidth - innerWidth")).toBeLessThanOrEqual(1);
  await page.getByRole("link", { name: "View it" }).focus();
  await expect(page.getByRole("link", { name: "View it" })).toBeFocused();
  await page.screenshot({ path: "test-results/schedule-conflict/explore-375-large-text.png", fullPage: true });

  await page.goto(`/opportunity/${CLASH_ID}`);
  await expect(page.getByRole("button", { name: "Time conflict: Another food shift" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "View it" })).toHaveAttribute("href", `/opportunity/${INSTANCE_ID}`);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `test-results/schedule-conflict/opportunity-${width}.png`, fullPage: true });
    expect(await page.evaluate("document.documentElement.scrollWidth - innerWidth")).toBeLessThanOrEqual(1);
  }
});
