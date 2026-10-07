/**
 * mapPoints.ts
 * Data for the optional Explore map (SPEC 9.1 "Explore map toggle", SPEC
 * 1.2 Tier 2 "optional Mapbox map"). Pure functions, unit tested:
 *
 *   mapboxTokenFrom   the VITE_MAPBOX_TOKEN value only when it is a PUBLIC
 *                     token (pk.*); a secret sk.* token is never used, so a
 *                     mistake in .env cannot ship a secret to the map
 *   orgMapPoints      one marker per organization that has a shift in the
 *                     current (filtered) list, placed at the CENTER of its
 *                     precision-5 geohash cell (about 5 km), so the map shows
 *                     an area, not a street address. Volunteer locations are
 *                     never plotted.
 */
import type { GeoPoint } from "@/lib/search";
import { decodeGeohash } from "./geohash";

/** About 4.9 km x 4.9 km: the same coarse precision volunteers' ZIP areas use (SPEC 4.2). */
export const COARSE_GEOHASH_PRECISION = 5;

export const mapboxTokenFrom = (token: string | undefined): string | null => {
  const trimmed = token?.trim() ?? "";
  return trimmed.startsWith("pk.") ? trimmed : null;
};

/** Coarse point for a stored geohash; null for an empty hash. */
export const coarsePoint = (geohash: string): GeoPoint | null => {
  const cell = geohash.trim().slice(0, COARSE_GEOHASH_PRECISION);
  return cell === "" ? null : decodeGeohash(cell);
};

export interface MapOrg {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
  readonly geo: { readonly geohash: string } | null;
}

export interface MapPoint extends GeoPoint {
  readonly orgId: string;
  readonly name: string;
  /** Shifts from this organization in the current Explore list. */
  readonly shiftCount: number;
}

/** Markers for organizations with listed shifts, most shifts first, then by name. */
export const orgMapPoints = (orgs: readonly MapOrg[], listedOrgIds: readonly string[]): MapPoint[] => {
  const counts = listedOrgIds.reduce((tally, orgId) => tally.set(orgId, (tally.get(orgId) ?? 0) + 1), new Map<string, number>());
  return orgs
    .flatMap((org): MapPoint[] => {
      const shiftCount = counts.get(org.id) ?? 0;
      const point = org.geo && !org.archived && shiftCount > 0 ? coarsePoint(org.geo.geohash) : null;
      return point ? [{ ...point, orgId: org.id, name: org.name, shiftCount }] : [];
    })
    .sort((a, b) => b.shiftCount - a.shiftCount || a.name.localeCompare(b.name));
};

/** "3 shifts" / "1 shift". */
export const shiftCountText = (count: number): string => (count === 1 ? "1 shift" : `${count} shifts`);
