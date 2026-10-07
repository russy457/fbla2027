/**
 * finalize.ts
 * finalizeShift logic (SPEC#fn-finalizeshift, SPEC 5.5), shared by the
 * coordinator op and runDueJobs. Large rosters would overflow one
 * transaction, so each signup gets its own small transaction that re-reads
 * the status first (safe to repeat), and the instance is marked finalized
 * last (Appendix B item 33). Two overlapping runs therefore change each
 * signup at most once, and only the run that flips finalizedAt reports it.
 *
 *   confirmed, promoted < 24 h before start -> excused (late-promotion)
 *   confirmed (other)                       -> no-show
 *   checked-in (never checked out)          -> completed, hours pending review
 *   waitlisted (cutoff did not run)         -> cancelled (waitlist-cutoff)
 *   anything else                           -> unchanged
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  AppError,
  COLLECTIONS,
  assertTransition,
  creditedMinutes,
  isLatePromotion,
  type AppConfig,
  type Clock,
  type InstanceDoc,
  type SignupContactDoc,
  type SignupDoc,
  type SignupStatus
} from "@fbla/shared";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";
import { newShiftHoursLog } from "./hoursRecords";
import { withHistory } from "./signupRecords";

export interface FinalizeResult {
  readonly noShows: number;
  readonly excused: number;
  readonly autoCompleted: number;
  readonly waitlistCancelled: number;
  readonly alreadyFinalized: boolean;
}

type SignupOutcome = "no-show" | "excused" | "completed" | "cancelled" | "unchanged";

/** Who performed the finalize, for the signup history audit trail. */
export const SYSTEM_ACTOR = "system";

/** Finalizes one signup in its own transaction. Returns what happened to it. */
const finalizeSignup = async (db: Firestore, signupId: string, instance: InstanceDoc, actor: string, nowMs: number, config: AppConfig): Promise<SignupOutcome> => {
  const signupRef = db.collection(COLLECTIONS.signups).doc(signupId);
  const logRef = db.collection(COLLECTIONS.hoursLogs).doc(signupId);
  return runTx(db, async (tx) => {
    const signup = readDoc<SignupDoc>(await tx.get(signupRef));
    const existingLog = await tx.get(logRef);
    if (signup === null) return "unchanged";
    const startMs = msOf(instance.start);
    const endMs = msOf(instance.end);

    const move = (to: SignupStatus, extra: Record<string, unknown>): void => {
      assertTransition(signup.status, to, "finalizeShift");
      tx.update(signupRef, {
        ...extra,
        status: to,
        history: withHistory(signup.history, signup.status, to, actor, "finalizeShift", nowMs),
        updatedAt: ts(nowMs)
      });
    };

    switch (signup.status) {
      case "confirmed": {
        const latePromotion = signup.promotedAt !== null && isLatePromotion(msOf(signup.promotedAt), startMs, config);
        if (latePromotion) {
          move("excused", { excuseReason: "late-promotion" });
          return "excused";
        }
        move("no-show", {});
        return "no-show";
      }
      case "checked-in": {
        if (signup.checkInAt === null) return "unchanged";
        // No check-out: credit up to the scheduled end, then ask a coordinator to confirm.
        const minutes = creditedMinutes({ startMs, endMs, checkInMs: msOf(signup.checkInAt), checkOutMs: endMs });
        move("completed", { autoCompleted: true, checkOutAt: null });
        if (!existingLog.exists) tx.set(logRef, newShiftHoursLog({ signupId, signup, instance, minutes, source: "finalize", nowMs }));
        return "completed";
      }
      case "waitlisted":
        move("cancelled", { cancelReason: "waitlist-cutoff", lateCancel: false, cancelledAt: ts(nowMs) });
        return "cancelled";
      default:
        return "unchanged";
    }
  });
};

/** Freezes the roster's contact snapshots so later profile edits never rewrite history. */
const freezeContacts = async (db: Firestore, instanceId: string, nowMs: number): Promise<void> => {
  const contacts = await db.collection(COLLECTIONS.signupContacts).where("instanceId", "==", instanceId).get();
  const open = contacts.docs.filter((doc) => (doc.data() as SignupContactDoc).frozen !== true);
  if (open.length === 0) return;
  const batch = db.batch();
  open.forEach((doc) => batch.update(doc.ref, { frozen: true, updatedAt: ts(nowMs) }));
  await batch.commit();
};

export interface FinalizeOptions {
  /** uid of the coordinator, or SYSTEM_ACTOR for runDueJobs. */
  readonly actor: string;
}

export const finalizeInstance = async (db: Firestore, clock: Clock, config: AppConfig, instanceId: string, options: FinalizeOptions): Promise<FinalizeResult> => {
  const instanceRef = db.collection(COLLECTIONS.instances).doc(instanceId);
  const instance = readDoc<InstanceDoc>(await instanceRef.get());
  if (instance === null) throw new AppError("NOT_FOUND");
  const none = { noShows: 0, excused: 0, autoCompleted: 0, waitlistCancelled: 0 };
  if (instance.finalizedAt !== null) return { ...none, alreadyFinalized: true };
  if (instance.status === "cancelled") throw new AppError("SHIFT_CANCELLED");
  const nowMs = clock.nowMs();
  if (nowMs < msOf(instance.end)) throw new AppError("SHIFT_NOT_ENDED");

  const signups = await db.collection(COLLECTIONS.signups).where("instanceId", "==", instanceId).get();
  const outcomes: SignupOutcome[] = [];
  // Sequential on purpose: each signup is its own transaction, and running them
  // one at a time keeps contention with a concurrent run low.
  for (const doc of signups.docs) {
    outcomes.push(await finalizeSignup(db, doc.id, instance, options.actor, nowMs, config));
  }
  await freezeContacts(db, instanceId, nowMs);

  // The marker is written last and only once; a concurrent run that loses this race reports alreadyFinalized.
  const flipped = await runTx(db, async (tx) => {
    const latest = readDoc<InstanceDoc>(await tx.get(instanceRef));
    if (latest === null || latest.finalizedAt !== null) return false;
    tx.update(instanceRef, { status: "finalized", finalizedAt: ts(nowMs), nextActionAt: null, waitlist: [], updatedAt: ts(nowMs) });
    return true;
  });
  const count = (outcome: SignupOutcome) => outcomes.filter((value) => value === outcome).length;
  return {
    noShows: count("no-show"),
    excused: count("excused"),
    autoCompleted: count("completed"),
    waitlistCancelled: count("cancelled"),
    alreadyFinalized: !flipped
  };
};
