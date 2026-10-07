/**
 * verifyOrganization.ts
 * admin.verifyOrganization (SPEC 5.2, T4). Set semantics: verified true or
 * false. Writes verifiedAt / verifiedBy on the org, keeps the private note in
 * the server-only orgVerificationLog (the org document is public), and
 * refreshes orgVerified on listings and T4 hiding on open contact snapshots.
 * The flag change and a pending contactRefreshJobs entry are one batch; the
 * immediate pass clears the job, and runDueJobs finishes it if the pass
 * fails partway (orgs/contactRefreshJob.ts).
 */
import { COLLECTIONS, type OrgVerificationLogDoc, type OrganizationDoc } from "@fbla/shared";
import { admin, loadOrNotFound } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { ts } from "../lib/firestore";
import { refreshAfterVerifiedChange, writeVerifiedChange } from "../orgs/contactRefreshJob";

export const verifyOrganization = defineCallable({
  endpoint: "admin",
  op: "verifyOrganization",
  auth: admin(),
  handler: async ({ input, caller, clock, deps }) => {
    const { db } = deps;
    const nowMs = clock.nowMs();
    const org = await loadOrNotFound<OrganizationDoc>(db, COLLECTIONS.organizations, input.orgId);
    const log: OrgVerificationLogDoc = { orgId: input.orgId, verified: input.verified, note: input.note ?? "", by: caller.uid, at: ts(nowMs) };
    await db.collection(COLLECTIONS.orgVerificationLog).add(log);
    if (org.data.verified === input.verified) return { orgId: input.orgId, verified: input.verified };

    const token = await writeVerifiedChange(db, input.orgId, {
      verified: input.verified,
      verifiedAt: input.verified ? ts(nowMs) : null,
      verifiedBy: input.verified ? caller.uid : null,
      updatedAt: ts(nowMs)
    }, nowMs);
    await refreshAfterVerifiedChange(deps, input.orgId, token, nowMs);
    return { orgId: input.orgId, verified: input.verified };
  }
});
