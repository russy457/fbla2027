/**
 * reports.test.ts
 * coordinator.generateOrgReport and volunteer.generateVolunteerReport
 * (SPEC 5.2, SPEC 8.6): the PDF lands in the owner's Storage folder and the
 * report doc turns ready, the same nonce returns the same report, and the org
 * report refuses other orgs' coordinators, volunteers, kiosk tokens, unknown
 * orgs, and malformed input.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS, type HoursLogDoc, type ReportDoc } from "@fbla/shared";
import { BASE_MS, HOUR, call, db, expectCode, kioskUser, resetEmulators, storage, tsAt, user } from "./harness";
import { seedInstance, seedSignup, seedWorld } from "./fixtures";

const NONCE_1 = "11111111-1111-4111-8111-111111111111";
const NONCE_2 = "22222222-2222-4222-8222-222222222222";
const DAY = 86_400_000;
const BUCKET = "demo-fbla2027.appspot.com";
const RANGE = { from: "2026-09-01", to: "2026-10-17" };

type ReportResult = { reportId: string; status: string; pdfPath: string };

const seedLog = (id: string, uid: string, orgId: string, minutes: number, instanceId: string | null, status: HoursLogDoc["status"] = "approved") => {
  const log: HoursLogDoc = {
    uid,
    orgId,
    instanceId,
    signupId: instanceId === null ? null : `${instanceId}_${uid}`,
    source: instanceId === null ? "manual" : "kiosk",
    date: tsAt(BASE_MS - 10 * DAY),
    minutes,
    status,
    needsReview: false,
    description: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectReason: null,
    createdAt: tsAt(BASE_MS),
    updatedAt: tsAt(BASE_MS)
  };
  return db.collection(COLLECTIONS.hoursLogs).doc(id).set(log);
};

const orgInput = (extra: Record<string, unknown> = {}) => ({
  orgId: "orgA",
  ...RANGE,
  sections: ["summary", "hoursByMonth", "topVolunteers"],
  themeId: "blue",
  requestNonce: NONCE_1,
  ...extra
});
const volunteerInput = (extra: Record<string, unknown> = {}) => ({ ...RANGE, sections: ["summary", "shiftList", "milestones"], themeId: "green", requestNonce: NONCE_1, ...extra });

const reportDoc = async (id: string) => (await db.collection(COLLECTIONS.reports).doc(id).get()).data() as ReportDoc;
const pdfBytes = async (path: string) => (await storage.bucket(BUCKET).file(path).download())[0];

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
  await seedInstance("past1", { startMs: BASE_MS - 10 * DAY });
  await seedSignup("past1", "vol1", "completed");
  await seedSignup("past1", "vol2", "no-show");
  await seedLog("logA1", "vol1", "orgA", 240, "past1");
  await seedLog("logA2", "vol3", "orgA", 60, null, "pending");
  await seedLog("logB1", "vol1", "orgB", 120, null);
});

describe("coordinator.generateOrgReport", () => {
  it("renders the PDF to the coordinator's folder and marks the report ready", async () => {
    const result = await call<ReportResult>("coordinator", "generateOrgReport", orgInput(), user("coordA"));
    expect(result.status).toBe("ready");
    expect(result.reportId).toMatch(/^[0-9a-f]{32}$/);
    expect(result.pdfPath).toBe(`reports/coordA/${result.reportId}.pdf`);
    expect((await pdfBytes(result.pdfPath)).subarray(0, 5).toString()).toBe("%PDF-");
    expect(await reportDoc(result.reportId)).toMatchObject({
      ownerUid: "coordA",
      kind: "org-participation",
      orgId: "orgA",
      status: "ready",
      params: { ...RANGE, sections: ["summary", "hoursByMonth", "topVolunteers"], themeId: "blue", opportunityId: null }
    });
  });

  it("returns the same report for the same nonce and a new one for a new nonce", async () => {
    const first = await call<ReportResult>("coordinator", "generateOrgReport", orgInput(), user("coordA"));
    const again = await call<ReportResult>("coordinator", "generateOrgReport", orgInput(), user("coordA"));
    expect(again).toEqual(first);
    const other = await call<ReportResult>("coordinator", "generateOrgReport", orgInput({ requestNonce: NONCE_2, opportunityId: "opp1" }), user("coordA"));
    expect(other.reportId).not.toBe(first.reportId);
    expect((await db.collection(COLLECTIONS.reports).where("ownerUid", "==", "coordA").get()).size).toBe(2);
  });

  it("re-renders a failed report with the same nonce", async () => {
    const first = await call<ReportResult>("coordinator", "generateOrgReport", orgInput(), user("coordA"));
    await db.collection(COLLECTIONS.reports).doc(first.reportId).update({ status: "failed" });
    const retried = await call<ReportResult>("coordinator", "generateOrgReport", orgInput(), user("coordA"));
    expect(retried).toEqual(first);
    expect((await reportDoc(first.reportId)).status).toBe("ready");
  });

  it("denies other orgs' coordinators, volunteers, and kiosk tokens (cross-org, G2)", async () => {
    await expectCode(call("coordinator", "generateOrgReport", orgInput(), user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "generateOrgReport", orgInput(), user("vol1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "generateOrgReport", orgInput(), kioskUser("past1")), "PERMISSION_DENIED");
    expect((await db.collection(COLLECTIONS.reports).get()).size).toBe(0);
  });

  it("answers NOT_FOUND for an unknown org and INVALID_INPUT for bad sections or ranges", async () => {
    await expectCode(call("coordinator", "generateOrgReport", orgInput({ orgId: "nope" }), user("coordA")), "NOT_FOUND");
    await expectCode(call("coordinator", "generateOrgReport", orgInput({ sections: ["shiftList"] }), user("coordA")), "INVALID_INPUT");
    await expectCode(call("coordinator", "generateOrgReport", orgInput({ sections: [] }), user("coordA")), "INVALID_INPUT");
    await expectCode(call("coordinator", "generateOrgReport", orgInput({ from: "2026-10-17", to: "2026-09-01" }), user("coordA")), "INVALID_INPUT");
    await expectCode(call("coordinator", "generateOrgReport", orgInput({ themeId: "#FF0000" }), user("coordA")), "INVALID_INPUT");
  });
});

describe("volunteer.generateVolunteerReport", () => {
  it("renders the caller's own report into their folder, idempotent per nonce", async () => {
    const first = await call<ReportResult>("volunteer", "generateVolunteerReport", volunteerInput(), user("vol1"));
    expect(first).toMatchObject({ status: "ready", pdfPath: `reports/vol1/${first.reportId}.pdf` });
    expect((await pdfBytes(first.pdfPath)).subarray(0, 5).toString()).toBe("%PDF-");
    expect(await reportDoc(first.reportId)).toMatchObject({ ownerUid: "vol1", kind: "volunteer-hours", orgId: null, status: "ready" });
    expect(await call<ReportResult>("volunteer", "generateVolunteerReport", volunteerInput(), user("vol1"))).toEqual(first);
  });

  it("keeps each volunteer's report in their own folder, even with the same nonce", async () => {
    const mine = await call<ReportResult>("volunteer", "generateVolunteerReport", volunteerInput(), user("vol1"));
    const theirs = await call<ReportResult>("volunteer", "generateVolunteerReport", volunteerInput(), user("vol2"));
    expect(theirs.reportId).not.toBe(mine.reportId);
    expect(theirs.pdfPath).toBe(`reports/vol2/${theirs.reportId}.pdf`);
  });

  it("requires a finished profile and refuses kiosk tokens", async () => {
    await expectCode(call("volunteer", "generateVolunteerReport", volunteerInput(), user("incomplete")), "PROFILE_INCOMPLETE");
    await expectCode(call("volunteer", "generateVolunteerReport", volunteerInput(), kioskUser("past1", BASE_MS + HOUR)), "PERMISSION_DENIED");
  });
});
