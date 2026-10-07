/**
 * tier1LaneB.spec.ts
 * Tier 1 lane B end-to-end checks (SPEC#tier0-e2e 12.2, Tier 1 list):
 *   1. navigation per role: visitor, volunteer, coordinator, admin,
 *   2. Needs attention: approve a reviewed log, reject a manual one with a reason,
 *   3. a letter is issued, a coordinator's setAttendance turns a counted log
 *      into a no-show, and /verify shows Superseded (supersedeLetters trigger),
 *   4. the org participation report: preview, PDF download, CSV export.
 *
 * Run with `npm run test:e2e:tier1b` (builds the Functions, starts the
 * emulators, seeds the demo, runs this file). Skipped without the emulators.
 */
import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
import { ACCOUNTS, ORG_ID, openedPdfHead, signInWithForm } from "./support/tier0Helpers";
import { adminDb, callOpAs, logStatus, seedPendingHours } from "./support/laneBHelpers";

/** Functions on the emulator cold-start slowly, so UI waits get 30 s. */
const expect = baseExpect.configure({ timeout: 30_000 });

test.skip(!process.env.FIRESTORE_EMULATOR_HOST, "Needs the emulators: run npm run test:e2e:tier1b");
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const DASHBOARD = `/org/${ORG_ID}/dashboard`;

const signedInPage = async (browser: Browser, email: string, next: string): Promise<Page> => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await signInWithForm(page, email, next);
  return page;
};

