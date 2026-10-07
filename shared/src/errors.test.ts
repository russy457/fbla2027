import { describe, expect, it } from "vitest";
import { AppError, ERROR_CATALOG, describeError, isAppError, isErrorCode, type ErrorCode } from "./errors";

const codes = Object.keys(ERROR_CATALOG) as ErrorCode[];

describe("ERROR_CATALOG", () => {
  it.each(codes)("%s has a message, a fix, and a help slug or explicit null", (code) => {
    const found = ERROR_CATALOG[code];
    expect(found.code).toBe(code);
    expect(found.message({}).length).toBeGreaterThan(0);
    expect(found.fix.length).toBeGreaterThan(0);
    expect(found.helpSlug === null || /^[a-z0-9-]+$/.test(found.helpSlug)).toBe(true);
  });

  it("contains the starter entries the plan requires", () => {
    expect(codes).toEqual(expect.arrayContaining(["UNAUTHENTICATED", "PERMISSION_DENIED", "PROFILE_INCOMPLETE", "NOT_FOUND"]));
  });

  it("never uses em dashes in user-facing copy", () => {
    for (const code of codes) {
      const { message, fix } = describeError(code, { resource: "shift", field: "email", op: "x" });
      expect(`${message} ${fix}`).not.toMatch(/[–—]/);
    }
  });
});

describe("describeError", () => {
  it("fills params into the message", () => {
    expect(describeError("NOT_FOUND", { resource: "shift" }).message).toBe("We could not find that shift.");
    expect(describeError("INVALID_INPUT", { field: "phone" }).message).toBe("Please check the phone field.");
    expect(describeError("UNKNOWN_OPERATION", { op: "teleport" }).message).toContain("teleport");
  });

  it("falls back to generic copy without params", () => {
    expect(describeError("NOT_FOUND").message).toBe("We could not find that.");
    expect(describeError("INVALID_INPUT").message).toBe("Some of the information sent was not valid.");
    expect(describeError("UNKNOWN_OPERATION").message).toContain("(none)");
  });

  it("carries the wire code and help slug", () => {
    expect(describeError("UNAUTHENTICATED")).toMatchObject({
      code: "UNAUTHENTICATED",
      httpsCode: "unauthenticated",
      helpSlug: "signing-in"
    });
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
    const error = new AppError("NOT_FOUND", { resource: "letter" });
    expect(error.params).toEqual({ resource: "letter" });
    expect(error.describe().message).toBe("We could not find that letter.");
  });
});

describe("isErrorCode", () => {
  it("accepts catalog codes only", () => {
    expect(isErrorCode("NOT_FOUND")).toBe(true);
    expect(isErrorCode("toString")).toBe(false);
    expect(isErrorCode(42)).toBe(false);
  });
});
