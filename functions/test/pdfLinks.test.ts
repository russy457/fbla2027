/**
 * pdfLinks.test.ts
 * volunteer.getPdfUrl and coordinator.getOrgReportUrl (SPEC 3.22, Appendix
 * B 48): short-lived links to private PDFs instead of permanent Storage
 * download tokens. Each op re-checks what storage.rules checks (only the
 * owner uid reads its folder), plus the letter or report document, and the
 * org report op re-checks current membership. Path inputs other than
 * letters/{uid}/{id}.pdf and reports/{uid}/{id}.pdf are refused before any
 * lookup. On the emulator the link is the Storage emulator download path
 * (signed URLs need real credentials), so the tests fetch it to prove it
 * serves the PDF.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS, PATHS, PDF_URL_TTL_MS, type HoursLogDoc } from "@fbla/shared";
import { BASE_MS, HOUR, call, db, expectCode, kioskUser, resetEmulators, tsAt, user } from "./harness";
import { seedWorld } from "./fixtures";

const NONCE = "11111111-1111-4111-8111-111111111111";
const DAY = 86_400_000;
const RANGE = { from: "2026-09-01", to: "2026-10-17" };

type ReportResult = { reportId: string; status: string; pdfPath: string };
type LinkResult = { url: string; expiresAt: string };

const seedApprovedLog = (id: string, uid: string, orgId: string, minutes: number) => {
  const log: HoursLogDoc = {
    uid,
    orgId,
    instanceId: null,
    signupId: null,
    source: "manual",
    date: tsAt(BASE_MS - 10 * DAY),
    minutes,
    status: "approved",
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

const volunteerReport = (uid: string) =>
  call<ReportResult>("volunteer", "generateVolunteerReport", { ...RANGE, sections: ["summary"], themeId: "green", requestNonce: NONCE }, user(uid));
const orgReport = (uid: string, orgId = "orgA") =>
  call<ReportResult>("coordinator", "generateOrgReport", { orgId, ...RANGE, sections: ["summary"], themeId: "blue", requestNonce: NONCE }, user(uid));

/** Fetches the link the way a browser tab would (no auth header) and returns the first bytes. */
const fetchHead = async (url: string): Promise<string> => {
  const response = await fetch(url);
  expect(response.ok).toBe(true);
  return Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString();
};

const expectWorkingLink = async (link: LinkResult, path: string): Promise<void> => {
  expect(link.url).toContain(encodeURIComponent(path));
  expect(link.url).not.toContain("token=");
  expect(Date.parse(link.expiresAt)).toBe(BASE_MS + PDF_URL_TTL_MS);
  expect(await fetchHead(link.url)).toBe("%PDF-");
};

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
});

describe("volunteer.getPdfUrl", () => {
  it("links the caller's own hours report and letter PDFs", async () => {
    const report = await volunteerReport("vol1");
    await expectWorkingLink(await call<LinkResult>("volunteer", "getPdfUrl", { path: report.pdfPath }, user("vol1")), report.pdfPath);

    await seedApprovedLog("log1", "vol1", "orgA", 120);
    const letter = await call<{ letterId: string }>("volunteer", "issueLetter", { scope: { orgId: "ALL", ...RANGE }, requestNonce: NONCE }, user("vol1"));
    const letterPath = PATHS.letterPdf("vol1", letter.letterId);
    await expectWorkingLink(await call<LinkResult>("volunteer", "getPdfUrl", { path: letterPath }, user("vol1")), letterPath);
  });

  it("denies another user's path, and a path that names you but holds someone else's document", async () => {
    const report = await volunteerReport("vol1");
    await expectCode(call("volunteer", "getPdfUrl", { path: report.pdfPath }, user("vol2")), "PERMISSION_DENIED");
    await expectCode(call("volunteer", "getPdfUrl", { path: `reports/vol2/${report.reportId}.pdf` }, user("vol2")), "NOT_FOUND");
    await expectCode(call("volunteer", "getPdfUrl", { path: `letters/vol2/${report.reportId}.pdf` }, user("vol2")), "NOT_FOUND");
    await expectCode(call("volunteer", "getPdfUrl", { path: "reports/vol1/0123456789abcdef0123456789abcdef.pdf" }, user("vol1")), "NOT_FOUND");
  });

  it("refuses path-traversal and any other path shape before a lookup", async () => {
    const report = await volunteerReport("vol1");
    const bad = [
      `reports/vol1/../vol2/${report.reportId}.pdf`,
      `reports/vol2/../vol1/${report.reportId}.pdf`,
      `letters/vol1/x.pdf/../../reports/vol2/${report.reportId}.pdf`,
      `/reports/vol1/${report.reportId}.pdf`,
      `reports/vol1/${report.reportId}.pdf?alt=media`,
      `reports%2Fvol1%2F${report.reportId}.pdf`,
      `reports/vol1/sub/${report.reportId}.pdf`,
      `reports/vol1/${report.reportId}`,
      `reports\\vol1\\${report.reportId}.pdf`,
      `avatars/vol1/${report.reportId}.pdf`,
      `orgs/orgA/photos/${report.reportId}.pdf`,
      "reports/vol1/..pdf",
      ""
    ];
    for (const path of bad) {
      await expectCode(call("volunteer", "getPdfUrl", { path }, user("vol1")), "INVALID_INPUT");
    }
    await expectCode(call("volunteer", "getPdfUrl", { path: report.pdfPath, uid: "vol2" }, user("vol1")), "INVALID_INPUT");
  });

  it("refuses PDFs that are not ready, org reports (use getOrgReportUrl), incomplete profiles, and kiosk tokens", async () => {
    const report = await volunteerReport("vol1");
    await db.collection(COLLECTIONS.reports).doc(report.reportId).update({ status: "failed" });
    await expectCode(call("volunteer", "getPdfUrl", { path: report.pdfPath }, user("vol1")), "NOT_FOUND");

    const org = await orgReport("coordA");
    await expectCode(call("volunteer", "getPdfUrl", { path: org.pdfPath }, user("coordA")), "PERMISSION_DENIED");

    await expectCode(call("volunteer", "getPdfUrl", { path: "reports/incomplete/abc.pdf" }, user("incomplete")), "PROFILE_INCOMPLETE");
    await expectCode(call("volunteer", "getPdfUrl", { path: report.pdfPath }, kioskUser("inst1", BASE_MS + HOUR)), "PERMISSION_DENIED");
  });
});

