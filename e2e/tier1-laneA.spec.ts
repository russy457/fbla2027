/**
 * tier1-laneA.spec.ts
 * Tier 1 lane A end-to-end checks (SPEC#tests 12.2):
 *   1. keyboard only, a volunteer joins a full shift's waitlist; when the
 *      confirmed volunteer cancels, the promotion notification arrives (header
 *      badge) and the banner offers Confirm / Can't make it; Confirm clears it,
 *   2. camera denied: the in-app scanner falls back to the typed code with
 *      "Camera blocked. Type the code instead." and focus in the code field,
 *   3. Tier 0 screens at 150% text + high contrast at 375 px have no
 *      horizontal overflow,
 *   4. reduced motion (OS setting and the in-app toggle) zeroes the motion
 *      tokens.
 * Needs the emulators and the demo seed (same as the Tier 0 gate); skipped
 * without them. Run after tier0.spec.ts in one worker (npm run test:e2e:tier1a).
 */
import { expect as baseExpect, test, type Locator, type Page } from "@playwright/test";
import { ACCOUNTS, INSTANCE_ID, signInWithForm } from "./support/tier0Helpers";
import { callOpAs, cloneShift } from "./support/laneAHelpers";

const expect = baseExpect.configure({ timeout: 30_000 });

test.skip(!process.env.FIRESTORE_EMULATOR_HOST, "Needs the emulators: run npm run test:e2e:tier1a");
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

