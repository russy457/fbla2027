import { describe, it, expect } from "vitest";
import { encodeGeohash, haversineMiles, sharedPrefixLength } from "./geo";

describe("encodeGeohash", () => {
  it("matches the canonical Wikipedia geohash example", () => {
    // Wikipedia's reference example: (57.64911, 10.40744) -> "u4pruydqqvj".
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe("u4pruydqqvj");
    expect(encodeGeohash(57.64911, 10.40744, 7)).toBe("u4pruyd");
  });

  it("produces the requested precision length", () => {
    expect(encodeGeohash(30.2672, -97.7431, 5)).toHaveLength(5);
    expect(encodeGeohash(30.2672, -97.7431, 9)).toHaveLength(9);
  });

  it("gives nearby points a shared prefix and distant points none", () => {
    const austinA = encodeGeohash(30.2672, -97.7431);
    const austinB = encodeGeohash(30.2700, -97.7400);
    const dallas = encodeGeohash(32.7767, -96.797);
    expect(sharedPrefixLength(austinA, austinB)).toBeGreaterThanOrEqual(4);
    expect(sharedPrefixLength(austinA, dallas)).toBeLessThanOrEqual(2);
  });

  it("returns an empty string for non-finite coordinates", () => {
    expect(encodeGeohash(NaN, 0)).toBe("");
  });
});

describe("haversineMiles", () => {
  it("is zero between identical points", () => {
    expect(haversineMiles({ lat: 30, lng: -97 }, { lat: 30, lng: -97 })).toBe(0);
  });

  it("approximates one degree of latitude as ~69 miles", () => {
    const d = haversineMiles({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(68);
    expect(d).toBeLessThan(70);
  });

  it("computes a realistic Austin -> Dallas distance (~180 miles)", () => {
    const d = haversineMiles({ lat: 30.2672, lng: -97.7431 }, { lat: 32.7767, lng: -96.797 });
    expect(d).toBeGreaterThan(170);
    expect(d).toBeLessThan(200);
  });

  it("is symmetric", () => {
    const a = { lat: 30.2672, lng: -97.7431 };
    const b = { lat: 32.7767, lng: -96.797 };
    expect(haversineMiles(a, b)).toBeCloseTo(haversineMiles(b, a), 6);
  });
});

describe("sharedPrefixLength", () => {
  it("counts the leading shared characters", () => {
    expect(sharedPrefixLength("dqcjq", "dqcjz")).toBe(4);
    expect(sharedPrefixLength("abc", "xyz")).toBe(0);
    expect(sharedPrefixLength("", "abc")).toBe(0);
  });
});
