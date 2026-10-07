/**
 * zipAreas.test.ts
 * ZIP to coarse area (SPEC 5.9 step 3, SPEC 4.2): bundled San Antonio ZIPs
 * map to a precision-5 geohash of their centroid; anything else is null.
 */
import { describe, expect, it } from "vitest";
import { homeGeohashForZip, zipCentroid } from "./zipAreas";

describe("zip areas", () => {
  it("maps a bundled ZIP to its approximate centroid and geohash-5", () => {
    expect(zipCentroid("78204")).toEqual({ lat: 29.405, lng: -98.507, geohash: "9v1zq" });
    expect(homeGeohashForZip("78204")).toBe("9v1zq");
    expect(homeGeohashForZip("78204")).toHaveLength(5);
  });

  it("is null for unknown, empty, or cleared ZIPs", () => {
    expect(homeGeohashForZip("10001")).toBeNull();
    expect(homeGeohashForZip("")).toBeNull();
    expect(homeGeohashForZip(null)).toBeNull();
    expect(zipCentroid(undefined)).toBeNull();
    // Own keys only: an inherited property name is not a ZIP.
    expect(zipCentroid("toString")).toBeNull();
  });
});
