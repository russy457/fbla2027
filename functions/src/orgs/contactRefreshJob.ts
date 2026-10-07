/**
 * contactRefreshJob.ts
 * Durable, self-healing T4 contact hiding after an organization's verified
 * flag changes (SPEC 3.21 contactRefreshJobs, Appendix B 49).
 *
 * The hiding pass touches every open contact snapshot of the org in several
 * chunks, so it cannot be one atomic write. Without a record of pending work,
 * a failure after the first chunk would leave minors' contact details
 * visible at a now-unverified org with nothing to finish the job. So:
 *
 *   writeVerifiedChange   one batch writes the org update AND
 *                         contactRefreshJobs/{orgId} {token, nextActionAt: now}:
 *                         the flag never changes without a pending repair.
 *   refreshAfterVerifiedChange
 *                         the op's immediate pass, for responsiveness. A
 *                         failure is logged, not thrown: the org change did
 *                         happen, and runDueJobs finishes the repair.
 *   runContactRefreshJobs runDueJobs step: due jobs, oldest first.
 *
 * Every pass reads the org's current name and verified flag (never a value
 * captured earlier), skips snapshots that already match, and commits each
 * chunk only while the org still has that flag (refreshOrgDenormals). The job
 * is deleted only after a complete pass and only if its token is unchanged,
 * so a newer change made mid-pass keeps its own pending job.
 */
import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, isAppError, type ContactRefreshJobDoc, type OrganizationDoc } from "@fbla/shared";
import type { ServerDeps } from "../lib/deps";
import { readDoc, runTx, ts } from "../lib/firestore";
import { refreshOrgDenormals, type RefreshOptions } from "./refreshOrgDenormals";

const jobRef = (db: Firestore, orgId: string) => db.collection(COLLECTIONS.contactRefreshJobs).doc(orgId);

/** Writes the org's verified change and its pending repair job in one batch; returns the job token. */
export const writeVerifiedChange = async (db: Firestore, orgId: string, orgUpdate: Record<string, unknown>, nowMs: number): Promise<string> => {
  const token = randomUUID();
  const job: ContactRefreshJobDoc = { orgId, token, requestedAt: ts(nowMs), nextActionAt: ts(nowMs) };
  const batch = db.batch();
  batch.update(db.collection(COLLECTIONS.organizations).doc(orgId), orgUpdate);
  batch.set(jobRef(db, orgId), job);
  await batch.commit();
  return token;
};

/** Deletes the job only if it still carries `token` (a newer change replaces the token). */
const clearJob = async (db: Firestore, orgId: string, token: string): Promise<boolean> => {
  const ref = jobRef(db, orgId);
  return runTx(db, async (tx) => {
    const job = readDoc<ContactRefreshJobDoc>(await tx.get(ref));
    if (job?.token !== token) return false;
    tx.delete(ref);
    return true;
  });
};

/**
 * One full pass for the org's current facts. Returns true when this pass
 * finished the job (cleared it), false when a newer change overtook it and
 * left its own pending job.
 */
export const runContactRefresh = async (db: Firestore, orgId: string, token: string, nowMs: number, options: RefreshOptions = {}): Promise<boolean> => {
  const org = readDoc<OrganizationDoc>(await db.collection(COLLECTIONS.organizations).doc(orgId).get());
  if (org !== null) {
    const result = await refreshOrgDenormals(db, { orgId, name: org.name, verified: org.verified }, nowMs, true, options);
    if (!result.complete) return false;
  }
  // A deleted org had no activity, so it has no contact snapshots left to fix.
  return clearJob(db, orgId, token);
};

/** The op's immediate pass. Never throws: a failed pass stays pending for runDueJobs. */
export const refreshAfterVerifiedChange = async (deps: ServerDeps, orgId: string, token: string, nowMs: number): Promise<void> => {
  try {
    await runContactRefresh(deps.db, orgId, token, nowMs);
  } catch (error) {
    deps.log.error("contact refresh failed; runDueJobs will finish it", { orgId, error: error instanceof Error ? error.message : String(error) });
  }
};

export interface ContactRefreshRun {
  /** Due jobs looked at this run. */
  readonly due: number;
  /** Jobs finished (cleared). */
  readonly refreshed: number;
  readonly errors: ReadonlyArray<{ readonly id: string; readonly code: string }>;
}

/** runDueJobs step: processes due contactRefreshJobs one at a time, oldest first. */
export const runContactRefreshJobs = async (deps: ServerDeps, nowMs: number, pageSize: number): Promise<ContactRefreshRun> => {
  const due = await deps.db
    .collection(COLLECTIONS.contactRefreshJobs)
    .where("nextActionAt", "<=", ts(nowMs))
    .orderBy("nextActionAt")
    .limit(pageSize)
    .get();
  let refreshed = 0;
  const errors: Array<{ id: string; code: string }> = [];
  for (const doc of due.docs) {
    const job = doc.data() as ContactRefreshJobDoc;
    try {
      if (await runContactRefresh(deps.db, doc.id, job.token, nowMs)) refreshed += 1;
    } catch (error) {
      const code = isAppError(error) ? error.code : "INTERNAL";
      errors.push({ id: `contactRefresh:${doc.id}`, code });
      deps.log.error("runDueJobs contact refresh failed", { orgId: doc.id, code, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { due: due.size, refreshed, errors };
};
