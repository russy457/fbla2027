/**
 * signup.ts
 * volunteer.signup (SPEC#fn-signup, SPEC 5.3). The transaction itself lives
 * in shifts/signupCore.ts, which the Tier 2 whole-series signup reuses per
 * date: one transaction over the instance, the signup, and the org, so N
 * people racing for the last seat end with exactly `capacity` confirmed, and
 * the doc id `{instanceId}_{uid}` makes a retry return the existing signup.
 */
import { AppError } from "@fbla/shared";
import { profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { signupForInstance } from "../shifts/signupCore";

export const signup = defineCallable({
  endpoint: "volunteer",
  op: "signup",
  auth: profileComplete(),
  handler: async ({ input, caller, clock, deps, profile }) => {
    if (profile === null) throw new AppError("PROFILE_INCOMPLETE");
    return signupForInstance(deps.db, { instanceId: input.instanceId, uid: caller.uid, profile, nowMs: clock.nowMs() });
  }
});
