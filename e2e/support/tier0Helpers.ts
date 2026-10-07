/**
 * tier0Helpers.ts
 * Shared steps for the Tier 0 end-to-end test (SPEC#tier0-e2e). Everything
 * talks to the local emulators only (project demo-fbla2027), never a real
 * Firebase project. Waits are deterministic (Playwright auto-waiting and
 * expect.poll on real conditions); there are no fixed sleeps.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect as baseExpect, type Locator, type Page } from "@playwright/test";

/** Cloud Functions on the emulator cold-start slowly on the first call, so UI waits get 30 s. */
const expect = baseExpect.configure({ timeout: 30_000 });

export const PROJECT_ID = "demo-fbla2027";
export const ORG_ID = "alamo-community-pantry";
export const INSTANCE_ID = "demo-shift";
/** Emulator-only demo password printed by scripts/seed-demo.mjs. */
export const DEMO_PASSWORD = "pitchin-demo-2027";
export const ACCOUNTS = {
  admin: "admin@demo.fbla2027.test",
  coordinator: "coordinator@demo.fbla2027.test",
  volunteer: "volunteer@demo.fbla2027.test",
  minor: "minor@demo.fbla2027.test"
} as const;

/** Emulator addresses: emulators:exec exports the Auth host; the npm script passes the Functions port. */
const AUTH_EMULATOR = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099"}`;
const FUNCTIONS_EMULATOR = `http://127.0.0.1:${process.env.E2E_FUNCTIONS_PORT ?? "5001"}/${PROJECT_ID}/us-central1`;

/** Signs in through the real Login form and waits until the header shows Sign out. */
export const signInWithForm = async (page: Page, email: string, next = "/"): Promise<void> => {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: /Sign out/ })).toBeVisible();
};

/** An ID token for the seeded admin from the Auth emulator. */
const adminIdToken = async (): Promise<string> => {
  const signIn = await fetch(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ACCOUNTS.admin, password: DEMO_PASSWORD, returnSecureToken: true })
  });
  const { idToken } = (await signIn.json()) as { idToken?: string };
  if (!idToken) throw new Error("Admin sign-in on the Auth emulator failed. Was the demo seeded?");
  return idToken;
};

/**
 * Calls an op the way the app does (callable protocol: POST {data: {op, ...input}})
 * as the seeded admin. Used for "Advance clock 15 min" (the three demo
 * devices are a coordinator, a kiosk, and a volunteer, none of them admin).
 */
export const callOpAsAdmin = async (endpoint: string, op: string, input: Record<string, unknown> = {}): Promise<Record<string, unknown>> => {
  const response = await fetch(`${FUNCTIONS_EMULATOR}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await adminIdToken()}` },
    body: JSON.stringify({ data: { op, ...input } })
  });
  const body = (await response.json()) as { result?: { ok: boolean; data: Record<string, unknown> }; error?: unknown };
  if (!response.ok || !body.result?.ok) throw new Error(`${endpoint}.${op} failed: ${JSON.stringify(body.error ?? body)}`);
  return body.result.data;
};

/**
 * Advances the demo clock in ONE step, then waits until the kiosk endpoint
 * reports the new time. Functions cache the offset for up to 5 seconds per
 * instance (and the emulator may run several instances), so a request can
 * briefly see the old offset; one jump means it sees either the old time
 * (and gets a retryable "not open yet") or the new one, never a half step.
 */
export const advanceDemoClock = async (minutes: number): Promise<void> => {
  const { offsetMs } = (await callOpAsAdmin("admin", "setDemoClock", { advanceMinutes: minutes })) as { offsetMs: number };
  const aheadMs = async (): Promise<number> => {
    const { time } = (await callOpAsAdmin("kiosk", "ping")) as { time: string };
    return Date.parse(time) - Date.now();
  };
  // Allow a few seconds of request latency below the exact offset.
  await expect.poll(aheadMs, { timeout: 30_000, intervals: [1000] }).toBeGreaterThan(offsetMs - 5000);
};

