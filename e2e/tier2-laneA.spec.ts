/**
 * tier2-laneA.spec.ts
 * Tier 2 lane A end-to-end checks (SPEC 3.7, 5.2, 8.3, 8.4, 9.4):
 *   1. the seeded coordinator creates a weekly series from the new-shift page
 *      (Schedule: Repeats), lands on the series page with its dates, and the
 *      volunteer signs up for the whole series from one shift's page;
 *   2. the coordinator ranks volunteers for a fresh shift, invites Jordan,
 *      and Jordan sees the "invited you" alert in Notifications.
 * Needs the emulators and the demo seed (same as the Tier 0 gate); skipped
 * without them. Run after tier0.spec.ts in one worker (npm run test:e2e:tier2a),
 * so Jordan already has a completed pantry shift (a past volunteer).
 */
import { expect as baseExpect, test } from "@playwright/test";
import { ACCOUNTS, ORG_ID, signInWithForm } from "./support/tier0Helpers";
import { cloneShift } from "./support/laneAHelpers";

const expect = baseExpect.configure({ timeout: 30_000 });

test.skip(!process.env.FIRESTORE_EMULATOR_HOST, "Needs the emulators: run npm run test:e2e:tier2a");
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const SERIES_LISTING = "Saturday family market";
const INVITE_SHIFT = { id: "lane2a-invite", title: "Unload the delivery truck" };

test("coordinator creates a weekly series; volunteer signs up for the whole series", async ({ browser }) => {
  const coordinator = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await coordinator.newPage();
  await signInWithForm(page, ACCOUNTS.coordinator, `/org/${ORG_ID}/shifts/new`);
  await page.goto(`/org/${ORG_ID}/shifts/new`);
  await page.getByLabel("Opportunity").selectOption({ label: SERIES_LISTING });
  await page.getByRole("radio", { name: "Repeats" }).check();
  await expect(page.getByRole("radio", { name: "Every week" })).toBeChecked();
  // Tomorrow's weekday is preselected; the summary reads the rule back.
  await expect(page.getByText(/^Every \w+day, 9:00 AM to 1:00 PM$/)).toBeVisible();
  await page.getByRole("button", { name: "Create series" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Recurring series" })).toBeVisible();
  const dates = page.getByRole("region", { name: "Upcoming dates" }).getByRole("link");
  await expect(dates.first()).toBeVisible();
  expect(await dates.count()).toBeGreaterThanOrEqual(8);
  const firstShiftPath = (await dates.first().getAttribute("href")) ?? "";
  const instanceId = firstShiftPath.split("/").pop() ?? "";
  expect(instanceId).toMatch(/_\d{8}$/);
  await coordinator.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const volunteer = await phone.newPage();
  await signInWithForm(volunteer, ACCOUNTS.volunteer, `/opportunity/${instanceId}`);
  await volunteer.goto(`/opportunity/${instanceId}`);
  const panel = volunteer.getByRole("region", { name: "This shift repeats" });
  await expect(panel.getByText(/^Every \w+day, 9:00 AM to 1:00 PM\.$/)).toBeVisible();
  await panel.getByRole("button", { name: "Sign up for the whole series" }).click();
  const results = panel.getByRole("list", { name: "Series signup results" });
  await expect(results.getByText("Signed up").first()).toBeVisible();
  await expect(panel.getByRole("status")).toHaveText(/^Series signup covers through /);
  // The single-shift button agrees: this date is now Signed up.
  await expect(volunteer.getByText("Signed up", { exact: true }).first()).toBeVisible();
  await phone.close();
});

test("coordinator ranks and invites; the volunteer sees the invite alert", async ({ browser }) => {
  await cloneShift({ ...INVITE_SHIFT, startsInMin: 3 * 24 * 60, capacity: 6 });

  const coordinator = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await coordinator.newPage();
  await signInWithForm(page, ACCOUNTS.coordinator, `/org/${ORG_ID}/shifts/${INVITE_SHIFT.id}`);
  await page.goto(`/org/${ORG_ID}/shifts/${INVITE_SHIFT.id}`);
  const panel = page.getByRole("region", { name: "Find volunteers" });
  await panel.getByRole("button", { name: "Rank volunteers" }).click();
  const jordan = panel.getByRole("checkbox", { name: "Jordan R." });
  await expect(jordan).toBeVisible();
  // Names and reasons only: no email or phone anywhere in the panel.
  await expect(panel).not.toContainText("@");
  await expect(panel.getByRole("list", { name: "Why Jordan R." })).toContainText("Volunteered with you");
  await jordan.check();
  await panel.getByRole("button", { name: "Invite selected (1)" }).click();
  await expect(panel.getByRole("status")).toHaveText("Invited 1 volunteer.");
  await coordinator.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const volunteer = await phone.newPage();
  await signInWithForm(volunteer, ACCOUNTS.volunteer, "/me/notifications");
  await volunteer.goto("/me/notifications");
  await expect(volunteer.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await expect(volunteer.getByText(`Alamo Community Pantry invited you to ${INVITE_SHIFT.title}`)).toBeVisible();
  await phone.close();
});
