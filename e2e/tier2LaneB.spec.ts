/**
 * tier2LaneB.spec.ts
 * Tier 2 lane B end-to-end checks (SPEC 12.2 "Tier 2: e2e green"):
 *   1. a coordinator publishes a curated collection and a visitor sees it in
 *      the Collections section on Explore and opens its page,
 *   2. a volunteer with an attended (completed) shift posts a review that
 *      shows on the public organization page with the aggregate,
 *   3. the org report preview shows the reliability chart (accessible SVG +
 *      data table) and the PDF downloads.
 *
 * Run with `npm run test:e2e:tier2b` (builds the Functions, starts the
 * emulators, seeds the demo, runs tier0 then this file). Skipped without the
 * emulators.
 */
import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
import { Timestamp } from "firebase-admin/firestore";
import { ACCOUNTS, ORG_ID, openedPdfHead, signInWithForm } from "./support/tier0Helpers";
import { adminDb } from "./support/laneBHelpers";

/** Functions on the emulator cold-start slowly, so UI waits get 30 s. */
const expect = baseExpect.configure({ timeout: 30_000 });

test.skip(!process.env.FIRESTORE_EMULATOR_HOST, "Needs the emulators and the seeded demo");
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const VOLUNTEER_UID = "demo-volunteer";
const REVIEW_SIGNUP_ID = "e2e-t2b-past_demo-volunteer";

const signedInPage = async (browser: Browser, email: string, next: string): Promise<Page> => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await signInWithForm(page, email, next);
  return page;
};

/** A finished shift for the demo volunteer at the demo org, so they may review it. */
const seedAttendedShift = async (): Promise<void> => {
  const db = adminDb();
  const startMs = Date.now() - 5 * 24 * 3_600_000;
  const at = Timestamp.fromMillis(Date.now());
  const instance = (await db.collection("instances").where("orgId", "==", ORG_ID).limit(1).get()).docs[0]?.data();
  if (!instance) throw new Error(`No instance found for ${ORG_ID}; was the demo seeded?`);
  await db.collection("signups").doc(REVIEW_SIGNUP_ID).set({
    instanceId: "e2e-t2b-past", opportunityId: instance.opportunityId, orgId: ORG_ID, uid: VOLUNTEER_UID, displayName: "Jordan R.",
    instanceStart: Timestamp.fromMillis(startMs), instanceEnd: Timestamp.fromMillis(startMs + 3 * 3_600_000), status: "completed",
    waitlistSeq: null, walkUp: false, promotedAt: null, lateCancel: false, cancelReason: null, cancelledAt: null,
    checkInAt: Timestamp.fromMillis(startMs), checkOutAt: Timestamp.fromMillis(startMs + 3 * 3_600_000), autoCompleted: false,
    excuseReason: null, attendance: null, disputeOpen: false, dispute: null, history: [], createdAt: at, updatedAt: at
  });
  // Start clean: no earlier review by the demo volunteer for this org.
  const mine = await db.collection("reviews").where("orgId", "==", ORG_ID).where("uid", "==", VOLUNTEER_UID).get();
  await Promise.all(mine.docs.map((doc) => doc.ref.delete()));
};

test("a coordinator publishes a collection that appears on Explore", async ({ browser }) => {
  const opportunity = (await adminDb().collection("opportunities").where("orgId", "==", ORG_ID).where("status", "==", "active").limit(1).get()).docs[0];
  if (!opportunity) throw new Error("The demo org has no active opportunity");
  const shiftTitle = opportunity.get("title") as string;
  const title = `Good first shifts ${Date.now() % 100_000}`;

  const page = await signedInPage(browser, ACCOUNTS.coordinator, `/org/${ORG_ID}/collections`);
  await page.goto(`/org/${ORG_ID}/collections`);
  await expect(page.getByRole("heading", { level: 1, name: "Collections" })).toBeVisible();
  await page.getByRole("button", { name: "New collection" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Friendly shifts for your first time volunteering.");
  await page.getByRole("group", { name: "Shifts" }).getByLabel(shiftTitle).first().check();
  await page.getByLabel(/^Published/).check();
  await page.getByRole("button", { name: "Save collection" }).click();
  await expect(page.getByText(`Saved and published "${title}".`)).toBeVisible();
  await expect(page.getByRole("button", { name: `Edit ${title}` })).toBeVisible();
  await page.context().close();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/explore");
  const section = visitor.getByRole("region", { name: "Collections" });
  await expect(section.getByRole("link", { name: title })).toBeVisible();
  await section.getByRole("link", { name: title }).click();
  await expect(visitor.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(visitor.getByText(/Curated by/)).toBeVisible();
  await expect(visitor.getByRole("region", { name: "In this collection" }).getByText(shiftTitle).first()).toBeVisible();
  await visitor.context().close();
});

test("a volunteer with an attended shift posts a review that shows on the org page", async ({ browser }) => {
  await seedAttendedShift();
  const text = `Well organized and kind. ${Date.now() % 100_000}`;
  const page = await signedInPage(browser, ACCOUNTS.volunteer, `/organizations/${ORG_ID}`);
  await page.goto(`/organizations/${ORG_ID}`);
  const reviews = page.getByRole("region", { name: "Reviews" });
  await expect(reviews.getByRole("heading", { name: "Review your shift" })).toBeVisible();
  const form = reviews.locator("form");
  await form.getByText("5 stars", { exact: true }).click();
  await form.getByText("Welcoming", { exact: true }).click();
  await form.getByLabel("Your experience (optional)").fill(text);
  await form.getByRole("button", { name: "Post review" }).click();
  await expect(reviews.getByText("Thanks! Your review is posted.")).toBeVisible();

  // Public: a signed-out visitor sees the review and the aggregate.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/organizations/${ORG_ID}`);
  const publicReviews = visitor.getByRole("region", { name: "Reviews" });
  await expect(publicReviews.getByText(text)).toBeVisible();
  await expect(publicReviews.getByRole("article", { name: "Review by Jordan R." })).toBeVisible();
  await expect(publicReviews.getByText(/out of 5 from \d+ reviews?/)).toBeAttached();
  await visitor.context().close();
  await page.context().close();
});

test("the org report shows the reliability chart and the PDF downloads", async ({ browser }) => {
  const page = await signedInPage(browser, ACCOUNTS.coordinator, `/org/${ORG_ID}/reports`);
  await page.goto(`/org/${ORG_ID}/reports`);
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  const preview = page.getByRole("region", { name: "Reliability distribution" });
  await expect(preview.getByRole("img", { name: /Reliability distribution/ })).toBeVisible();
  await preview.getByText("Show data table").click();
  await expect(preview.getByRole("table", { name: "Reliability distribution" })).toBeVisible();

  await page.getByRole("button", { name: "Generate PDF" }).click();
  const download = page.getByRole("button", { name: "Download PDF" });
  await expect(download).toBeVisible({ timeout: 60_000 });
  expect(await openedPdfHead(page, download, /reports%2F.*\.pdf/)).toBe("%PDF-");
  await page.context().close();
});
