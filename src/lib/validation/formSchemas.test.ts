/**
 * formSchemas.test.ts
 * Form validation (rubric: input validation): each schema rejects bad
 * format AND bad meaning with a plain message, and accepts good input.
 */
import { describe, expect, it } from "vitest";
import {
  birthDateSchema,
  createAccountFormSchema,
  isUnderMinimumAge,
  kioskCodeFormSchema,
  letterRangeSchema,
  nameStepSchema,
  phoneToE164,
  verifyCodeFormSchema,
  zipStepSchema
} from "./formSchemas";

const NOW = new Date(Date.UTC(2026, 9, 6, 17, 0, 0));
const firstMessage = (result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string | undefined =>
  result.success ? undefined : result.error?.issues[0]?.message;

describe("kioskCodeFormSchema", () => {
  it("accepts 6 digits and ignores spaces", () => {
    expect(kioskCodeFormSchema.parse({ code: "482 913" }).code).toBe("482913");
  });

  it.each([
    ["", "Enter the 6-digit code shown on the kiosk."],
    ["12a456", "Use numbers only."],
    ["12345", "The code has exactly 6 digits."],
    ["1234567", "The code has exactly 6 digits."]
  ])("rejects %j with a clear message", (code, message) => {
    expect(firstMessage(kioskCodeFormSchema.safeParse({ code }))).toBe(message);
  });
});

describe("birth date", () => {
  const schema = birthDateSchema(NOW);
  it("rejects impossible dates, the future, and typo years", () => {
    expect(firstMessage(schema.safeParse("2010-02-30"))).toBe("Enter a real date, like 2009-04-18.");
    expect(firstMessage(schema.safeParse("2030-01-01"))).toBe("A birth date can't be in the future.");
    expect(firstMessage(schema.safeParse("1066-10-14"))).toBe("Check the year.");
    expect(firstMessage(schema.safeParse(""))).toBe("Enter your birth date.");
  });

  it("finds the 13+ boundary on the exact birthday", () => {
    expect(isUnderMinimumAge("2013-10-06", NOW)).toBe(false); // 13 today
    expect(isUnderMinimumAge("2013-10-07", NOW)).toBe(true); // 13 tomorrow
  });
});

describe("account, name, zip", () => {
  it("requires a real email and an 8+ character password", () => {
    expect(firstMessage(createAccountFormSchema.safeParse({ email: "not-an-email", password: "longenough" }))).toBe("Enter a valid email address.");
    expect(firstMessage(createAccountFormSchema.safeParse({ email: "a@b.test", password: "short" }))).toBe("Use at least 8 characters.");
  });

  it("checks name letters and optional phone", () => {
    expect(nameStepSchema.safeParse({ firstName: "Sam", lastName: "O'Neil-Lee", phone: "" }).success).toBe(true);
    expect(firstMessage(nameStepSchema.safeParse({ firstName: "S4m", lastName: "Lee", phone: "" }))).toBe("Use letters in your first name.");
    expect(firstMessage(nameStepSchema.safeParse({ firstName: "Sam", lastName: "Lee", phone: "555" }))).toBe(
      "Enter a 10-digit phone number, or leave it blank."
    );
  });

  it("converts US phones to E.164", () => {
    expect(phoneToE164("(210) 555-0123")).toBe("+12105550123");
    expect(phoneToE164("1 210 555 0123")).toBe("+12105550123");
    expect(phoneToE164("555-0123")).toBeNull();
  });

  it("accepts a blank or 5-digit ZIP only", () => {
    expect(zipStepSchema.safeParse({ zip: "" }).success).toBe(true);
    expect(firstMessage(zipStepSchema.safeParse({ zip: "7820" }))).toBe("Enter a 5-digit ZIP code, or leave it blank.");
  });
});

describe("verify code and letter range", () => {
  it("normalizes printed codes before checking the 26-character shape", () => {
    expect(verifyCodeFormSchema.parse({ code: "abcd-efgh-ijkl-mnop-qrst-uvwx-yz" }).code).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(firstMessage(verifyCodeFormSchema.safeParse({ code: "ABC-1" }))).toBe("Letter codes have 26 letters and numbers (2 to 7).");
  });

  it("refuses ranges that end in the future or start after they end", () => {
    const schema = letterRangeSchema("2026-10-06");
    expect(firstMessage(schema.safeParse({ orgId: "ALL", from: "2026-01-01", to: "2026-10-07" }))).toBe("The end date can't be in the future.");
    expect(firstMessage(schema.safeParse({ orgId: "ALL", from: "2026-10-05", to: "2026-10-01" }))).toBe(
      "The start date must be on or before the end date."
    );
    expect(schema.safeParse({ orgId: "ALL", from: "2026-01-01", to: "2026-10-06" }).success).toBe(true);
  });
});
