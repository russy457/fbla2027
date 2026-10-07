/**
 * updateInstance.ts
 * coordinator.updateInstance (SPEC 5.2, Appendix B item 28). Changes start,
 * end, and/or capacity of a shift that has not started:
 *   - unchanged input is a no-op (changed: false),
 *   - capacity below the seats already taken is CAPACITY_BELOW_SIGNUPS
 *     (params.excess = how many over),
 *   - a time change re-checks the shift rules, bumps `sequence` (.ics),
 *     recomputes cutoffAt / finalizeAt / nextActionAt, refreshes the
 *     denormalized times on every signup of the shift, and sends each active
 *     signup a "shift-changed" notification (SPEC 8.3),
 *   - a capacity increase before the cutoff promotes as many waitlisted
 *     people as the new seats allow, lowest seq first, in the same
 *     transaction (shifts/promotion.ts, the helper cancelSignup uses).
 */
import { AppError, COLLECTIONS, shiftChangedNotification, type InstanceDoc, type SignupDoc, type SignupStatus } from "@fbla/shared";
import { coordinatorOf, instanceResource } from "../lib/auth";
import { commitInChunks, type BatchWrite } from "../lib/batchWrites";
import { defineCallable } from "../lib/defineCallable";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";
import { queueNotification } from "../notifications/notify";
import { assertShiftTimes, jobTimesFor } from "../shifts/instanceTimes";
import { refreshNextInstanceStart } from "../shifts/opportunitySchedule";
import { applyPromotion, readPromotion } from "../shifts/promotion";

interface Change {
  readonly instance: InstanceDoc;
  readonly timesChanged: boolean;
  readonly sequence: number;
  readonly changed: boolean;
  readonly promoted: readonly string[];
}

/** Signups that still expect to attend, so a time change is news to them. */
const NOTIFY_ON_TIME_CHANGE: ReadonlySet<SignupStatus> = new Set(["confirmed", "waitlisted", "checked-in"]);

export const updateInstance = defineCallable({
  endpoint: "coordinator",
  op: "updateInstance",
  auth: coordinatorOf(instanceResource((input: { instanceId: string }) => input.instanceId)),
  handler: async ({ input, caller, clock, deps }) => {
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
      if (!timesChanged && !capacityChanged) return { instance, timesChanged, sequence: instance.sequence, changed: false, promoted: [] };

      if (capacity < instance.signupCount) throw new AppError("CAPACITY_BELOW_SIGNUPS", { excess: instance.signupCount - capacity });
      const update: Record<string, unknown> = { capacity, updatedAt: ts(nowMs) };
      const sequence = timesChanged ? instance.sequence + 1 : instance.sequence;
      if (timesChanged) {
        assertShiftTimes(times, nowMs);
        const jobTimes = jobTimesFor(times, env.config);
        Object.assign(update, jobTimes, { sequence, nextActionAt: instance.cutoffDoneAt === null ? jobTimes.cutoffAt : jobTimes.finalizeAt });
      }
      const updated = { ...instance, ...update } as InstanceDoc;

      // New seats go to the waitlist before anyone else (reads first, then writes).
      // readPromotion returns nothing at or after the (possibly moved) cutoff.
      if (capacity > instance.capacity && updated.waitlist.length > 0) {
        const plan = await readPromotion(tx, db, updated, updated.signupCount, nowMs);
        const promotion = applyPromotion(tx, db, input.instanceId, updated, plan, caller.uid, "updateInstance", nowMs);
        Object.assign(update, { signupCount: updated.signupCount + promotion.seatsTaken, waitlist: promotion.waitlist });
        tx.update(ref, update);
        return { instance: { ...updated, ...update } as InstanceDoc, timesChanged, sequence, changed: true, promoted: promotion.promotedSignupIds };
      }
      tx.update(ref, update);
      return { instance: updated, timesChanged, sequence, changed: true, promoted: [] };
    });

    if (change.timesChanged) {
      const signups = await db.collection(COLLECTIONS.signups).where("instanceId", "==", input.instanceId).get();
      const content = (signupId: string) =>
        shiftChangedNotification({
          instanceId: input.instanceId,
          signupId,
          title: change.instance.title,
          orgName: change.instance.orgName,
          startMs: msOf(change.instance.start),
          timeZone: change.instance.timeZone
        });
      const writes: BatchWrite[] = signups.docs.flatMap((doc) => {
        const signup = doc.data() as SignupDoc;
        const refresh: BatchWrite = (batch) => batch.update(doc.ref, { instanceStart: change.instance.start, instanceEnd: change.instance.end, updatedAt: ts(nowMs) });
        if (!NOTIFY_ON_TIME_CHANGE.has(signup.status)) return [refresh];
        // Keyed by sequence: each time change is its own alert, and a retry of the same change rewrites it.
        return [refresh, (batch) => queueNotification(batch, db, signup.uid, content(doc.id), `${doc.id}_${change.sequence}`, nowMs)];
      });
      await commitInChunks(db, writes);
      await refreshNextInstanceStart(db, change.instance.opportunityId, nowMs);
    }
    return { instanceId: input.instanceId, sequence: change.sequence, promoted: [...change.promoted], changed: change.changed };
  }
});
