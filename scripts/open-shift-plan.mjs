/** Repeatable, fictional presentation dates for the existing demo listings. */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const ZONE = "America/Chicago";
const DAY_MS = 86_400_000;
const MIN_LEAD_MS = 36 * 60 * 60 * 1000;

/** Weekday uses JavaScript's Sunday = 0 convention. */
const slots = [
  { opportunityId: "pantry-sort-and-pack", weekday: 1, hour: 9, minute: 0, lengthMin: 180, capacity: 8, weeks: [0, 1, 3, 5] },
  { opportunityId: "pantry-family-market", weekday: 6, hour: 9, minute: 0, lengthMin: 240, capacity: 10, weeks: [0, 1, 3] },
  { opportunityId: "westside-reading-buddies", weekday: 2, hour: 15, minute: 30, lengthMin: 90, capacity: 6, weeks: [0, 2] },
  { opportunityId: "trails-dog-walk", weekday: 6, hour: 10, minute: 0, lengthMin: 120, capacity: 8, weeks: [0, 2] },
  { opportunityId: "pantry-senior-delivery", weekday: 4, hour: 10, minute: 0, lengthMin: 180, capacity: 6, weeks: [0, 2] },
  { opportunityId: "pantry-weekend-snack-bags", weekday: 5, hour: 16, minute: 0, lengthMin: 120, capacity: 8, weeks: [0, 2] },
  { opportunityId: "westside-homework-help", weekday: 3, hour: 17, minute: 0, lengthMin: 90, capacity: 6, weeks: [1, 4] },
  { opportunityId: "trails-river-cleanup", weekday: 6, hour: 8, minute: 0, lengthMin: 180, capacity: 12, weeks: [1, 5] }
];

/** Dates and IDs stay stable during repeat runs in the same week. */
export const planOpenShifts = (nowMs) => {
  const localToday = formatInTimeZone(new Date(nowMs), ZONE, "yyyy-MM-dd");
  const todayUtc = Date.parse(`${localToday}T12:00:00Z`);
  const todayWeekday = new Date(todayUtc).getUTCDay();
  const shifts = slots.flatMap((slot) => {
    let daysUntil = (slot.weekday - todayWeekday + 7) % 7;
    const at = (days) => {
      const date = new Date(todayUtc + days * DAY_MS).toISOString().slice(0, 10);
      return { date, startMs: fromZonedTime(`${date}T${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}:00`, ZONE).getTime() };
    };
    if (at(daysUntil).startMs < nowMs + MIN_LEAD_MS) daysUntil += 7;
    return slot.weeks.map((week) => {
      const { date, startMs } = at(daysUntil + week * 7);
      return {
        id: `showcase-${slot.opportunityId}-${date}`,
        opportunityId: slot.opportunityId,
        startMs,
        endMs: startMs + slot.lengthMin * 60_000,
        capacity: slot.capacity
      };
    });
  });
  return shifts.sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
};
