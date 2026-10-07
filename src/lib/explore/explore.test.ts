/**
 * explore.test.ts
 * Explore smart filters (SPEC 8.5): URL round trip, malformed input, each
 * filter alone; geohash decoding; and recommendations (SPEC 9.2): only
 * joinable shifts, best match first, one-line why.
 */
import { describe, expect, it } from "vitest";
import { encodeGeohash } from "@/lib/search";
import { MINUTE, SHIFT_START_MS, makeInstance } from "@/test/fixtures";
import { EMPTY_FILTERS, type FilterContext, activeFilterCount, applyFilters, filtersToParams, parseFilters, type ExploreRow } from "./filters";
import { decodeGeohash } from "./geohash";
import { recommendShifts, whyText } from "./recommendations";

const DEMO_POINT = { lat: 29.4241, lng: -98.4936 };
const AUSTIN = { lat: 30.2672, lng: -97.7431 };

const opportunity = (overrides: Partial<NonNullable<ExploreRow["opportunity"]>> = {}): NonNullable<ExploreRow["opportunity"]> => ({
  causeArea: "hunger-food-security",
  type: "one-time",
  description: "Sort cans and pack boxes",
  skills: ["Lifting"],
  location: { address: { line1: "1 Main St", city: "Example City", state: "TX", zip: "78205" }, geo: { ...DEMO_POINT, geohash: encodeGeohash(DEMO_POINT.lat, DEMO_POINT.lng, 7) } },
  ...overrides
});

const row = (id: string, instance: Partial<ExploreRow["instance"]> = {}, opp: ExploreRow["opportunity"] = opportunity()): ExploreRow => ({
  instance: makeInstance({ id, ...instance }),
  opportunity: opp
});

const context: FilterContext = { birthDate: "2007-01-01", homeGeohash: encodeGeohash(DEMO_POINT.lat, DEMO_POINT.lng, 5) };

describe("filters in the URL", () => {
  it("round-trips every filter and drops unset ones", () => {
    const filters = { ...EMPTY_FILTERS, q: "food", cause: "seniors" as const, from: "2026-10-01", to: "2026-10-31", day: "sat" as const, block: "morning" as const, type: "virtual" as const, within: 10 as const, seats: true, eligible: true, verified: true, org: "org-1" };
    const params = filtersToParams(filters);
    expect(parseFilters(params)).toEqual(filters);
    expect(activeFilterCount(filters)).toBe(12);
    expect(filtersToParams(EMPTY_FILTERS).toString()).toBe("");
  });

  it("ignores malformed values", () => {
    const parsed = parseFilters(new URLSearchParams("cause=pizza&from=2026-02-30&within=7&day=funday&org=a/b&seats=yes"));
    expect(parsed).toEqual(EMPTY_FILTERS);
  });
});

