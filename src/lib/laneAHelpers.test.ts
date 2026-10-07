/**
 * laneAHelpers.test.ts
 * Pure client helpers for Tier 1 lane A: the QR payload rules (G20), the
 * QR path, the per-signup .ics (E2), the badge card SVG (E4), and the E3
 * preference mapping between the device store and the private profile.
 */
import { describe, expect, it } from "vitest";
import { makeInstance } from "@/test/fixtures";
import { badgeCardSvg } from "./badgeCard";
import { signupIcs } from "./icsDownload";
import { fromProfilePreferences, samePreferences, toProfilePreferences } from "./preferenceSync";
import { parseCheckinPayload, qrPath, readCheckinParams } from "./qr";

const ORIGIN = "https://fbla2027.example";

describe("check-in QR payload", () => {
  it("accepts this app's /checkin link", () => {
    expect(parseCheckinPayload(`${ORIGIN}/checkin?i=demo-shift&c=123456`, ORIGIN)).toEqual({ instanceId: "demo-shift", code: "123456" });
  });

  it("refuses other origins, paths, bad codes, bad ids, and non-URLs", () => {
    expect(parseCheckinPayload(`https://evil.example/checkin?i=demo-shift&c=123456`, ORIGIN)).toBeNull();
    expect(parseCheckinPayload(`${ORIGIN}/login?i=demo-shift&c=123456`, ORIGIN)).toBeNull();
    expect(parseCheckinPayload(`${ORIGIN}/checkin?i=demo-shift&c=12345`, ORIGIN)).toBeNull();
    expect(parseCheckinPayload(`${ORIGIN}/checkin?i=a/b&c=123456`, ORIGIN)).toBeNull();
    expect(parseCheckinPayload("not a url", ORIGIN)).toBeNull();
    expect(readCheckinParams(new URLSearchParams())).toBeNull();
  });

  it("draws the modules as one path inside a quiet zone", () => {
    const path = qrPath(`${ORIGIN}/checkin?i=demo-shift&c=123456`);
    expect(path.size).toBeGreaterThan(21);
    expect(path.d.startsWith("M2 2h1v1h-1z")).toBe(true);
  });
});

describe("signupIcs", () => {
  it("builds a file named after the shift with the app host in the UID", () => {
    const { fileName, text } = signupIcs({ signupId: "shift-1_uid-1", instance: makeInstance(), opportunity: null, cancelled: false, origin: ORIGIN, nowMs: 0 });
    expect(fileName).toBe("sort-and-pack-food-boxes.ics");
    expect(text).toContain("UID:shift-1_uid-1@fbla2027.example");
    expect(text).toContain("LOCATION:Common Table Pantry");
  });

  it("uses the opportunity address and marks a cancellation", () => {
    const opportunity = {
      id: "opp-1",
      description: "Bring gloves",
      location: { address: { line1: "1 Main St", city: "Example City", state: "TX", zip: "78205" }, geo: null }
    } as unknown as Parameters<typeof signupIcs>[0]["opportunity"];
    const { fileName, text } = signupIcs({ signupId: "s", instance: makeInstance(), opportunity, cancelled: true, origin: ORIGIN, nowMs: 0 });
    expect(fileName).toBe("sort-and-pack-food-boxes-cancelled.ics");
    expect(text).toContain("LOCATION:1 Main St\\, Example City\\, TX 78205");
    expect(text).toContain("METHOD:CANCEL");
  });
});

describe("badgeCardSvg", () => {
  it("shows the public name, milestone, and hours, escaping text", () => {
    const svg = badgeCardSvg({
      displayName: "Jo <R.>",
      milestone: 25,
      totalHours: 25.5,
      colors: { background: "white", foreground: "black", muted: "gray", accent: "blue", accentForeground: "white" }
    });
    expect(svg).toContain("Jo &lt;R.&gt;");
    expect(svg).toContain("reached 25 volunteer hours");
    expect(svg).toContain("25.50 approved hours in total");
    expect(badgeCardSvg({ displayName: "A", milestone: 50, totalHours: 50, colors: { background: "a", foreground: "b", muted: "c", accent: "d", accentForeground: "e" } })).toContain(
      "50 approved hours"
    );
  });
});

describe("preference sync mapping (E3)", () => {
  const device = { textSize: "100", contrast: "standard", motion: "system" } as const;

  it("writes SPEC values to the profile", () => {
    expect(toProfilePreferences({ textSize: "150", contrast: "high", motion: "reduced" })).toEqual({ textSize: 150, contrast: "high", reducedMotion: true });
    expect(toProfilePreferences(device)).toEqual({ textSize: 100, contrast: "normal", reducedMotion: false });
  });

  it("lets saved account values win, field by field", () => {
    expect(fromProfilePreferences({ textSize: 125 }, device)).toEqual({ textSize: "125", contrast: "standard", motion: "system" });
    expect(fromProfilePreferences({ contrast: "high", reducedMotion: true }, device)).toEqual({ textSize: "100", contrast: "high", motion: "reduced" });
    expect(fromProfilePreferences({ contrast: "normal", reducedMotion: false }, { ...device, contrast: "high", motion: "reduced" })).toEqual(device);
    expect(samePreferences(device, { ...device })).toBe(true);
    expect(samePreferences(device, { ...device, motion: "reduced" })).toBe(false);
  });
});
