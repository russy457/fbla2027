/**
 * filters.ts
 * Explore smart filters (SPEC 8.5): text, cause area, date range, weekday
 * and time block, type, distance (needs the volunteer's ZIP area and the
 * shift's coordinates), seats available, eligible for my age, verified
 * organizations only, and one organization (from Saved). Filters live in
 * the URL (shareable, back button works), so this module parses and writes
 * URLSearchParams and applies the filters as a pure function.
 */
import {
  CAUSE_AREAS,
  TIME_BLOCKS,
  WEEKDAY_KEYS,
  ageOn,
  isValidYmd,
  localDateIn,
  timeBlockOf,
  weekdayKeyOf,
  type CauseArea,
  type OpportunityDoc,
  type TimeBlock,
  type WeekdayKey
} from "@fbla/shared";
import { haversineMiles } from "@/lib/search";
import type { Instance } from "@/lib/data/instances";
import { decodeGeohash } from "./geohash";

export const OPPORTUNITY_TYPES = ["one-time", "recurring", "virtual", "skilled"] as const;
export type OpportunityType = OpportunityDoc["type"];
export const DISTANCE_OPTIONS_MILES = [5, 10, 25] as const;
export type DistanceMiles = (typeof DISTANCE_OPTIONS_MILES)[number];

export interface ExploreFilters {
  readonly q: string;
  readonly cause: CauseArea | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly day: WeekdayKey | null;
  readonly block: TimeBlock | null;
  readonly type: OpportunityType | null;
  readonly within: DistanceMiles | null;
  readonly seats: boolean;
  readonly eligible: boolean;
  readonly verified: boolean;
  readonly org: string | null;
}

export const EMPTY_FILTERS: ExploreFilters = Object.freeze({
  q: "",
  cause: null,
  from: null,
  to: null,
  day: null,
  block: null,
  type: null,
  within: null,
  seats: false,
  eligible: false,
  verified: false,
  org: null
});

const oneOf = <T extends string>(allowed: readonly T[], value: string | null): T | null =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;

const ymdOrNull = (value: string | null): string | null => (value !== null && isValidYmd(value) ? value : null);

/** Reads filters from the URL, ignoring anything malformed (the URL is user-editable input). */
export const parseFilters = (params: URLSearchParams): ExploreFilters => {
  const within = Number(params.get("within"));
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    cause: oneOf(CAUSE_AREAS, params.get("cause")),
    from: ymdOrNull(params.get("from")),
    to: ymdOrNull(params.get("to")),
    day: oneOf(WEEKDAY_KEYS, params.get("day")),
    block: oneOf(TIME_BLOCKS, params.get("block")),
    type: oneOf(OPPORTUNITY_TYPES, params.get("type")),
    within: (DISTANCE_OPTIONS_MILES as readonly number[]).includes(within) ? (within as DistanceMiles) : null,
    seats: params.get("seats") === "1",
    eligible: params.get("eligible") === "1",
    verified: params.get("verified") === "1",
    org: params.get("org")?.match(/^[A-Za-z0-9_-]{1,200}$/)?.[0] ?? null
  };
};

/** Writes only the filters that are set, so a clear URL means no filters. */
export const filtersToParams = (filters: ExploreFilters): URLSearchParams => {
  const params = new URLSearchParams();
  const set = (key: string, value: string | null): void => {
    if (value !== null && value !== "") params.set(key, value);
  };
  set("q", filters.q.trim());
  set("cause", filters.cause);
  set("from", filters.from);
  set("to", filters.to);
  set("day", filters.day);
  set("block", filters.block);
  set("type", filters.type);
  set("within", filters.within === null ? null : String(filters.within));
  set("seats", filters.seats ? "1" : null);
  set("eligible", filters.eligible ? "1" : null);
  set("verified", filters.verified ? "1" : null);
  set("org", filters.org);
  return params;
};

export const activeFilterCount = (filters: ExploreFilters): number => [...filtersToParams(filters).keys()].length;

export interface FilterContext {
  /** The viewer's birth date, or null when signed out (then "eligible" is ignored). */
  readonly birthDate: string | null;
  /** The viewer's ZIP-area geohash, or null (then distance is ignored). */
  readonly homeGeohash: string | null;
}

export interface ExploreRow {
  readonly instance: Instance;
  readonly opportunity: Pick<OpportunityDoc, "causeArea" | "type" | "description" | "location" | "skills"> | null;
}

const ADULT_AGE = 18;

const matchesText = (row: ExploreRow, q: string): boolean => {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [row.instance.title, row.instance.orgName, row.opportunity?.description ?? "", ...(row.opportunity?.skills ?? [])].join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
};

const withinDistance = (row: ExploreRow, homeGeohash: string, miles: number): boolean => {
  if (row.opportunity?.type === "virtual") return true;
  const geo = row.opportunity?.location?.geo;
  if (!geo) return false;
  return haversineMiles(decodeGeohash(homeGeohash), { lat: geo.lat, lng: geo.lng }) <= miles;
};

const isEligible = (instance: Instance, birthDate: string): boolean => {
  const age = ageOn(birthDate, instance.start.toDate(), instance.timeZone);
  return age >= instance.minAge && (age >= ADULT_AGE || instance.orgVerified);
};

/** Keeps the rows that pass every set filter. Order is preserved. */
export const applyFilters = (rows: readonly ExploreRow[], filters: ExploreFilters, context: FilterContext): ExploreRow[] =>
  rows.filter((row) => {
    const { instance, opportunity } = row;
    const startMs = instance.start.toMillis();
    const localDay = localDateIn(instance.start.toDate(), instance.timeZone);
    if (!matchesText(row, filters.q)) return false;
    if (filters.cause !== null && opportunity?.causeArea !== filters.cause) return false;
    if (filters.type !== null && opportunity?.type !== filters.type) return false;
    if (filters.from !== null && localDay < filters.from) return false;
    if (filters.to !== null && localDay > filters.to) return false;
    if (filters.day !== null && weekdayKeyOf(startMs, instance.timeZone) !== filters.day) return false;
    if (filters.block !== null && timeBlockOf(startMs, instance.timeZone) !== filters.block) return false;
    if (filters.seats && instance.signupCount >= instance.capacity) return false;
    if (filters.verified && !instance.orgVerified) return false;
    if (filters.org !== null && instance.orgId !== filters.org) return false;
    if (filters.eligible && context.birthDate !== null && !isEligible(instance, context.birthDate)) return false;
    if (filters.within !== null && context.homeGeohash !== null && !withinDistance(row, context.homeGeohash, filters.within)) return false;
    return true;
  });
