/**
 * formatHours.ts
 * Plain-English hour amounts for volunteers: "1 hour", "2.5 hours",
 * "0 hours". Minutes come from hours logs (multiples of 15), so at most two
 * decimals are needed (SPEC#hours round2).
 */
import { minutesToHours, round2 } from "@fbla/shared";

export const formatHoursValue = (hours: number): string => {
  const rounded = round2(hours);
  return `${rounded} ${rounded === 1 ? "hour" : "hours"}`;
};

export const formatMinutesAsHours = (minutes: number): string => formatHoursValue(minutesToHours(minutes));
