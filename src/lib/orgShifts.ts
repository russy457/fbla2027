/**
 * orgShifts.ts
 * Picks the dashboard's "Today / next shift" (SPEC#screen-inventory
 * "Coordinator Dashboard"): the earliest shift that is not cancelled and not
 * yet past its finalize time, so a shift stays featured through check-out
 * and finalization. The rest of the not-yet-ended shifts are "upcoming".
 */
import { DEFAULT_CONFIG, MINUTE_MS } from "@fbla/shared";

export interface OrgShiftLike {
  readonly status: "scheduled" | "cancelled" | "finalized";
  readonly start: { toMillis(): number };
  readonly end: { toMillis(): number };
}

export const pickFeaturedShift = <T extends OrgShiftLike>(shifts: readonly T[], nowMs: number): { featured: T | null; upcoming: T[] } => {
  const graceMs = DEFAULT_CONFIG.checkoutGraceMin * MINUTE_MS;
  const live = [...shifts]
    .filter((shift) => shift.status !== "cancelled" && shift.end.toMillis() + graceMs >= nowMs)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());
  const [featured, ...upcoming] = live;
  return { featured: featured ?? null, upcoming };
};
