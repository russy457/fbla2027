/**
 * signupSeries.ts
 * volunteer.signupSeries (Tier 2, SPEC 5.2, 9.4): sign up for every upcoming
 * date of a series in one go (extendSeriesSignup.ts later adds only the dates
 * created after this signup's coversThrough).
 * Each date is its own signup transaction with every single-signup rule; the
 * per-date outcomes come back as a list (series/seriesSignup.ts).
 */
import { AppError } from "@fbla/shared";
import { profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { signupWholeSeries } from "../series/seriesSignup";

export const signupSeries = defineCallable({
  endpoint: "volunteer",
  op: "signupSeries",
  auth: profileComplete(),
  handler: async ({ input, caller, clock, deps, profile }) => {
    if (profile === null) throw new AppError("PROFILE_INCOMPLETE");
    return signupWholeSeries(deps.db, { seriesId: input.seriesId, uid: caller.uid, profile, nowMs: clock.nowMs(), onlyAfterCoverage: false });
  }
});