test("navigation per role", async ({ browser }) => {
  // Visitor: coordinator routes send you to sign in.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(DASHBOARD);
  await expect(visitor).toHaveURL(/\/login\?next=/);
  await visitor.context().close();

  // Volunteer: no coordinator or admin links; org and admin routes explain the refusal.
  const volunteer = await signedInPage(browser, ACCOUNTS.volunteer, "/");
  await expect(volunteer.getByRole("link", { name: /Coordinator/ })).toHaveCount(0);
  await expect(volunteer.getByRole("link", { name: /Admin/ })).toHaveCount(0);
  await expect(volunteer.getByRole("link", { name: /For organizations/ })).toBeVisible();
  await volunteer.goto(DASHBOARD);
  await expect(volunteer.getByText("You don't have access to this organization")).toBeVisible();
  await volunteer.goto("/admin");
  await expect(volunteer.getByText("Admins only")).toBeVisible();
  await volunteer.context().close();

  // Coordinator: header link to the dashboard, then the organization nav.
  const coordinator = await signedInPage(browser, ACCOUNTS.coordinator, "/");
  await coordinator.getByRole("link", { name: /Coordinator/ }).first().click();
  await expect(coordinator).toHaveURL(new RegExp(`${DASHBOARD}$`));
  const orgNav = coordinator.getByRole("navigation", { name: "Organization" });
  for (const [label, heading] of [["Shifts", "Shifts"], ["Reports", "Reports"], ["Settings", "Settings"]] as const) {
    await orgNav.getByRole("link", { name: label }).click();
    await expect(coordinator.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  await orgNav.getByRole("link", { name: "Dashboard" }).click();
  await expect(coordinator.getByRole("heading", { name: "Needs attention" })).toBeVisible();
  await coordinator.goto("/admin");
  await expect(coordinator.getByText("Admins only")).toBeVisible();
  await coordinator.context().close();

  // Admin: verification queue and background jobs with the last run time.
  const admin = await signedInPage(browser, ACCOUNTS.admin, "/");
  await admin.getByRole("link", { name: /Admin/ }).first().click();
  await expect(admin.getByRole("heading", { name: "Organizations awaiting verification" })).toBeVisible();
  await expect(admin.getByRole("heading", { name: "Background jobs" })).toBeVisible();
  await admin.getByRole("button", { name: "Run due jobs now" }).click();
  await expect(admin.getByText(/Last run/)).toBeVisible();
  await admin.context().close();
});

test("Needs attention: approve reviewed hours and reject a manual entry with a reason", async ({ browser }) => {
  const { reviewLogId, manualLogId } = await seedPendingHours(ORG_ID, "demo-volunteer");
  const page = await signedInPage(browser, ACCOUNTS.coordinator, DASHBOARD);
  await page.goto(DASHBOARD);
  const queue = page.locator("section", { has: page.getByRole("heading", { name: "Needs attention" }) });

  await queue.getByRole("button", { name: "Approve hours for Dev P." }).click();
  await expect.poll(() => logStatus(reviewLogId)).toBe("approved");
  await expect(queue.getByRole("button", { name: "Approve hours for Dev P." })).toHaveCount(0);

  await queue.getByRole("button", { name: "Reject hours for Jordan R." }).click();
  await queue.getByLabel("Reason for rejecting").fill("No record of this food drive");
  await queue.getByRole("button", { name: "Confirm reject" }).click();
  await expect.poll(() => logStatus(manualLogId)).toBe("rejected");
  const rejected = await adminDb().collection("hoursLogs").doc(manualLogId).get();
  expect(rejected.get("rejectReason")).toBe("No record of this food drive");
  await page.context().close();
});

test("setAttendance on a counted log supersedes an issued letter on /verify", async ({ browser }) => {
  // Letter ranges are calendar days in America/Chicago; en-CA formats as YYYY-MM-DD.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const issued = (await callOpAs(ACCOUNTS.volunteer, "volunteer", "issueLetter", {
    scope: { orgId: ORG_ID, from: "2026-01-01", to: today },
    requestNonce: "77777777-7777-4777-8777-777777777777"
  })) as { letterId: string; verifyCode: string };

  // Pick one counted shift log from the frozen evidence.
  const letter = await adminDb().collection("letters").doc(issued.letterId).get();
  const logIds = letter.get("evidence.logIds") as string[];
  const logs = await Promise.all(logIds.map((id) => adminDb().collection("hoursLogs").doc(id).get()));
  const counted = logs.find((log) => typeof log.get("instanceId") === "string");
  if (!counted) throw new Error("The issued letter counts no shift log");
  const instanceId = counted.get("instanceId") as string;

  const verifyPage = await (await browser.newContext()).newPage();
  await verifyPage.goto(`/verify/${issued.verifyCode}`);
  await expect(verifyPage.getByText("This letter is current.")).toBeVisible();

  const page = await signedInPage(browser, ACCOUNTS.coordinator, `/org/${ORG_ID}/shifts/${instanceId}`);
  await page.goto(`/org/${ORG_ID}/shifts/${instanceId}`);
  await page.getByRole("button", { name: "Change attendance for Jordan R." }).click();
  await page.getByRole("radio", { name: "No-show" }).check();
  await page.getByLabel("Note").fill("Signed in by mistake; was not at this shift");
  await page.getByRole("button", { name: "Save attendance" }).click();
  await expect.poll(() => logStatus(counted.id)).toBe("rejected");

  // The trigger runs asynchronously in the Functions emulator; reload until it lands.
  await expect
    .poll(
      async () => {
        await verifyPage.reload();
        // Wait for the status band to render (current or changed) before reading it.
        const band = verifyPage.getByText(/This letter is current\.|The hours on this letter changed after it was issued\./);
        await band.first().waitFor({ timeout: 20_000 });
        return verifyPage.getByText("The hours on this letter changed after it was issued.").isVisible();
      },
      { timeout: 60_000, intervals: [2000] }
    )
    .toBe(true);
  await expect(verifyPage.getByRole("status").filter({ hasText: "Superseded" })).toBeVisible();
  await page.context().close();
  await verifyPage.context().close();
});

test("org report: preview, PDF download, and CSV export", async ({ browser }) => {
  const page = await signedInPage(browser, ACCOUNTS.coordinator, `/org/${ORG_ID}/reports`);
  await page.goto(`/org/${ORG_ID}/reports`);
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();

  await page.getByRole("button", { name: "Generate PDF" }).click();
  const download = page.getByRole("button", { name: "Download PDF" });
  await expect(download).toBeVisible({ timeout: 60_000 });
  // The link comes from coordinator.getOrgReportUrl (short-lived), not a Storage download token.
  expect(await openedPdfHead(page, download, /reports%2F.*\.pdf/)).toBe("%PDF-");

  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  expect(csv.suggestedFilename()).toMatch(/^org-participation-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/);
  const path = await csv.path();
  const { readFileSync } = await import("node:fs");
  expect(readFileSync(path, "utf8").split(/\r?\n/)[0]).toContain("Date");
  await page.context().close();
});
