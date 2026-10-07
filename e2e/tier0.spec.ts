/**
 * tier0.spec.ts
 * The Tier 0 gate (SPEC#tier0-e2e): three browser contexts stand in for the
 * three demo devices (coordinator laptop, kiosk tablet, volunteer phone).
 *   1. coordinator signs in on the laptop; on the tablet a coordinator taps
 *      Start kiosk and the tablet switches to the kiosk token and shows a code,
 *   2. keyboard only: Sam (15) signs in, signs up on Explore, and checks in
 *      with the kiosk code (before the shift starts, so signup is open),
 *   3. Jordan types the code and is checked in; the laptop roster and the
 *      kiosk arrivals update live,
 *   4. the demo clock jumps 30 minutes (so the credited time rounds to at
 *      least 15 minutes); Jordan checks out and sees the hours, issues
 *      a letter, and /verify/<code> shows Valid, also for a signed-out visitor.
 * axe runs on Explore, My Shifts, Kiosk, and Verify (no serious/critical).
 *
 * Run with `npm run test:e2e:tier0`, which builds the Functions, starts the
 * emulators, seeds the demo with the shift starting in 10 minutes, and runs
 * this file. Without the emulators (plain `npm run test:e2e`) it is skipped.
 */
import { expect as baseExpect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { ACCOUNTS, DEMO_PASSWORD, INSTANCE_ID, ORG_ID, advanceDemoClock, enterKioskCode, seriousAxeViolations, signInWithForm, snap } from "./support/tier0Helpers";

/** Cloud Functions on the emulator cold-start slowly on the first call, so UI waits get 30 s. */
const expect = baseExpect.configure({ timeout: 30_000 });

test.skip(!process.env.FIRESTORE_EMULATOR_HOST, "Needs the emulators: run npm run test:e2e:tier0");
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const DASHBOARD = `/org/${ORG_ID}/dashboard`;
const KIOSK = `/org/${ORG_ID}/kiosk/${INSTANCE_ID}`;
const SHIFT_TITLE = "Sort and pack food boxes";

interface Device {
  readonly context: BrowserContext;
  readonly page: Page;
}

const openDevice = async (browser: Browser, viewport: { width: number; height: number }): Promise<Device> => {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  return { context, page: await context.newPage() };
};

/** Presses Tab until `target` has focus (keyboard only), failing after `maxTabs`. */
const tabTo = async (page: Page, target: Locator, maxTabs = 80): Promise<void> => {
  for (let press = 0; press < maxTabs; press += 1) {
    // e2e code has no DOM typings (tsconfig.node.json), so the element is typed by the one method used.
    const isFocused = await target.evaluate((element) => (element as unknown as { matches(selector: string): boolean }).matches(":focus")).catch(() => false);
    if (isFocused) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Could not reach the element with the Tab key.");
};

let laptop: Device;
let kiosk: Device;
let phone: Device;

test.beforeAll(async ({ browser }) => {
  laptop = await openDevice(browser, { width: 1440, height: 900 });
  kiosk = await openDevice(browser, { width: 1280, height: 800 });
  phone = await openDevice(browser, { width: 390, height: 844 });
});

test.afterAll(async () => {
  await Promise.all([laptop, kiosk, phone].filter(Boolean).map((device) => device.context.close()));
});

test("coordinator starts the kiosk on the tablet", async () => {
  // Laptop: the coordinator watches the live roster.
  await signInWithForm(laptop.page, ACCOUNTS.coordinator, DASHBOARD);
  await laptop.page.goto(DASHBOARD);
  await expect(laptop.page.getByRole("heading", { name: SHIFT_TITLE })).toBeVisible();

  // Tablet: a coordinator starts the kiosk; the tablet signs out and becomes the kiosk.
  await signInWithForm(kiosk.page, ACCOUNTS.coordinator, DASHBOARD);
  await kiosk.page.goto(DASHBOARD);
  await kiosk.page.getByRole("button", { name: "Start kiosk", exact: true }).click();
  await kiosk.page.getByRole("button", { name: "Start kiosk on this device" }).click();
  await expect(kiosk.page).toHaveURL(new RegExp(`${KIOSK}$`));
  const codeOnKiosk = kiosk.page.getByTestId("kiosk-code");
  await expect(codeOnKiosk).toHaveText(/^\d{3} \d{3}$/);
  // The coordinator session did not stay on the tablet: no app shell, no Sign out.
  await expect(kiosk.page.getByRole("button", { name: /Sign out/ })).toHaveCount(0);
  const codeBox = await codeOnKiosk.boundingBox();
  expect(codeBox?.height ?? 0).toBeGreaterThanOrEqual(120);
  await expect(kiosk.page.getByText("No arrivals yet")).toBeVisible();
  expect(await seriousAxeViolations(kiosk.page)).toEqual([]);
  await snap(kiosk.page, "kiosk-1280");
  await snap(laptop.page, "dashboard-1440");
});

test("keyboard only: sign in, sign up on Explore, and check in", async ({ browser }) => {
  const minor = await openDevice(browser, { width: 1280, height: 900 });
  const page = minor.page;

  await page.goto("/login?next=%2F");
  await tabTo(page, page.getByLabel("Email"));
  await page.keyboard.type(ACCOUNTS.minor);
  await page.keyboard.press("Tab");
  await page.keyboard.type(DEMO_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Explore" })).toBeVisible();
  const signUp = page.getByRole("button", { name: `Sign up: ${SHIFT_TITLE}` });
  await expect(signUp).toBeVisible();
  expect(await seriousAxeViolations(page)).toEqual([]);

  await tabTo(page, signUp);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Signed up", { exact: true })).toBeVisible();
  await snap(page, "explore-signed-up-1280");

  await tabTo(page, page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "My Shifts" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: SHIFT_TITLE })).toBeVisible();
  await tabTo(page, page.getByRole("button", { name: "Check in", exact: true }));
  await page.keyboard.press("Enter");
  // The code field takes focus when it opens; type and press Enter, no mouse.
  await expect(page.getByLabel("Check in code")).toBeFocused();
  await enterKioskCode(page, kiosk.page, /^Checked in at /, { keyboardOnly: true });
  await expect(kiosk.page.getByRole("option", { name: /Sam L\./ })).toBeVisible();
  await minor.context.close();
});

test("volunteer checks in and out, issues a letter, and verify shows Valid", async ({ browser }) => {
  // Phone: Jordan (seeded as signed up) checks in with the code on the kiosk.
  await signInWithForm(phone.page, ACCOUNTS.volunteer, "/me/shifts");
  await phone.page.goto("/me/shifts");
  await expect(phone.page.getByRole("heading", { name: SHIFT_TITLE })).toBeVisible();
  expect(await seriousAxeViolations(phone.page)).toEqual([]);
  await phone.page.getByRole("button", { name: "Check in", exact: true }).click();
  await enterKioskCode(phone.page, kiosk.page, /^Checked in at /);
  await snap(phone.page, "my-shifts-checked-in-390");

  // Live updates on the laptop roster and the kiosk arrivals list.
  await expect(laptop.page.getByRole("row", { name: /Jordan R\..*Checked in/ })).toBeVisible();
  await expect(kiosk.page.getByRole("option", { name: /Jordan R\./ })).toBeVisible();

  // Demo clock: the same as pressing "Advance clock 15 min" twice, done as one 30-minute jump.
  // Then the separate Check out action unlocks on the phone.
  await advanceDemoClock(30);
  const checkOut = phone.page.getByRole("button", { name: "Check out", exact: true });
  await expect(checkOut).toBeEnabled({ timeout: 30_000 });
  await checkOut.click();
  await enterKioskCode(phone.page, kiosk.page, /hours? logged at Alamo Community Pantry/);
  const arcHeading = phone.page.getByRole("heading", { name: /hours? logged at Alamo Community Pantry/ });
  await expect(arcHeading).toBeVisible();
  // At least one 15-minute step was credited (SPEC#hours rounding).
  await expect(arcHeading).not.toHaveText(/^0 hours/);
  await snap(phone.page, "demo-arc-390");
  await snap(kiosk.page, "kiosk-arrivals-1280");
  await snap(laptop.page, "dashboard-roster-1440");

  // Letter: the demo arc's CTA leads to the builder; issue, then open the public verify page.
  await phone.page.getByRole("link", { name: "Get verified letter" }).click();
  await expect(phone.page.getByRole("heading", { level: 1, name: "Impact" })).toBeVisible();
  await snap(phone.page, "impact-letter-builder-390");
  await phone.page.getByRole("button", { name: "Issue letter" }).click();
  await expect(phone.page.getByRole("heading", { name: "Your letter is issued" })).toBeVisible({ timeout: 60_000 });
  await phone.page.getByRole("link", { name: "Open verify page" }).click();
  await expect(phone.page).toHaveURL(/\/verify\/[A-Z2-7]{26}$/);
  await expect(phone.page.getByRole("status").filter({ hasText: "Valid" })).toBeVisible();
  await expect(phone.page.getByText("This letter is current.")).toBeVisible();
  expect(await seriousAxeViolations(phone.page)).toEqual([]);
  await snap(phone.page, "verify-valid-390");

  // A visitor with only the link sees the same result, signed out.
  const visitor = await openDevice(browser, { width: 1024, height: 768 });
  await visitor.page.goto(phone.page.url());
  await expect(visitor.page.getByText("This letter is current.")).toBeVisible();
  await visitor.context.close();
});
