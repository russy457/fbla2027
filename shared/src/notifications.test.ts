/**
 * notifications.test.ts
 * SPEC 8.3 copy and links for each notification type, deterministic ids,
 * the 99+ badge cap, and the inbox document schemas.
 */
import { fromZonedTime } from "date-fns-tz";
import { describe, expect, it } from "vitest";
import {
  attendanceChangedNotification,
  dayAndTime,
  disputeOpenedNotification,
  hoursApprovedNotification,
  hoursRejectedNotification,
  letterRevokedNotification,
  letterSupersededNotification,
  notificationIdFor,
  shiftCancelledNotification,
  shiftChangedNotification,
  unreadBadgeText,
  waitlistClosedNotification,
  waitlistPromotedNotification,
  type ShiftRef
} from "./notifications";
import { PATHS } from "./collections";
import { notificationDocSchema, savedItemDocSchema, savedItemIdFor } from "./schemas/inboxDocs";
import { markNotificationsReadInput } from "./schemas/ops/inboxOps";

const CHI = "America/Chicago";
const shift: ShiftRef = {
  instanceId: "inst1",
  signupId: "inst1_vol1",
  title: "Reading buddies",
  orgName: "Westside Literacy",
  startMs: fromZonedTime("2026-10-17T09:00:00", CHI).getTime(),
  timeZone: CHI
};

describe("notification copy (SPEC 8.3)", () => {
  it("waitlist-promoted says You're in with the day and time and links to the shift", () => {
    const content = waitlistPromotedNotification(shift);
    expect(content).toMatchObject({
      type: "waitlist-promoted",
      title: "You're in! Saturday 9 AM",
      link: "/opportunity/inst1",
      data: { instanceId: "inst1", signupId: "inst1_vol1" }
    });
  });

  it("shows minutes only when they are not zero", () => {
    expect(dayAndTime(fromZonedTime("2026-10-17T09:30:00", CHI).getTime(), CHI)).toBe("Saturday 9:30 AM");
  });

  it("covers the shift notifications", () => {
    expect(waitlistClosedNotification(shift).title).toBe("The waitlist for Reading buddies closed");
    expect(shiftCancelledNotification({ ...shift, signupId: undefined })).toMatchObject({
      title: "Reading buddies on Oct 17 was cancelled by the organization",
      data: { instanceId: "inst1" }
    });
    expect(shiftChangedNotification(shift).title).toBe("Reading buddies moved to Sat, Oct 17, 9:00 AM CDT");
    expect(attendanceChangedNotification(shift)).toMatchObject({ title: "Your attendance for Reading buddies was updated", link: "/me/shifts" });
    expect(disputeOpenedNotification("Jordan R.", shift, "orgA")).toMatchObject({
      title: "Jordan R. asked for a review of Reading buddies",
      link: "/org/orgA/dashboard"
    });
  });

  it("covers hours and letters", () => {
    expect(hoursApprovedNotification(2.5, "Westside Literacy").title).toBe("2.5 hours approved at Westside Literacy");
    expect(hoursApprovedNotification(1, "Westside Literacy").title).toBe("1 hour approved at Westside Literacy");
    expect(hoursRejectedNotification("Westside Literacy", "Not on the roster").title).toBe("Hours at Westside Literacy were not approved: Not on the roster");
    expect(letterSupersededNotification("L1")).toMatchObject({ title: "Your letter's hours changed", data: { letterId: "L1" }, link: "/impact" });
    expect(letterRevokedNotification("L1").title).toBe("A letter was revoked");
  });
});

describe("ids and badge", () => {
  it("builds deterministic ids", () => {
    expect(notificationIdFor("waitlist-promoted", "inst1_vol1")).toBe("waitlist-promoted_inst1_vol1");
    expect(savedItemIdFor("opportunity", "opp1")).toBe("opportunity_opp1");
  });

  it("caps the badge at 99+", () => {
    expect(unreadBadgeText(0)).toBe("0");
    expect(unreadBadgeText(99)).toBe("99");
    expect(unreadBadgeText(100)).toBe("99+");
  });
});

describe("inbox paths", () => {
  it("nests items under the user", () => {
    expect(PATHS.notificationItems("u1")).toBe("notifications/u1/items");
    expect(PATHS.notificationItem("u1", "n1")).toBe("notifications/u1/items/n1");
    expect(PATHS.savedItems("u1")).toBe("users/u1/saved");
    expect(PATHS.savedItem("u1", "org_a")).toBe("users/u1/saved/org_a");
  });

  it("accepts itemIds or all, but not both or neither", () => {
    expect(markNotificationsReadInput.safeParse({ itemIds: ["a"] }).success).toBe(true);
    expect(markNotificationsReadInput.safeParse({ all: true }).success).toBe(true);
    expect(markNotificationsReadInput.safeParse({ itemIds: ["a"], all: true }).success).toBe(false);
    expect(markNotificationsReadInput.safeParse({}).success).toBe(false);
  });
});

describe("inbox schemas", () => {
  const ts = { toMillis: () => 0, toDate: () => new Date(0) };

  it("accepts a well-formed notification and rejects an external link", () => {
    const doc = { ...waitlistPromotedNotification(shift), read: false, createdAt: ts, updatedAt: ts };
    expect(notificationDocSchema.safeParse(doc).success).toBe(true);
    expect(notificationDocSchema.safeParse({ ...doc, link: "//evil.example" }).success).toBe(false);
  });

  it("accepts a saved item and rejects extra keys", () => {
    expect(savedItemDocSchema.safeParse({ kind: "org", refId: "orgA", savedAt: ts }).success).toBe(true);
    expect(savedItemDocSchema.safeParse({ kind: "org", refId: "orgA", savedAt: ts, extra: 1 }).success).toBe(false);
  });
});
