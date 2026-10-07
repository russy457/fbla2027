/**
 * kioskCode.test.ts
 * Unit tests for the kiosk HMAC (SPEC 5.10, G21): HKDF key derivation is
 * per instance and per key version, codes are 6 digits and deterministic per
 * window, and verification accepts exactly the current and previous window.
 */
import { describe, expect, it } from "vitest";
import { codeForWindow, deriveInstanceKey, verifyKioskCode } from "./kioskCode";

const SALT = Buffer.alloc(32, 7).toString("base64");
const KEY = deriveInstanceKey("master-secret", SALT, "inst1", 1);
const WINDOW_MS = 30_000;
const NOW = 1_800_000_000_000 + 12_000; // 12 s into a window

describe("deriveInstanceKey", () => {
  it("is 32 bytes and differs by instance, version, and secret", () => {
    expect(KEY).toHaveLength(32);
    expect(deriveInstanceKey("master-secret", SALT, "inst2", 1).equals(KEY)).toBe(false);
    expect(deriveInstanceKey("master-secret", SALT, "inst1", 2).equals(KEY)).toBe(false);
    expect(deriveInstanceKey("other-secret", SALT, "inst1", 1).equals(KEY)).toBe(false);
    expect(deriveInstanceKey("master-secret", SALT, "inst1", 1).equals(KEY)).toBe(true);
  });
});

describe("codeForWindow", () => {
  it("returns a stable, zero-padded 6-digit code per window", () => {
    const codes = Array.from({ length: 50 }, (_, index) => codeForWindow(KEY, index));
    codes.forEach((code) => expect(code).toMatch(/^\d{6}$/));
    expect(codeForWindow(KEY, 7)).toBe(codes[7]);
    expect(new Set(codes).size).toBeGreaterThan(45);
  });
});

describe("verifyKioskCode", () => {
  const index = Math.floor(NOW / WINDOW_MS);
  const accepted = [codeForWindow(KEY, index), codeForWindow(KEY, index - 1)];

  it("accepts the current and previous window", () => {
    expect(verifyKioskCode(KEY, codeForWindow(KEY, index), NOW, 30)).toBe(true);
    expect(verifyKioskCode(KEY, codeForWindow(KEY, index - 1), NOW, 30)).toBe(true);
  });

  it("rejects a stale (two windows old) or future code", () => {
    // A 1-in-a-million collision with an accepted code would legitimately pass, so compare against that.
    const stale = codeForWindow(KEY, index - 2);
    const future = codeForWindow(KEY, index + 1);
    expect(verifyKioskCode(KEY, stale, NOW, 30)).toBe(accepted.includes(stale));
    expect(verifyKioskCode(KEY, future, NOW, 30)).toBe(accepted.includes(future));
  });

  it("rejects a short code without throwing", () => {
    expect(verifyKioskCode(KEY, "12", NOW, 30)).toBe(false);
  });
});
