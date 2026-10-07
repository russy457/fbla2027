import { describe, expect, it } from "vitest";
import { AppError, ERROR_CATALOG, HELP_SLUGS, describeError, isAppError, isErrorCode, toUserError, type ErrorCode } from "./errors";

const codes = Object.keys(ERROR_CATALOG) as ErrorCode[];

describe("ERROR_CATALOG (SPEC#errors)", () => {
  it.each(codes)("%s has a message, a fix, and a help slug or explicit null", (code) => {
    const found = ERROR_CATALOG[code];
    expect(found.code).toBe(code);
    expect(found.message({}).length).toBeGreaterThan(0);
    expect(found.fix.length).toBeGreaterThan(0);
    expect(found.helpSlug === null || (HELP_SLUGS as readonly string[]).includes(found.helpSlug)).toBe(true);
  });

  it("contains every code Tier 0 ops throw", () => {
    expect(codes).toEqual(
      expect.arrayContaining([
        "AUTH_REQUIRED",
        "PROFILE_INCOMPLETE",
        "PERMISSION_DENIED",
        "NOT_FOUND",
        "INVALID_INPUT",
        "CONTENTION",
        "INTERNAL",
        "AGE_UNDER_13",
        "AGE_BELOW_MIN",
        "MINOR_UNVERIFIED_ORG",
        "TURNSTILE_FAILED",
        "BIRTHDATE_LOCKED",
        "SHIFT_FULL",
        "SHIFT_STARTED",
        "SHIFT_CANCELLED",
        "SHIFT_NOT_ENDED",
        "SIGNUP_CANCELLED_BEFORE",
        "INVALID_TRANSITION",
        "RELEASE_NOT_ALLOWED",
        "CHECKIN_NOT_OPEN",
        "CHECKOUT_NOT_OPEN",
        "CHECKOUT_CLOSED",
        "NOT_SIGNED_UP",
        "NOT_CHECKED_IN",
        "KIOSK_CODE_INVALID",
        "KIOSK_NOT_OPEN",
        "KIOSK_SESSION_EXPIRED",
        "RATE_LIMITED",
        "NO_APPROVED_HOURS",
        "DEMO_MODE_REQUIRED"
      ])
    );
  });

  it("never uses em or en dashes in user-facing copy", () => {
    const params = { fields: "a", requestId: "r", minAge: 16, opensAtLabel: "9:30 AM CDT", retryAfterSec: 5, excess: 2, op: "x" };
    for (const code of codes) {
      const { message, fix } = describeError(code, params);
      expect(`${message} ${fix}`).not.toMatch(/[–—]/);
    }
  });
});

describe("describeError params", () => {
  it.each([
    ["INVALID_INPUT", { fields: "phone" }, "Some fields need attention. (phone)", "Some fields need attention."],
    ["INTERNAL", { requestId: "abc" }, "Something went wrong (ref: abc).", "Something went wrong."],
    [
      "AGE_BELOW_MIN",
      { minAge: 16 },
      "You must be at least 16 to join this shift.",
      "You must be at least the minimum age to join this shift."
    ],
    [
      "CHECKIN_NOT_OPEN",
      { opensAtLabel: "9:30 AM CDT" },
      "Check-in for this shift is not open right now. (opens 9:30 AM CDT)",
      "Check-in for this shift is not open right now."
    ],
    ["CHECKOUT_NOT_OPEN", { opensAtLabel: "9:47 AM CDT" }, "Check-out opens at 9:47 AM CDT.", "Check-out is not open yet."],
    ["RATE_LIMITED", { retryAfterSec: 42 }, "Too many attempts, wait a minute. (retry in 42 s)", "Too many attempts, wait a minute."],
    ["CAPACITY_BELOW_SIGNUPS", { excess: 2 }, "Remove volunteers first. (2 over the new capacity)", "Remove volunteers first."],
    [
      "UNKNOWN_OPERATION",
      { op: "teleport" },
      "This app version asked for an action the server does not know (teleport).",
      "This app version asked for an action the server does not know (none)."
    ]
  ] as const)("%s fills params and falls back without them", (code, params, withParams, without) => {
    expect(describeError(code, params).message).toBe(withParams);
    expect(describeError(code).message).toBe(without);
  });

  it("carries the wire code and help slug", () => {
    expect(describeError("AUTH_REQUIRED")).toMatchObject({ code: "AUTH_REQUIRED", httpsCode: "unauthenticated", helpSlug: null });
    expect(describeError("CONTENTION").httpsCode).toBe("aborted");
  });
});

describe("AppError", () => {
  it("is an Error whose message comes from the catalog", () => {
    const error = new AppError("PROFILE_INCOMPLETE");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppError");
    expect(error.message).toBe("Finish setting up your profile first.");
    expect(error.describe().httpsCode).toBe("failed-precondition");
    expect(isAppError(error)).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
  });

  it("keeps params for later description", () => {
    const error = new AppError("AGE_BELOW_MIN", { minAge: 18 });
    expect(error.params).toEqual({ minAge: 18 });
    expect(error.describe().message).toBe("You must be at least 18 to join this shift.");
  });
});

describe("isErrorCode", () => {
  it("accepts catalog codes only", () => {
    expect(isErrorCode("NOT_FOUND")).toBe(true);
    expect(isErrorCode("toString")).toBe(false);
    expect(isErrorCode(42)).toBe(false);
  });
});

describe("toUserError (SPEC#screen-errors)", () => {
  it("reads code, params, and requestId from callable error details", () => {
    const error = {
      code: "functions/resource-exhausted",
      details: { code: "RATE_LIMITED", params: { retryAfterSec: 30, nested: { x: 1 } }, requestId: "req-1" }
    };
    expect(toUserError(error)).toEqual({
      code: "RATE_LIMITED",
      title: "Please wait",
      message: "Too many attempts, wait a minute. (retry in 30 s)",
      fix: "Wait.",
      helpSlug: "troubleshooting-check-in",
      requestId: "req-1",
      params: { retryAfterSec: 30 }
    });
  });

  it("maps an AppError thrown locally", () => {
    expect(toUserError(new AppError("SHIFT_FULL"))).toMatchObject({ code: "SHIFT_FULL", title: "Please wait", requestId: null });
  });

  it("falls back to INTERNAL with the ref when the code is unknown", () => {
    expect(toUserError({ details: { code: "NOPE", requestId: "r9", params: "junk" } })).toMatchObject({
      code: "INTERNAL",
      message: "Something went wrong (ref: r9).",
      requestId: "r9"
    });
  });

  it("handles plain errors, non-objects, and non-string request ids", () => {
    expect(toUserError(new Error("boom"))).toMatchObject({ code: "INTERNAL", message: "Something went wrong.", requestId: null });
    expect(toUserError("oops").title).toBe("Something went wrong");
    expect(toUserError({ details: { code: "NOT_FOUND", requestId: 7 } })).toMatchObject({ code: "NOT_FOUND", requestId: null, params: {} });
  });
});
