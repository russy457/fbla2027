/**
 * resetDemoData.test.ts
 * admin.resetDemoData on the emulators (SPEC 5.2, SPEC#demo-accounts, E1
 * reset safety): refused for non-admins and outside DEMO_MODE before any
 * data is touched; in DEMO_MODE it wipes stray data (Tier 1 collections and
 * report PDFs in Storage included), reseeds the SPEC 10.7
 * facts plus the E1 extras, recreates the demo accounts, and zeroes the clock.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { MINUTE_MS, PATHS, type InstanceDoc, type UserPublicDoc } from "@fbla/shared";
import { DEMO_INSTANCE_ID } from "../src/seed/demoSeed";
import { PROJECT_ID, adminUser, auth, call, db, expectCode, makeDeps, resetEmulators, storage, testClock, user } from "./harness";

const BUCKET = `${PROJECT_ID}.appspot.com`;
/** Tier 1 collections and files a rehearsal leaves behind; the reset must remove them all. */
const STRAY_TIER1_DOCS = [
  "notifications/stray-user/items/hours-approved_x",
  "users/stray-user/saved/org_stray-org",
  "invites/stray-invite",
  "reports/stray-report",
  "orgVerificationLog/stray-entry",
  "aiUsage/stray-user"
];
const STRAY_REPORT_PDF = "reports/stray-user/stray-report.pdf";

beforeEach(async () => {
  await resetEmulators();
  await db.doc("organizations/stray-org").set({ name: "Left over from a rehearsal" });
  await db.doc(PATHS.demoClock()).set({ offsetMs: 45 * MINUTE_MS, setBy: "admin1", setAt: new Date(testClock.nowMs) });
  await Promise.all(STRAY_TIER1_DOCS.map((path) => db.doc(path).set({ stray: true })));
  await storage.bucket(BUCKET).file(STRAY_REPORT_PDF).save(Buffer.from("%PDF-1.4 stray"), { contentType: "application/pdf" });
});

describe("admin.resetDemoData", () => {
  it("is refused for non-admins and outside DEMO_MODE, leaving data alone", async () => {
    await expectCode(call("admin", "resetDemoData", {}, user("vol")), "PERMISSION_DENIED");
    await expectCode(call("admin", "resetDemoData", {}, adminUser(), makeDeps({ DEMO_MODE: "false" })), "DEMO_MODE_REQUIRED");
    expect((await db.doc("organizations/stray-org").get()).exists).toBe(true);
  });

  it("cannot wipe a real cloud project through the local Functions emulator", async () => {
    await expectCode(call("admin", "resetDemoData", {}, adminUser(), makeDeps({ GCLOUD_PROJECT: "fbla2027-ethanteng" })), "DEMO_MODE_REQUIRED");
    expect((await db.doc("organizations/stray-org").get()).exists).toBe(true);
  });

  it("validates the shift offset", async () => {
    await expectCode(call("admin", "resetDemoData", { shiftStartsInMin: 0 }, adminUser()), "INVALID_INPUT");
  });

  it("wipes and reseeds the demo in DEMO_MODE", async () => {
    const result = await call<{ documents: number; collectionsCleared: number; accounts: number; demoShiftStartsAt: string }>(
      "admin",
      "resetDemoData",
      { shiftStartsInMin: 30 },
      adminUser()
    );
    expect(result.accounts).toBe(4);
    expect(result.collectionsCleared).toBeGreaterThanOrEqual(2);
    expect(result.documents).toBeGreaterThan(100);
    expect(Date.parse(result.demoShiftStartsAt)).toBe(testClock.nowMs + 30 * MINUTE_MS);

    expect((await db.doc("organizations/stray-org").get()).exists).toBe(false);
    const demoShift = (await db.doc(`instances/${DEMO_INSTANCE_ID}`).get()).data() as InstanceDoc;
    expect(demoShift).toMatchObject({ capacity: 3, signupCount: 2 });
    expect(((await db.doc("users/demo-volunteer").get()).data() as UserPublicDoc).totalApprovedHours).toBe(22.5);
    expect((await db.doc(PATHS.demoClock()).get()).data()?.offsetMs).toBe(0);
    expect((await db.doc("meta/seed").get()).data()?.schemaVersion).toBe(4);

    // Tier 1 leftovers are gone (including notifications under parent docs that never existed) ...
    for (const path of STRAY_TIER1_DOCS) expect((await db.doc(path).get()).exists, path).toBe(false);
    expect((await storage.bucket(BUCKET).file(STRAY_REPORT_PDF).exists())[0]).toBe(false);
    // ... and the demo volunteer's seeded alerts are back, so the badge shows.
    const alerts = await db.collection(PATHS.notificationItems("demo-volunteer")).where("read", "==", false).get();
    expect(alerts.size).toBe(2);

    const adminAccount = await auth.getUserByEmail("admin@demo.fbla2027.test");
    expect(adminAccount.customClaims).toEqual({ admin: true });
  });
});
