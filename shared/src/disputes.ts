/**
 * disputes.ts
 * The attendance review window (SPEC 7.3 DISPUTE_WINDOW_DAYS, T3, Appendix B
 * item 30). A volunteer marked no-show may ask for a review until 30 days
 * after the shift ended. The server op refuses later requests with
 * DISPUTE_WINDOW_CLOSED; My Shifts uses the same check to hide the button.
 */
import { DAY_MS } from "./time";

export const DISPUTE_WINDOW_DAYS = 30;

/** True while a review can still be requested for a shift that ended at `instanceEndMs`. */
export const isDisputeWindowOpen = (instanceEndMs: number, nowMs: number): boolean => nowMs <= instanceEndMs + DISPUTE_WINDOW_DAYS * DAY_MS;