describe("applyFilters", () => {
  const rows = [
    row("food"),
    row("seniors", { orgVerified: false, orgId: "org-2", title: "Bingo night" }, opportunity({ causeArea: "seniors", type: "virtual", location: null, skills: [] })),
    row("full", { signupCount: 3, start: { toMillis: () => SHIFT_START_MS + 2 * 86_400_000, toDate: () => new Date(SHIFT_START_MS + 2 * 86_400_000) } }),
    row("austin", { minAge: 21 }, opportunity({ location: { address: { line1: "2 Congress", city: "Austin", state: "TX", zip: "78701" }, geo: { ...AUSTIN, geohash: "9v6kp" } } })),
    row("unknown", {}, null)
  ];
  const ids = (filters: Partial<typeof EMPTY_FILTERS>, ctx = context) => applyFilters(rows, { ...EMPTY_FILTERS, ...filters }, ctx).map((entry) => entry.instance.id);

  it("passes everything with no filters", () => {
    expect(ids({})).toHaveLength(5);
  });

  it("filters by text, cause, type, organization, and verification", () => {
    expect(ids({ q: "bingo" })).toEqual(["seniors"]);
    expect(ids({ q: "lifting cans" })).toEqual(["food", "full", "austin"]);
    expect(ids({ cause: "seniors" })).toEqual(["seniors"]);
    expect(ids({ type: "virtual" })).toEqual(["seniors"]);
    expect(ids({ org: "org-2" })).toEqual(["seniors"]);
    expect(ids({ verified: true })).not.toContain("seniors");
  });

  it("filters by dates, weekday, time block, and open seats in the shift's zone", () => {
    expect(ids({ from: "2026-10-18" })).toEqual(["full"]);
    expect(ids({ to: "2026-10-17" })).not.toContain("full");
    expect(ids({ day: "sat" })).not.toContain("full");
    expect(ids({ day: "mon" })).toEqual(["full"]);
    expect(ids({ block: "afternoon" })).toEqual([]);
    expect(ids({ block: "morning" })).toHaveLength(5);
    expect(ids({ seats: true })).not.toContain("full");
  });

  it("filters by age eligibility and distance, ignoring them without the data", () => {
    expect(ids({ eligible: true })).not.toContain("austin");
    expect(ids({ eligible: true }, { ...context, birthDate: "2011-01-01" })).toEqual(["food", "full", "unknown"]);
    expect(ids({ within: 10 })).toEqual(["food", "seniors", "full"]);
    expect(ids({ within: 10 }, { ...context, homeGeohash: null })).toHaveLength(5);
    expect(ids({ eligible: true }, { ...context, birthDate: null })).toHaveLength(5);
  });
});

describe("decodeGeohash", () => {
  it("returns the center of the cell", () => {
    const point = decodeGeohash(encodeGeohash(DEMO_POINT.lat, DEMO_POINT.lng, 7));
    expect(point.lat).toBeCloseTo(DEMO_POINT.lat, 2);
    expect(point.lng).toBeCloseTo(DEMO_POINT.lng, 2);
    expect(decodeGeohash("9V1!x")).toEqual(decodeGeohash("9v1"));
  });
});

describe("recommendShifts", () => {
  const profile = { interests: ["hunger-food-security" as const], skills: [], availability: null, homeGeohash: null, birthDate: "2007-01-01" };
  const before = SHIFT_START_MS - 5 * 60 * MINUTE;

  it("offers joinable matches, best first, with a why", () => {
    const rows = [
      row("seniors", {}, opportunity({ causeArea: "seniors" })),
      row("food"),
      row("cancelled", { status: "cancelled" }),
      row("mine"),
      row("young", { minAge: 21 }),
      row("closed", { signupCount: 3, waitlist: [1, 2, 3].map((seq) => ({ uid: `u${seq}`, signupId: `s${seq}`, seq })) }),
      row("nodata", {}, null)
    ];
    const picks = recommendShifts(rows, profile, new Set(["mine"]), before);
    expect(picks.map((pick) => pick.row.instance.id)).toEqual(["food"]);
    expect(picks[0]?.why).toBe("Matches your interest in hunger and food");
  });

  it("skips minors at unverified orgs and started shifts", () => {
    const rows = [row("unverified", { orgVerified: false }), row("food")];
    expect(recommendShifts(rows, { ...profile, birthDate: "2011-01-01" }, new Set(), before).map((pick) => pick.row.instance.id)).toEqual(["food"]);
    expect(recommendShifts(rows, profile, new Set(), SHIFT_START_MS)).toEqual([]);
  });

  it("writes a why for every reason", () => {
    expect(whyText({ kind: "skills", skills: ["Spanish", "Lifting"] })).toBe("Uses your skills: Spanish, Lifting");
    expect(whyText({ kind: "availability", weekday: "sat", block: "morning" })).toBe("Fits your free time on Saturday mornings");
    expect(whyText({ kind: "nearby" })).toBe("Close to your ZIP code");
    expect(whyText({ kind: "virtual" })).toBe("Virtual, so you can help from home");
  });
});
