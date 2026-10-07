/**
 * rejectHours.ts
 * coordinator.rejectHours (SPEC 5.7). Moves one pending log to rejected with
 * a required reason. Rejecting an already-rejected log is a no-op; an
 * approved log changes only through setAttendance (INVALID_TRANSITION).
 * Rejected logs never count toward totals or letters. The volunteer gets an
 * "hours-rejected" notification with the reason (SPEC 8.3), keyed by the log id.
 */
import { AppError, COLLECTIONS, hoursRejectedNotification, type HoursLogDoc, type OrganizationDoc } from "@fbla/shared";
import { coordinatorOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { readDoc, runTx, ts } from "../lib/firestore";
import { logsResource } from "../lib/orgAuth";
import { queueNotification } from "../notifications/notify";

export const rejectHours = defineCallable({
  endpoint: "coordinator",
  op: "rejectHours",
  auth: coordinatorOf(logsResource((input: { logId: string }) => [input.logId])),
  handler: async ({ input, caller, clock, deps }) => {
    const { db } = deps;
    const nowMs = clock.nowMs();
    const at = ts(nowMs);
    const ref = db.collection(COLLECTIONS.hoursLogs).doc(input.logId);
    return runTx(db, async (tx) => {
      const log = readDoc<HoursLogDoc>(await tx.get(ref));
      if (log === null) throw new AppError("NOT_FOUND");
      const org = readDoc<OrganizationDoc>(await tx.get(db.collection(COLLECTIONS.organizations).doc(log.orgId)));
      if (log.status === "rejected") return { logId: input.logId, alreadyRejected: true };
      if (log.status !== "pending") throw new AppError("INVALID_TRANSITION", { from: log.status, to: "rejected" });
      tx.update(ref, { status: "rejected", needsReview: false, reviewedBy: caller.uid, reviewedAt: at, rejectReason: input.reason, updatedAt: at });
      queueNotification(tx, db, log.uid, hoursRejectedNotification(org?.name ?? "your organization", input.reason), input.logId, nowMs);
      return { logId: input.logId, alreadyRejected: false };
    });
  }
});
