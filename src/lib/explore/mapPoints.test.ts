/**
 * mapPoints.test.ts
 * The optional Explore map's data rules: only public pk. tokens are used,
 * markers sit at the center of a coarse (precision-5) geohash cell, only
 * organizations with listed shifts appear, archived or location-less
 * organizations never do, and shift counts read naturally.
 */
import { describe, expect, it } from "vitest";
import { decodeGeohash } from "./geohash";
import { COARSE_GEOHASH_PRECISION, coarsePoint, mapboxTokenFrom, orgMapPoints, shiftCountText } from "./mapPoints";

const EXACT_HASH = "9v1zsqyk2m"; // a precise point in San Antonio

describe("mapboxTokenFrom", () => {
  it("accepts only public pk. tokens", () => {
    expect(mapboxTokenFrom(" pk.public-token ")).toBe("pk.public-token");
    expect(mapboxTokenFrom("sk.secret-token")).toBeNull();
    expect(mapboxTokenFrom("")).toBeNull();
    expect(mapboxTokenFrom(undefined)).toBeNull();
  });
});

describe("coarsePoint", () => {
  it("uses the center of the precision-5 cell, not the exact point", () => {
    const coarse = coarsePoint(EXACT_HASH);
    expect(coarse).toEqual(decodeGeohash(EXACT_HASH.slice(0, COARSE_GEOHASH_PRECISION)));
    expect(coarse).not.toEqual(decodeGeohash(EXACT_HASH));
    expect(coarsePoint("  ")).toBeNull();
  });
});

describe("orgMapPoints", () => {
  const orgs = [
    { id: "alamo", name: "Alamo Pantry", archived: false, geo: { geohash: EXACT_HASH } },
    { id: "river", name: "River Cleanup", archived: false, geo: { geohash: "9v1zt" } },
    { id: "nogeo", name: "No Location", archived: false, geo: null },
    { id: "closed", name: "Closed Org", archived: true, geo: { geohash: "9v1zt" } },
    { id: "quiet", name: "Quiet Org", archived: false, geo: { geohash: "9v1zu" } }
  ];

  it("plots organizations with listed shifts, most shifts first", () => {
    const points = orgMapPoints(orgs, ["river", "alamo", "alamo", "nogeo", "closed"]);
    expect(points.map((point) => [point.orgId, point.shiftCount])).toEqual([
      ["alamo", 2],
      ["river", 1]
    ]);
    expect(points[0]).toMatchObject(decodeGeohash(EXACT_HASH.slice(0, COARSE_GEOHASH_PRECISION)));
  });

  it("breaks ties by name and returns nothing for an empty list", () => {
    expect(orgMapPoints(orgs, ["river", "alamo"]).map((point) => point.name)).toEqual(["Alamo Pantry", "River Cleanup"]);
    expect(orgMapPoints(orgs, [])).toEqual([]);
  });
});

describe("shiftCountText", () => {
  it("uses singular and plural", () => {
    expect(shiftCountText(1)).toBe("1 shift");
    expect(shiftCountText(3)).toBe("3 shifts");
  });
});
