/**
 * cutoff.ts
 * The waitlist cutoff (SPEC 5.11 step 3, SPEC 7.3): at start - 2 h every
 * still-waitlisted signup is cancelled with cancelReason "waitlist-cutoff"
 * (not counted against reliability) and the waitlist empties; seats freed
 * later go to walk-ups. One transaction; cutoffDoneAt is the idempotency
 * marker, so a repeated run is a no-op. Each cancelled volunteer gets a
 * waitlist-closed notification in the same transaction (deterministic id, so
 * it is never sent twice).
 */
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, assertTransition, waitlistClosedNotification, type InstanceDoc, type SignupDoc } from "@fbla/shared";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";
import { queueNotification } from "../notifications/notify";
import { SYSTEM_ACTOR } from "./finalize";
import { withHistory } from "./signupRecords";

/** Runs the cutoff for one instance; returns how many waitlisted signups were cancelled. */
export const runCutoff = async (db: Firestore, instanceId: string, nowMs: number): Promise<number> => {
  const instanceRef = db.collection(COLLECTIONS.instances).doc(instanceId);
  return runTx(db, async (tx) => {
    const instance = readDoc<InstanceDoc>(await tx.get(instanceRef));
    if (instance === null || instance.cutoffDoneAt !== null) return 0;
    const refs = instance.waitlist.map((entry) => db.collection(COLLECTIONS.signups).doc(entry.signupId));
    // Transactions need every read before the first write.
    const signups = await Promise.all(refs.map(async (ref) => ({ ref, data: readDoc<SignupDoc>(await tx.get(ref)) })));
    const waitlisted = signups.filter((entry) => entry.data?.status === "waitlisted");
    waitlisted.forEach(({ ref, data }) => {
      const signup = data as SignupDoc;
      assertTransition("waitlisted", "cancelled", "runDueJobs");
      tx.update(ref, {
        status: "cancelled",
        cancelReason: "waitlist-cutoff",
        lateCancel: false,
        cancelledAt: ts(nowMs),
        history: withHistory(signup.history, "waitlisted", "cancelled", SYSTEM_ACTOR, "runDueJobs", nowMs),
        updatedAt: ts(nowMs)
      });
      const content = waitlistClosedNotification({
        instanceId,
        signupId: ref.id,
        title: instance.title,
        orgName: instance.orgName,
        startMs: msOf(instance.start),
        timeZone: instance.timeZone
      });
      queueNotification(tx, db, signup.uid, content, ref.id, nowMs);
    });
    tx.update(instanceRef, {
      waitlist: [],
      cutoffDoneAt: ts(nowMs),
      // The next pending job for this instance is finalize.
      nextActionAt: instance.finalizedAt === null ? instance.finalizeAt : null,
      updatedAt: ts(nowMs)
    });
    return waitlisted.length;
  });
};
