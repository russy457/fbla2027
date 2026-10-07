/**
 * screenLogic.test.ts
 * Small pure helpers behind Tier 0 screens: My Shifts grouping, the
 * dashboard's featured shift, roster contact rules (G14, T4), the
 * onboarding payload, safe redirects, the one-time kiosk token handoff,
 * and the Explore day grouping.
 */
import { describe, expect, it } from "vitest";
import { groupInstancesByDay } from "@/hooks/useInstanceDays";
import { MINUTE, SHIFT_END_MS, SHIFT_START_MS, makeInstance, makeSignup, ts } from "@/test/fixtures";
import { setKioskHandoff, takeKioskHandoff } from "./kioskHandoff";
import { groupMyShifts } from "./myShifts";
import { EMPTY_DRAFT, toCompleteProfileInput } from "./onboardingDraft";
import { pickFeaturedShift } from "./orgShifts";
import { buildRosterRows } from "./rosterRows";
import { safeNextPath } from "./safeRedirect";

describe("groupMyShifts", () => {
  it("keeps a checked-in shift as next until check-out closes, and leaves cancelled out", () => {
    const active = makeSignup({ id: "a", status: "checked-in" });
    const later = makeSignup({ id: "b", instanceStart: ts(SHIFT_START_MS + 86_400_000), instanceEnd: ts(SHIFT_END_MS + 86_400_000) });
    const cancelled = makeSignup({ id: "c", status: "cancelled" });
    const groups = groupMyShifts([later, cancelled, active], SHIFT_END_MS + 20 * MINUTE);
    expect(groups.next?.id).toBe("a");
    expect(groups.upcoming.map((signup) => signup.id)).toEqual(["b"]);
    expect(groups.past).toEqual([]);
  });

  it("moves completed and long-over shifts to past, newest first", () => {
    const done = makeSignup({ id: "done", status: "completed" });
    const missed = makeSignup({ id: "missed", instanceStart: ts(SHIFT_START_MS - 86_400_000), instanceEnd: ts(SHIFT_END_MS - 86_400_000) });
    const groups = groupMyShifts([missed, done], SHIFT_END_MS + 31 * MINUTE);
    expect(groups.next).toBeNull();
    expect(groups.past.map((signup) => signup.id)).toEqual(["done", "missed"]);
  });
});

describe("pickFeaturedShift", () => {
  it("features the earliest live shift and skips cancelled or long-finished ones", () => {
    const cancelled = makeInstance({ id: "x", status: "cancelled", start: ts(SHIFT_START_MS - 60 * MINUTE) });
    const old = makeInstance({ id: "old", start: ts(SHIFT_START_MS - 86_400_000), end: ts(SHIFT_END_MS - 86_400_000) });
    const today = makeInstance({ id: "today" });
    const tomorrow = makeInstance({ id: "tomorrow", start: ts(SHIFT_START_MS + 86_400_000), end: ts(SHIFT_END_MS + 86_400_000) });
    const { featured, upcoming } = pickFeaturedShift([tomorrow, old, cancelled, today], SHIFT_START_MS);
    expect(featured?.id).toBe("today");
    expect(upcoming.map((shift) => shift.id)).toEqual(["tomorrow"]);
  });
});

describe("buildRosterRows", () => {
  const signups = [
    makeSignup({ id: "s1", displayName: "Sam L.", status: "confirmed" }),
    makeSignup({ id: "s2", displayName: "Jordan R.", status: "checked-in", checkInAt: ts(SHIFT_START_MS) }),
    makeSignup({ id: "s3", displayName: "Gone G.", status: "cancelled" })
  ];

  it("lists arrivals first and drops cancelled signups", () => {
    expect(buildRosterRows(signups, [], true).map((row) => row.displayName)).toEqual(["Jordan R.", "Sam L."]);
  });

  it("applies the contact rules: shown, hidden for unverified-org minors, and not shared", () => {
    const contacts = [
      { id: "s1", hidden: true },
      { id: "s2", hidden: false, email: "jordan@example.test", phone: null }
    ];
    const rows = buildRosterRows(signups, contacts, true);
    expect(rows.find((row) => row.id === "s1")?.contact).toEqual({ kind: "hidden-unverified" });
    expect(rows.find((row) => row.id === "s2")?.contact).toEqual({ kind: "shown", email: "jordan@example.test", phone: null });
    expect(buildRosterRows(signups, contacts, false)[0]?.contact).toEqual({ kind: "not-shared" });
  });
});

describe("toCompleteProfileInput", () => {
  it("omits skipped steps and converts the phone", () => {
    const input = toCompleteProfileInput(
      { ...EMPTY_DRAFT, birthDate: "2008-01-02", firstName: " Sam ", lastName: "Lee", phone: "210-555-0123", interests: ["seniors"] },
      "token-1"
    );
    expect(input).toEqual({
      firstName: "Sam",
      lastName: "Lee",
      birthDate: "2008-01-02",
      interests: ["seniors"],
      phone: "+12105550123",
      zip: null,
      turnstileToken: "token-1"
    });
  });

  it("sends no token when the human check was skipped on the emulators", () => {
    expect("turnstileToken" in toCompleteProfileInput({ ...EMPTY_DRAFT, firstName: "A", lastName: "B" }, null)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    [null, "/"],
    ["/me/shifts", "/me/shifts"],
    ["//evil.test", "/"],
    ["https://evil.test", "/"],
    ["/\\evil.test", "/"]
  ])("%j -> %j", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });
});

describe("kiosk token handoff", () => {
  it("hands the token over once, and only for the same shift", () => {
    setKioskHandoff("shift-1", "token-abc");
    expect(takeKioskHandoff("shift-2")).toBeNull();
    expect(takeKioskHandoff("shift-1")).toBe("token-abc");
    expect(takeKioskHandoff("shift-1")).toBeNull();
  });
});

describe("groupInstancesByDay", () => {
  it("groups by the shift's own day, labels today, and hides ended shifts", () => {
    const today = makeInstance({ id: "t" });
    const ended = makeInstance({ id: "e", start: ts(SHIFT_START_MS - 180 * MINUTE), end: ts(SHIFT_START_MS - 120 * MINUTE) });
    const days = groupInstancesByDay([ended, today], SHIFT_START_MS - 60 * MINUTE + 1);
    expect(days).toHaveLength(1);
    expect(days[0]?.label).toBe("Today");
    expect(days[0]?.instances.map((instance) => instance.id)).toEqual(["t"]);
  });
});
