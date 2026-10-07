/**
 * ics.test.ts
 * SPEC#ics 8.7 and SPEC#tests 12.1: confirmed and cancelled files
 * (METHOD:CANCEL, SEQUENCE + 1), a non-Chicago zone, the DST changes, no-DST
 * and southern-hemisphere zones, escaping, and line folding.
 */
import { fromZonedTime } from "date-fns-tz";
import { describe, expect, it } from "vitest";
import { buildSignupIcs, buildVTimezone, utf8Length, escapeIcsText, foldIcsLine, formatIcsOffset, icsFileName, zoneTransitionsInYear, type SignupIcsInput } from "./ics";

const local = (iso: string, zone: string): number => fromZonedTime(iso, zone).getTime();

const base: SignupIcsInput = {
  signupId: "inst1_vol1",
  appHost: "fbla2027.example",
  productName: "fbla 2027",
  title: "Sort food, pack boxes; stack shelves",
  orgName: "Common Table Pantry",
  description: "Bring closed-toe shoes.",
  location: "1 Main St, Example City, TX 78205",
  url: "https://fbla2027.example/opportunity/inst1",
  startMs: local("2026-10-17T09:00:00", "America/Chicago"),
  endMs: local("2026-10-17T13:00:00", "America/Chicago"),
  timeZone: "America/Chicago",
  sequence: 2,
  stampMs: Date.UTC(2026, 9, 10, 15, 4, 5),
  cancelled: false
};

const unfold = (ics: string): string[] => ics.replace(/\r\n /g, "").split("\r\n");

describe("buildSignupIcs", () => {
  it("writes a confirmed event in the org zone with a stable UID", () => {
    const ics = buildSignupIcs(base);
    const lines = unfold(ics);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(lines).toContain("METHOD:PUBLISH");
    expect(lines).toContain("UID:inst1_vol1@fbla2027.example");
    expect(lines).toContain("SEQUENCE:2");
    expect(lines).toContain("DTSTAMP:20261010T150405Z");
    expect(lines).toContain("DTSTART;TZID=America/Chicago:20261017T090000");
    expect(lines).toContain("DTEND;TZID=America/Chicago:20261017T130000");
    expect(lines).toContain("SUMMARY:Sort food\\, pack boxes\\; stack shelves");
    expect(lines).toContain("LOCATION:1 Main St\\, Example City\\, TX 78205");
    expect(lines).toContain("STATUS:CONFIRMED");
    expect(lines).toContain("URL:https://fbla2027.example/opportunity/inst1");
    expect(lines).toContain("TZID:America/Chicago");
    expect(lines.find((line) => line.startsWith("DESCRIPTION:"))).toBe(
      "DESCRIPTION:Bring closed-toe shoes.\\nOrganization: Common Table Pantry\\nDetails: https://fbla2027.example/opportunity/inst1"
    );
  });

  it("writes a cancellation with METHOD:CANCEL and SEQUENCE + 1", () => {
    const lines = unfold(buildSignupIcs({ ...base, cancelled: true }));
    expect(lines).toContain("METHOD:CANCEL");
    expect(lines).toContain("STATUS:CANCELLED");
    expect(lines).toContain("SEQUENCE:3");
  });

  it("falls back to the org name for location and skips empty description parts", () => {
    const lines = unfold(buildSignupIcs({ ...base, location: null, description: null, url: null }));
    expect(lines).toContain("LOCATION:Common Table Pantry");
    expect(lines).toContain("DESCRIPTION:Organization: Common Table Pantry");
    expect(lines.some((line) => line.startsWith("URL:"))).toBe(false);
  });

  it("keeps local wall time across the spring DST change in America/Denver", () => {
    const zone = "America/Denver";
    const ics = buildSignupIcs({
      ...base,
      timeZone: zone,
      startMs: local("2027-03-14T01:00:00", zone),
      endMs: local("2027-03-14T04:00:00", zone)
    });
    const lines = unfold(ics);
    expect(lines).toContain("DTSTART;TZID=America/Denver:20270314T010000");
    expect(lines).toContain("DTEND;TZID=America/Denver:20270314T040000");
    const daylight = lines.indexOf("BEGIN:DAYLIGHT");
    expect(lines.slice(daylight, daylight + 6)).toEqual([
      "BEGIN:DAYLIGHT",
      "DTSTART:20270314T020000",
      "TZOFFSETFROM:-0700",
      "TZOFFSETTO:-0600",
      "TZNAME:MDT",
      "END:DAYLIGHT"
    ]);
  });

  it("describes the fall-back change in November", () => {
    const vtz = buildVTimezone("America/Denver", local("2027-11-07T01:00:00", "America/Denver"));
    const standard = vtz.lastIndexOf("BEGIN:STANDARD");
    expect(vtz.slice(standard, standard + 5)).toEqual(["BEGIN:STANDARD", "DTSTART:20271107T020000", "TZOFFSETFROM:-0600", "TZOFFSETTO:-0700", "TZNAME:MST"]);
  });
});

describe("time zone details", () => {
  it("lists no transitions for a zone without DST", () => {
    expect(zoneTransitionsInYear("America/Phoenix", 2027)).toEqual([]);
    const vtz = buildVTimezone("America/Phoenix", Date.UTC(2027, 5, 1));
    expect(vtz.filter((line) => line.startsWith("BEGIN:"))).toEqual(["BEGIN:VTIMEZONE", "BEGIN:STANDARD"]);
  });

  it("marks January as daylight time in the southern hemisphere", () => {
    const vtz = buildVTimezone("Australia/Sydney", Date.UTC(2027, 0, 15));
    expect(vtz[2]).toBe("BEGIN:DAYLIGHT");
    expect(vtz).toContain("TZOFFSETTO:+1000");
  });

  it("handles a zero offset (London in winter)", () => {
    const vtz = buildVTimezone("Europe/London", Date.UTC(2027, 0, 15));
    expect(vtz).toContain("TZOFFSETTO:+0000");
    expect(vtz).toContain("TZOFFSETTO:+0100");
  });

  it("formats offsets with sign, hours, and minutes", () => {
    expect(formatIcsOffset(-6 * 3_600_000)).toBe("-0600");
    expect(formatIcsOffset(5.5 * 3_600_000)).toBe("+0530");
    expect(formatIcsOffset(0)).toBe("+0000");
  });
});

describe("text helpers", () => {
  it("escapes backslashes, separators, and newlines", () => {
    expect(escapeIcsText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const long = `SUMMARY:${"é".repeat(60)}`;
    const folded = foldIcsLine(long);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    parts.forEach((part) => expect([...part].reduce((sum, char) => sum + utf8Length(char), 0)).toBeLessThanOrEqual(75));
    expect(folded.replace(/\r\n /g, "")).toBe(long);
    expect(foldIcsLine("SHORT")).toBe("SHORT");
    expect([utf8Length("a"), utf8Length("é"), utf8Length("€"), utf8Length("😀"), utf8Length("")]).toEqual([1, 2, 3, 4, 1]);
  });

  it("builds a safe file name", () => {
    expect(icsFileName("Sort & Pack: Food Boxes!", false)).toBe("sort-pack-food-boxes.ics");
    expect(icsFileName("Sort & Pack", true)).toBe("sort-pack-cancelled.ics");
    expect(icsFileName("!!!", false)).toBe("shift.ics");
  });
});
