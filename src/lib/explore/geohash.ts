/**
 * geohash.ts
 * Decodes a geohash to the center of its cell, the inverse of encodeGeohash
 * in src/lib/search/geo.ts. Volunteers store only a precision-5 geohash of
 * their ZIP (about 5 km, SPEC 4.2 coarse location), so distances from it are
 * approximate by design.
 */
import type { GeoPoint } from "@/lib/search";

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export const decodeGeohash = (hash: string): GeoPoint => {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let even = true;
  for (const char of hash.toLowerCase()) {
    const value = BASE32.indexOf(char);
    // An invalid character stops decoding; the cell so far is still a valid, larger area.
    if (value < 0) break;
    for (let bit = 4; bit >= 0; bit -= 1) {
      const isSet = ((value >> bit) & 1) === 1;
      if (even) {
        const mid = (lngMin + lngMax) / 2;
        if (isSet) lngMin = mid;
        else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (isSet) latMin = mid;
        else latMax = mid;
      }
      even = !even;
    }
  }
  return { lat: (latMin + latMax) / 2, lng: (lngMin + lngMax) / 2 };
};
