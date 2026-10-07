/**
 * finalizeShift.ts
 * coordinator.finalizeShift (SPEC#fn-finalizeshift). A coordinator may close
 * a shift any time after it ends (SHIFT_NOT_ENDED before); runDueJobs does
 * the same automatically at end + 30 min. Both call finalizeInstance, which
 * is idempotent through the finalizedAt marker.
 */
import { coordinatorOf, instanceResource } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { finalizeInstance } from "../shifts/finalize";

export const finalizeShift = defineCallable({
  endpoint: "coordinator",
  op: "finalizeShift",
  auth: coordinatorOf(instanceResource((input: { instanceId: string }) => input.instanceId)),
  handler: async ({ input, caller, clock, deps }) => {
    const result = await finalizeInstance(deps.db, clock, deps.env.config, input.instanceId, { actor: caller.uid });
    return {
      noShows: result.noShows,
      excused: result.excused,
      autoCompleted: result.autoCompleted,
      alreadyFinalized: result.alreadyFinalized
    };
  }
});
