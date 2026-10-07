/**
 * extendSeriesSignup.ts
 * volunteer.extendSeriesSignup (Tier 2, SPEC 5.2, 9.4 "one-click Extend"):
 * after the series has grown past the volunteer's coversThrough, sign up for
 * only the new dates, with the same per-date rules and result list as
 * signupSeries (series/seriesSignup.ts). The series never extends a
 * volunteer's signup on its own.
 */
import { AppError } from "@fbla/shared";
import { profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { signupWholeSeries } from "../series/seriesSignup";

export const extendSeriesSignup = defineCallable({
  endpoint: "volunteer",
  op: "extendSeriesSignup",
  auth: profileComplete(),
  handler: async ({ input, caller, clock, deps, profile }) => {
    if (profile === null) throw new AppError("PROFILE_INCOMPLETE");
    return signupWholeSeries(deps.db, { seriesId: input.seriesId, uid: caller.uid, profile, nowMs: clock.nowMs(), onlyAfterCoverage: true });
  }
});
