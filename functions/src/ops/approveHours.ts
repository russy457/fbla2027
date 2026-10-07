/**
 * approveHours.ts
 * coordinator.approveHours (SPEC#fn-approvehours, SPEC 5.7). Moves 1-50
 * pending logs, all from one org (the resolver refuses a mixed list), to
 * approved in one transaction. Already-approved logs are skipped; a rejected
 * log cannot be approved (INVALID_TRANSITION) because rejected never counts
 * and approved logs change only through setAttendance. Approving a 0-minute
 * needsReview log is allowed: it simply clears the review.
 * Each approved log with minutes sends its volunteer an "hours-approved" notification
 * (SPEC 8.3) in the same transaction, keyed by the log id, so a retry (which
 * skips already-approved logs) never alerts twice.
 */
import { AppError, COLLECTIONS, hoursApprovedNotification, minutesToHours, type HoursLogDoc, type OrganizationDoc } from "@fbla/shared";
import { coordinatorOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { readDoc, runTx, ts } from "../lib/firestore";
import { logsResource } from "../lib/orgAuth";
import { queueNotification } from "../notifications/notify";

export const approveHours = defineCallable({
  endpoint: "coordinator",
  op: "approveHours",
  auth: coordinatorOf(logsResource((input: { logIds: string[] }) => input.logIds)),
  handler: async ({ input, caller, clock, deps }) => {
    const { db } = deps;
    const nowMs = clock.nowMs();
    const at = ts(nowMs);
    const refs = input.logIds.map((id) => db.collection(COLLECTIONS.hoursLogs).doc(id));
    return runTx(db, async (tx) => {
      const logs = await Promise.all(refs.map(async (ref) => ({ ref, log: readDoc<HoursLogDoc>(await tx.get(ref)) })));
      if (logs.some(({ log }) => log === null)) throw new AppError("NOT_FOUND");
      // The resolver already checked every log shares one org; its name goes in the alert.
      const orgId = (logs[0]?.log as HoursLogDoc).orgId;
      const org = readDoc<OrganizationDoc>(await tx.get(db.collection(COLLECTIONS.organizations).doc(orgId)));
      if (logs.some(({ log }) => log?.status === "rejected")) throw new AppError("INVALID_TRANSITION", { from: "rejected", to: "approved" });
      const pending = logs.filter(({ log }) => log?.status === "pending");
      pending.forEach(({ ref, log }) => {
        tx.update(ref, { status: "approved", needsReview: false, reviewedBy: caller.uid, reviewedAt: at, updatedAt: at });
        const approved = log as HoursLogDoc;
        // A 0-minute approval only clears a review; "0 hours approved" would read as an error.
        if (approved.minutes > 0) queueNotification(tx, db, approved.uid, hoursApprovedNotification(minutesToHours(approved.minutes), org?.name ?? "your organization"), ref.id, nowMs);
      });
      return { approved: pending.length, skipped: logs.length - pending.length };
    });
  }
});
