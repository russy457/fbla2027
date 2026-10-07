/**
 * approveHours.ts
 * coordinator.approveHours (SPEC#fn-approvehours, SPEC 5.7). Moves 1-50
 * pending logs, all from one org (the resolver refuses a mixed list), to
 * approved in one transaction. Already-approved logs are skipped; a rejected
 * log cannot be approved (INVALID_TRANSITION) because rejected never counts
 * and approved logs change only through setAttendance. Approving a 0-minute
 * needsReview log is allowed: it simply clears the review.
 */
import { AppError, COLLECTIONS, type HoursLogDoc } from "@fbla/shared";
import { coordinatorOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { readDoc, runTx, ts } from "../lib/firestore";
import { logsResource } from "../lib/orgAuth";

export const approveHours = defineCallable({
  endpoint: "coordinator",
  op: "approveHours",
  auth: coordinatorOf(logsResource((input: { logIds: string[] }) => input.logIds)),
  handler: async ({ input, caller, clock, deps }) => {
    const { db } = deps;
    const at = ts(clock.nowMs());
    const refs = input.logIds.map((id) => db.collection(COLLECTIONS.hoursLogs).doc(id));
    return runTx(db, async (tx) => {
      const logs = await Promise.all(refs.map(async (ref) => ({ ref, log: readDoc<HoursLogDoc>(await tx.get(ref)) })));
      if (logs.some(({ log }) => log === null)) throw new AppError("NOT_FOUND");
      if (logs.some(({ log }) => log?.status === "rejected")) throw new AppError("INVALID_TRANSITION", { from: "rejected", to: "approved" });
      const pending = logs.filter(({ log }) => log?.status === "pending");
      pending.forEach(({ ref }) => tx.update(ref, { status: "approved", needsReview: false, reviewedBy: caller.uid, reviewedAt: at, updatedAt: at }));
      // TODO(lane A notify): "hours-approved" notification to each volunteer.
      return { approved: pending.length, skipped: logs.length - pending.length };
    });
  }
});
