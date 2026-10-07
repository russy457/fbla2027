/**
 * reliabilityReports.test.ts
 * Tier 2 lane B reliability charts in reports (SPEC 8.6) on the emulators:
 * the server loaders feed the same signups (with lateCancel) into the shared
 * aggregation the preview uses, the org distribution counts only that org's
 * volunteers, the volunteer track record reads the caller's own signups, and
 * both report ops render the new sections. A coordinator of another org
 * still gets PERMISSION_DENIED.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { BASE_MS, call, db, expectCode, resetEmulators, user } from "./harness";
import { seedInstance, seedSignup, seedWorld } from "./fixtures";
import { loadOrgReportData } from "../src/reports/data/orgParticipation";
import { loadVolunteerReportData } from "../src/reports/data/volunteerHours";

const DAY = 86_400_000;
const RANGE = { from: "2026-09-01", to: "2026-10-17" };
const NONCE = "33333333-3333-4333-8333-333333333333";
const TZ = "America/Chicago";

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
  for (const day of [10, 9, 8]) await seedInstance(`a${day}`, { startMs: BASE_MS - day * DAY });
  await seedInstance("b1", { orgId: "orgB", startMs: BASE_MS - 7 * DAY });
  // vol1: 3 attended at org A -> 100%. vol2: 1 attended, 1 no-show, 1 late cancel -> 1 / 2.5 = 40%.
  for (const day of [10, 9, 8]) await seedSignup(`a${day}`, "vol1", "completed");
  await seedSignup("a10", "vol2", "completed");
  await seedSignup("a9", "vol2", "no-show");
  await seedSignup("a8", "vol2", "cancelled", { lateCancel: true, cancelReason: "volunteer" });
  // Another org's signup never counts in org A's report.
  await seedSignup("b1", "vol3", "no-show");
});

describe("reliability data from the loaders", () => {
  it("org report: one volunteer per band, late cancels weighted half", async () => {
    const data = await loadOrgReportData(db, { orgId: "orgA", ...RANGE, timeZone: TZ, opportunityId: null });
    expect(data.reliability.volunteers).toBe(2);
    expect(Object.fromEntries(data.reliability.buckets.map((row) => [row.bucket, row.volunteers]))).toEqual({ new: 0, "under-50": 1, "50-79": 0, "80-99": 0, "100": 1 });
  });

  it("volunteer report: the caller's own track record", async () => {
    const data = await loadVolunteerReportData(db, { uid: "vol2", ...RANGE, timeZone: TZ });
    expect(data.trackRecord).toMatchObject({ attended: 1, noShows: 1, lateCancels: 1, summary: "Attended 1 of 3 recent shifts" });
  });
});

describe("report ops with the reliability sections", () => {
  it("render ready PDFs for both kinds", async () => {
    const org = await call<{ status: string }>("coordinator", "generateOrgReport", { orgId: "orgA", ...RANGE, sections: ["summary", "reliability"], themeId: "neutral", requestNonce: NONCE }, user("coordA"));
    expect(org.status).toBe("ready");
    const volunteer = await call<{ status: string }>("volunteer", "generateVolunteerReport", { ...RANGE, sections: ["trackRecord"], themeId: "green", requestNonce: NONCE }, user("vol2"));
    expect(volunteer.status).toBe("ready");
  });

  it("still denies another org's coordinator", async () => {
    await expectCode(
      call("coordinator", "generateOrgReport", { orgId: "orgA", ...RANGE, sections: ["reliability"], themeId: "neutral", requestNonce: NONCE }, user("coordB")),
      "PERMISSION_DENIED"
    );
  });
});