describe("coordinator.getOrgReportUrl", () => {
  it("links an org report the caller generated for that org", async () => {
    const report = await orgReport("coordA");
    const link = await call<LinkResult>("coordinator", "getOrgReportUrl", { orgId: "orgA", reportId: report.reportId }, user("coordA"));
    await expectWorkingLink(link, report.pdfPath);
  });

  it("denies other orgs' coordinators, fellow coordinators, volunteers, removed members, and kiosk tokens", async () => {
    const report = await orgReport("coordA");
    const input = { orgId: "orgA", reportId: report.reportId };
    await expectCode(call("coordinator", "getOrgReportUrl", input, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "getOrgReportUrl", { orgId: "orgB", reportId: report.reportId }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "getOrgReportUrl", input, user("vol1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "getOrgReportUrl", input, kioskUser("inst1", BASE_MS + HOUR)), "PERMISSION_DENIED");

    // A second coordinator of the same org generates their own copy (storage.rules: owner-only folders).
    await db.doc(PATHS.member("orgA", "vol2")).set({
      uid: "vol2", orgId: "orgA", role: "coordinator", displayName: "V", canViewContacts: true, invitedBy: "coordA",
      joinedAt: tsAt(BASE_MS), createdAt: tsAt(BASE_MS), updatedAt: tsAt(BASE_MS)
    });
    await expectCode(call("coordinator", "getOrgReportUrl", input, user("vol2")), "PERMISSION_DENIED");

    await db.doc(PATHS.member("orgA", "coordA")).delete();
    await expectCode(call("coordinator", "getOrgReportUrl", input, user("coordA")), "PERMISSION_DENIED");
  });

  it("answers NOT_FOUND for unknown, not-ready, other-org, and volunteer-hours reports, and INVALID_INPUT for bad ids", async () => {
    await expectCode(call("coordinator", "getOrgReportUrl", { orgId: "orgA", reportId: "nope" }, user("coordA")), "NOT_FOUND");
    const own = await volunteerReport("coordA");
    await expectCode(call("coordinator", "getOrgReportUrl", { orgId: "orgA", reportId: own.reportId }, user("coordA")), "NOT_FOUND");

    const report = await orgReport("coordA");
    await db.doc(PATHS.member("orgB", "coordA")).set({
      uid: "coordA", orgId: "orgB", role: "coordinator", displayName: "O", canViewContacts: true, invitedBy: "coordB",
      joinedAt: tsAt(BASE_MS), createdAt: tsAt(BASE_MS), updatedAt: tsAt(BASE_MS)
    });
    await expectCode(call("coordinator", "getOrgReportUrl", { orgId: "orgB", reportId: report.reportId }, user("coordA")), "NOT_FOUND");
    await db.collection(COLLECTIONS.reports).doc(report.reportId).update({ status: "generating" });
    await expectCode(call("coordinator", "getOrgReportUrl", { orgId: "orgA", reportId: report.reportId }, user("coordA")), "NOT_FOUND");

    await expectCode(call("coordinator", "getOrgReportUrl", { orgId: "orgA", reportId: "../x" }, user("coordA")), "INVALID_INPUT");
    await expectCode(call("coordinator", "getOrgReportUrl", { orgId: "orgA", reportId: report.reportId, path: "reports/coordB/x.pdf" }, user("coordA")), "INVALID_INPUT");
  });
});