/** Presses Tab until `target` has focus (keyboard only). */
const tabTo = async (page: Page, target: Locator, maxTabs = 120): Promise<void> => {
  for (let press = 0; press < maxTabs; press += 1) {
    const isFocused = await target.evaluate((element) => (element as unknown as { matches(selector: string): boolean }).matches(":focus")).catch(() => false);
    if (isFocused) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Could not reach the element with the Tab key.");
};

const WAITLIST_SHIFT = { id: "lanea-waitlist", title: "Restock the pantry shelves" };
const CHECKIN_SHIFT = { id: "lanea-checkin", title: "Greet families at the market" };

test("keyboard-only waitlist signup, then promotion notification and banner", async ({ browser }) => {
  // A full shift three days out: Sam holds the only seat.
  await cloneShift({ ...WAITLIST_SHIFT, startsInMin: 3 * 24 * 60, capacity: 1 });
  await callOpAs(ACCOUNTS.minor, "volunteer", "signup", { instanceId: WAITLIST_SHIFT.id });

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await signInWithForm(page, ACCOUNTS.volunteer, "/");
  // The search box narrows Explore to this shift (filters live in the URL).
  await page.goto(`/?q=${encodeURIComponent("Restock pantry")}`);
  const join = page.getByRole("button", { name: `Join waitlist (#1): ${WAITLIST_SHIFT.title}` });
  await expect(join).toBeVisible();
  await tabTo(page, join);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Waitlisted #1 of 1")).toBeVisible();
  await expect(page.getByRole("link", { name: "Notifications" })).toBeVisible();

  // Sam cancels; the head of the waitlist (Jordan) is promoted in the same transaction.
  await callOpAs(ACCOUNTS.minor, "volunteer", "cancelSignup", { signupId: `${WAITLIST_SHIFT.id}_demo-minor` });

  await expect(page.getByRole("link", { name: /^Notifications, \d+ unread$/ })).toBeVisible();
  const banner = page.getByRole("region", { name: "Updates about your shifts" });
  await expect(banner.getByText(/^You're in! /)).toBeVisible();
  await expect(banner.getByRole("button", { name: "Confirm" })).toBeVisible();
  await expect(banner.getByRole("button", { name: "Can't make it" })).toBeVisible();
  await expect(page.getByText("Signed up", { exact: true })).toBeVisible();

  // Keyboard again: Confirm marks the alert read; the banner and the badge clear.
  await tabTo(page, banner.getByRole("button", { name: "Confirm" }));
  await page.keyboard.press("Enter");
  await expect(banner.getByText(/^You're in! /)).toHaveCount(0);

  await page.getByRole("link", { name: /^Notifications/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await expect(page.getByText(/^You're in! /)).toBeVisible();
  await context.close();
});

test("camera denied falls back to the typed code with focus", async ({ browser }) => {
  await cloneShift({ ...CHECKIN_SHIFT, startsInMin: 10, capacity: 5 });
  await callOpAs(ACCOUNTS.volunteer, "volunteer", "signup", { instanceId: CHECKIN_SHIFT.id });

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  // The camera prompt is answered "Block" (NotAllowedError), as a person would on the phone.
  await context.addInitScript(() => {
    const media = (navigator as unknown as { mediaDevices?: { getUserMedia: unknown } }).mediaDevices;
    if (media) media.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });
  const page = await context.newPage();
  await signInWithForm(page, ACCOUNTS.volunteer, "/");
  // The link the kiosk QR encodes, opened directly.
  await page.goto(`/checkin?i=${CHECKIN_SHIFT.id}&c=123456`);
  await expect(page.getByRole("heading", { level: 1, name: `Check in: ${CHECKIN_SHIFT.title}` })).toBeVisible();
  await expect(page.getByLabel("Check in code")).toHaveValue("123456");
  await page.getByRole("button", { name: "Scan QR" }).click();
  await expect(page.getByText("Camera blocked. Type the code instead.")).toBeVisible();
  await expect(page.getByLabel("Check in code")).toBeFocused();
  await context.close();
});

/** True when the page scrolls sideways (content wider than the viewport). */
const hasHorizontalOverflow = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const root = (globalThis as unknown as { document: { documentElement: { scrollWidth: number; clientWidth: number } } }).document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });

test("150% text + high contrast: Tier 0 screens have no horizontal overflow at 375 px", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  await context.addInitScript(() => {
    (globalThis as unknown as { localStorage: { setItem(key: string, value: string): void } }).localStorage.setItem(
      "fbla2027:display-preferences",
      JSON.stringify({ textSize: "150", contrast: "high", motion: "system" })
    );
  });
  const page = await context.newPage();
  const check = async (path: string, heading: RegExp | string): Promise<void> => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "150");
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
    expect(await hasHorizontalOverflow(page), `${path} scrolls sideways`).toBe(false);
  };

  await check("/", "Explore");
  await check(`/opportunity/${INSTANCE_ID}`, /.+/);
  await check("/verify", /Verify/);
  await check("/login", /Sign in/);
  await signInWithForm(page, ACCOUNTS.volunteer, "/");
  await check("/", "Explore");
  await check("/me/shifts", "My Shifts");
  await check("/impact", "Impact");
  await check("/me/notifications", "Notifications");
  await check("/me/saved", "Saved");
  // Tier 1 integration screens.
  await check("/me/profile", "Profile");
  await check("/organizations/alamo-community-pantry", "Alamo Community Pantry");
  await context.close();
});

const durationBase = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const scope = globalThis as unknown as { getComputedStyle(element: unknown): { getPropertyValue(name: string): string }; document: { documentElement: unknown } };
    return scope.getComputedStyle(scope.document.documentElement).getPropertyValue("--duration-base").trim();
  });

test("reduced motion: the OS setting and the in-app toggle zero the motion tokens", async ({ browser }) => {
  const reduced = await browser.newContext({ reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto("/");
  await expect(reducedPage.getByRole("heading", { level: 1, name: "Explore" })).toBeVisible();
  expect(await durationBase(reducedPage)).toBe("0ms");
  await reduced.close();

  const normal = await browser.newContext({ reducedMotion: "no-preference" });
  const page = await normal.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Explore" })).toBeVisible();
  expect(await durationBase(page)).not.toBe("0ms");
  await page.getByRole("checkbox", { name: "Reduce motion" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  expect(await durationBase(page)).toBe("0ms");
  // Remembered on this device after a reload.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await normal.close();
});
