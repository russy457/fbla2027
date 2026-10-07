/**
 * updateInstance.ts
 * coordinator.updateInstance (SPEC 5.2, Appendix B item 28). Changes start,
 * end, and/or capacity of a shift that has not started:
 *   - unchanged input is a no-op (changed: false),
 *   - capacity below the seats already taken is CAPACITY_BELOW_SIGNUPS
 *     (params.excess = how many over),
 *   - a time change re-checks the shift rules, bumps `sequence` (.ics),
 *     recomputes cutoffAt / finalizeAt / nextActionAt, and refreshes the
 *     denormalized times on every signup of the shift,
 *   - a capacity increase before the cutoff calls the waitlist promotion
 *     hook (shifts/promoteFromWaitlist.ts, owned by Lane A).
 */
import { AppError, COLLECTIONS, type InstanceDoc } from "@fbla/shared";
import { coordinatorOf, instanceResource } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";
import { assertShiftTimes, jobTimesFor } from "../shifts/instanceTimes";
import { refreshNextInstanceStart } from "../shifts/opportunitySchedule";
import { promoteFromWaitlist } from "../shifts/promoteFromWaitlist";

interface Change {
  readonly instance: InstanceDoc;
  readonly timesChanged: boolean;
  readonly capacityRaised: boolean;
  readonly sequence: number;
  readonly changed: boolean;
}

export const updateInstance = defineCallable({
  endpoint: "coordinator",
  op: "updateInstance",
  auth: coordinatorOf(instanceResource((input: { instanceId: string }) => input.instanceId)),
  handler: async ({ input, clock, deps }) => {
    const { db, env } = deps;
    const nowMs = clock.nowMs();
    const ref = db.collection(COLLECTIONS.instances).doc(input.instanceId);

    const change = await runTx(db, async (tx): Promise<Change> => {
      const instance = readDoc<InstanceDoc>(await tx.get(ref));
      if (instance === null) throw new AppError("NOT_FOUND");
      if (instance.status === "cancelled") throw new AppError("SHIFT_CANCELLED");
      if (instance.status === "finalized" || nowMs >= msOf(instance.start)) throw new AppError("SHIFT_STARTED");

      const times = { startMs: input.start ? Date.parse(input.start) : msOf(instance.start), endMs: input.end ? Date.parse(input.end) : msOf(instance.end) };
      const capacity = input.capacity ?? instance.capacity;
      const timesChanged = times.startMs !== msOf(instance.start) || times.endMs !== msOf(instance.end);
      const capacityChanged = capacity !== instance.capacity;
      if (!timesChanged && !capacityChanged) return { instance, timesChanged, capacityRaised: false, sequence: instance.sequence, changed: false };

      if (capacity < instance.signupCount) throw new AppError("CAPACITY_BELOW_SIGNUPS", { excess: instance.signupCount - capacity });
      const update: Record<string, unknown> = { capacity, updatedAt: ts(nowMs) };
      const sequence = timesChanged ? instance.sequence + 1 : instance.sequence;
      if (timesChanged) {
        assertShiftTimes(times, nowMs);
        const jobTimes = jobTimesFor(times, env.config);
        Object.assign(update, jobTimes, { sequence, nextActionAt: instance.cutoffDoneAt === null ? jobTimes.cutoffAt : jobTimes.finalizeAt });
      }
      tx.update(ref, update);
      return { instance: { ...instance, ...update } as InstanceDoc, timesChanged, capacityRaised: capacity > instance.capacity, sequence, changed: true };
    });

    if (change.timesChanged) {
      const signups = await db.collection(COLLECTIONS.signups).where("instanceId", "==", input.instanceId).get();
      const batch = db.batch();
      signups.docs.forEach((doc) => batch.update(doc.ref, { instanceStart: change.instance.start, instanceEnd: change.instance.end, updatedAt: ts(nowMs) }));
      await batch.commit();
      await refreshNextInstanceStart(db, change.instance.opportunityId, nowMs);
      // TODO(lane A notify): "shift-changed" notification to every active signup.
    }
    const beforeCutoff = nowMs < msOf(change.instance.cutoffAt);
    const promoted = change.capacityRaised && beforeCutoff ? await promoteFromWaitlist({ db, instanceId: input.instanceId, nowMs, config: env.config }) : [];
    return { instanceId: input.instanceId, sequence: change.sequence, promoted, changed: change.changed };
  }
});
