/**
 * @file geo.ts
 * @description Geospatial primitives for "near me" search: geohash encoding
 * (the classic spatial structure: buckets nearby points under a shared string
 * prefix) and the haversine great-circle distance (precise mile distance for
 * ranking/filtering). Geohash gives coarse bucketing; haversine gives the exact
 * number we sort by.
 */

import type { GeoPoint } from "./types";

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"; // geohash alphabet (no a,i,l,o)
const EARTH_RADIUS_MILES = 3958.7613;

/**
 * Encode a lat/lng to a geohash of the given precision (default 7 ≈ 76m cell).
 * Points in the same cell share a prefix, so prefix length ↔ proximity radius.
 */
export const encodeGeohash = (lat: number, lng: number, precision = 7): string => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let hash = "";
  let bits = 0;
  let bit = 0;
  let even = true;

  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        bit = (bit << 1) + 1;
        lngMin = mid;
      } else {
        bit = bit << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        bit = (bit << 1) + 1;
        latMin = mid;
      } else {
        bit = bit << 1;
        latMax = mid;
      }
    }
    even = !even;
    if (++bits === 5) {
      hash += BASE32[bit];
      bits = 0;
      bit = 0;
    }
  }
  return hash;
};

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two points, in miles (haversine formula).
 *
 *   a = sin²(Δφ/2) + cos φ₁ · cos φ₂ · sin²(Δλ/2)
 *   d = 2R · atan2(√a, √(1−a))
 */
export const haversineMiles = (from: GeoPoint, to: GeoPoint): number => {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Length of the shared geohash prefix: a cheap coarse proximity proxy. */
export const sharedPrefixLength = (a: string, b: string): number => {
  const len = Math.min(a.length, b.length);
  let i = 0;
  while (i < len && a[i] === b[i]) i++;
  return i;
};
