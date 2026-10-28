import { describe, expect, it } from "vitest";
import type { SignupStatus } from "./schemas/common";
import { findScheduleConflict } from "./scheduleConflict";

const at = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const booked = (start: number, end: number, status: SignupStatus = "confirmed", instanceId = "other") => ({
  instanceId,
  instanceStart: at(start),
  instanceEnd: at(end),
  status
});
const target = { instanceId: "target", startMs: 100, endMs: 200 };

describe("schedule conflicts", () => {
  it("finds a confirmed or waitlisted shift that overlaps", () => {
    expect(findScheduleConflict(target, [booked(50, 150)])?.instanceId).toBe("other");
    expect(findScheduleConflict(target, [booked(150, 250, "waitlisted")])?.instanceId).toBe("other");
  });

  it("allows touching edges, cancelled bookings, and retries for the same shift", () => {
    expect(findScheduleConflict(target, [booked(0, 100), booked(200, 300)])).toBeNull();
    expect(findScheduleConflict(target, [booked(100, 200, "cancelled")])).toBeNull();
    expect(findScheduleConflict(target, [booked(100, 200, "confirmed", "target")])).toBeNull();
  });
});