/** The code currently shown on the kiosk, digits only. */
export const readKioskCode = async (kiosk: Page): Promise<string> => {
  const code = kiosk.getByTestId("kiosk-code");
  await expect(code).toHaveText(/^\d{3} \d{3}$/);
  return (await code.innerText()).replace(/\s+/g, "");
};

/**
 * Server answers that mean "try again in a moment": a code that rotated away,
 * or (right after a demo clock jump) a Functions instance that still holds
 * the old offset for up to 5 seconds and says the window is not open yet.
 */
const RETRYABLE_MESSAGE = /That code is wrong or expired|Check-out opens at|Check-in for this shift is not open/;

/** How long to wait for the phone to show the result of one code submit. */
const OUTCOME_TIMEOUT_MS = 20_000;

/**
 * Types the kiosk's current code on the phone and submits. A code read just
 * before it rotates (or before a demo clock jump reaches every Functions
 * instance) can be refused; then we wait for the kiosk to show a different
 * code and try again, like a person would. Gives up after a few tries.
 */
export interface CodeEntryOptions {
  /** Keyboard-only mode: type into the focused field and press Enter, never click. */
  readonly keyboardOnly?: boolean;
}

export const enterKioskCode = async (phone: Page, kiosk: Page, success: RegExp, options: CodeEntryOptions = {}): Promise<void> => {
  const MAX_TRIES = 4;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
    const code = await readKioskCode(kiosk);
    if (options.keyboardOnly) {
      // After a refused code the form clears the field and puts focus back in it.
      await expect(phone.getByRole("textbox", { name: /code/ })).toBeFocused();
      await phone.keyboard.type(code);
      await phone.keyboard.press("Enter");
    } else {
      await phone.getByRole("textbox", { name: /code/ }).fill(code);
      await phone.getByRole("button", { name: "Submit code" }).click();
    }
    // Whichever appears first: the success line or the expired-code message. Losers time out quietly.
    const outcome = await Promise.race([
      phone.getByText(success).first().waitFor({ timeout: OUTCOME_TIMEOUT_MS }).then(() => "ok" as const, () => "none" as const),
      phone
        .getByText(RETRYABLE_MESSAGE)
        .first()
        .waitFor({ timeout: OUTCOME_TIMEOUT_MS })
        .then(() => "expired" as const, () => "none" as const)
    ]);
    if (outcome === "ok") return;
    if (outcome === "none") throw new Error("Neither a success nor a code error appeared after submitting the code.");
    await expect.poll(() => readKioskCode(kiosk), { timeout: 45_000 }).not.toBe(code);
  }
  throw new Error(`The kiosk code was refused ${MAX_TRIES} times.`);
};

/** axe with WCAG 2.2 AA tags; returns only serious and critical violations. */
export const seriousAxeViolations = async (page: Page): Promise<string[]> => {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(" ")).join(", ")})`);
};

/**
 * Clicks a "Download PDF" button and returns the first bytes of what it opens.
 * Headless Chromium downloads a PDF instead of showing it, so window.open is
 * stubbed to record the short-lived link the app got from volunteer.getPdfUrl
 * or coordinator.getOrgReportUrl. The link must match `pathPattern` and must
 * not be a Firebase download-token URL (those never expire).
 */
export const openedPdfHead = async (page: Page, button: Locator, pathPattern: RegExp): Promise<string> => {
  await page.evaluate(() => {
    const opened: string[] = [];
    (globalThis as unknown as { __opened: string[] }).__opened = opened;
    (globalThis as unknown as { open: (url: string) => null }).open = (url: string) => {
      opened.push(url);
      return null;
    };
  });
  await button.click();
  const openedUrl = () => page.evaluate(() => (globalThis as unknown as { __opened: string[] }).__opened[0] ?? "");
  await expect.poll(openedUrl).toMatch(pathPattern);
  const url = await openedUrl();
  expect(url).not.toContain("token=");
  const pdf = await page.request.get(url);
  expect(pdf.ok()).toBe(true);
  return (await pdf.body()).subarray(0, 5).toString();
};

/** Saves a full-page screenshot for human review (test-results/ is git-ignored). */
export const snap = async (page: Page, name: string): Promise<void> => {
  await page.screenshot({ path: `test-results/tier0-screens/${name}.png`, fullPage: true });
};
