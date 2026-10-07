/**
 * zipAreas.ts
 * The bundled demo ZIP lookup (SPEC 5.9 step 3, SPEC 4.2 "volunteer
 * location is coarse"). A volunteer's 5-digit ZIP becomes the precision-5
 * geohash of an approximate ZIP centroid (a cell about 5 km across), which is
 * all the app ever stores about where someone lives. ZIPs outside the table
 * map to null: the profile keeps the ZIP, and distance filters stay off.
 *
 * Centroids are approximate (two to three decimals), good enough for "within
 * 5 / 10 / 25 miles"; they are not addresses. The seed also uses them to
 * place the fictional demo organizations near their ZIP. Replace this data
 * source to support additional ZIP codes without changing callers.
 */

/** [latitude, longitude, geohash-5 of that point]. */
type ZipArea = readonly [number, number, string];

const DEMO_ZIP_AREAS: Readonly<Record<string, ZipArea>> = {
  "78201": [29.468, -98.526, "9v1zt"],
  "78202": [29.428, -98.461, "9v1zr"],
  "78203": [29.415, -98.460, "9v1zr"],
  "78204": [29.405, -98.507, "9v1zq"],
  "78205": [29.424, -98.487, "9v1zq"],
  "78207": [29.422, -98.524, "9v1zq"],
  "78208": [29.440, -98.459, "9v1zr"],
  "78209": [29.489, -98.456, "9v1zz"],
  "78210": [29.396, -98.466, "9v1zp"],
  "78211": [29.350, -98.565, "9v1yv"],
  "78212": [29.462, -98.495, "9v1zw"],
  "78213": [29.516, -98.522, "9v1zy"],
  "78214": [29.364, -98.492, "9v1zn"],
  "78215": [29.441, -98.480, "9v1zr"],
  "78216": [29.534, -98.489, "9v3bn"],
  "78217": [29.540, -98.419, "9v600"],
  "78218": [29.495, -98.401, "9v4pb"],
  "78219": [29.447, -98.383, "9v4p9"],
  "78220": [29.412, -98.404, "9v4p2"],
  "78221": [29.310, -98.493, "9v1yw"],
  "78222": [29.383, -98.389, "9v4p1"],
  "78223": [29.355, -98.437, "9v4nb"],
  "78224": [29.336, -98.540, "9v1yv"],
  "78225": [29.388, -98.527, "9v1zj"],
  "78226": [29.385, -98.567, "9v1zj"],
  "78227": [29.403, -98.635, "9v1z7"],
  "78228": [29.459, -98.570, "9v1zs"],
  "78229": [29.506, -98.570, "9v1zu"],
  "78230": [29.541, -98.551, "9v3bj"],
  "78231": [29.571, -98.538, "9v3bj"],
  "78232": [29.585, -98.474, "9v3br"],
  "78233": [29.555, -98.365, "9v601"],
  "78234": [29.459, -98.437, "9v4p8"],
  "78235": [29.343, -98.444, "9v1yz"],
  "78236": [29.389, -98.617, "9v1z5"],
  "78237": [29.420, -98.565, "9v1zm"],
  "78238": [29.474, -98.618, "9v1ze"],
  "78239": [29.517, -98.361, "9v4pc"],
  "78240": [29.524, -98.610, "9v1zu"],
  "78242": [29.351, -98.610, "9v1yu"],
  "78244": [29.476, -98.349, "9v4pd"],
  "78245": [29.410, -98.700, "9v1z6"],
  "78247": [29.583, -98.407, "9v602"],
  "78248": [29.590, -98.522, "9v3bq"],
  "78249": [29.567, -98.613, "9v3bh"],
  "78250": [29.506, -98.668, "9v1zf"],
  "78251": [29.460, -98.676, "9v1zd"],
  "78252": [29.335, -98.700, "9v1yf"],
  "78253": [29.470, -98.780, "9v1z8"],
  "78254": [29.540, -98.730, "9v3b1"],
  "78255": [29.650, -98.660, "9v3bd"],
  "78256": [29.620, -98.630, "9v3be"],
  "78257": [29.650, -98.580, "9v3bs"],
  "78258": [29.630, -98.495, "9v3bw"],
  "78259": [29.627, -98.428, "9v608"],
  "78260": [29.700, -98.480, "9v3bz"],
  "78261": [29.700, -98.400, "9v60b"],
  "78263": [29.350, -98.310, "9v4nf"],
  "78264": [29.200, -98.500, "9v1yn"],
  "78266": [29.650, -98.330, "9v60d"]
};

export interface ZipCentroid {
  readonly lat: number;
  readonly lng: number;
  /** Precision 5 (about 5 km). */
  readonly geohash: string;
}

/** The approximate centroid of a bundled ZIP, or null when the ZIP is not in the table. */
export const zipCentroid = (zip: string | null | undefined): ZipCentroid | null => {
  const area = zip && Object.hasOwn(DEMO_ZIP_AREAS, zip) ? DEMO_ZIP_AREAS[zip] : undefined;
  return area === undefined ? null : { lat: area[0], lng: area[1], geohash: area[2] };
};

/** users/{uid}/private/profile.homeGeohash for a ZIP (null when unknown or cleared). */
export const homeGeohashForZip = (zip: string | null | undefined): string | null => zipCentroid(zip)?.geohash ?? null;
