/**
 * disputes.test.ts
 * The 30-day attendance review window (SPEC 7.3, T3).
 */
import { describe, expect, it } from "vitest";
import { DISPUTE_WINDOW_DAYS, isDisputeWindowOpen } from "./disputes";
import { DAY_MS } from "./time";

describe("isDisputeWindowOpen", () => {
  it("is open through the 30th day after the shift ends, then closed", () => {
    const end = 1_000_000;
    expect(isDisputeWindowOpen(end, end)).toBe(true);
    expect(isDisputeWindowOpen(end, end + DISPUTE_WINDOW_DAYS * DAY_MS)).toBe(true);
    expect(isDisputeWindowOpen(end, end + DISPUTE_WINDOW_DAYS * DAY_MS + 1)).toBe(false);
  });
});
