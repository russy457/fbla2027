/**
 * generateOrgReport.ts
 * coordinator.generateOrgReport (SPEC 5.2, SPEC 8.6): the organization
 * participation report as a PDF. Auth is coordinatorOfOrg: the org is loaded
 * from the input orgId and the caller must be its owner or coordinator, so a
 * coordinator of org A gets PERMISSION_DENIED for org B and kiosk tokens are
 * refused. Dates are read in the org's time zone. The PDF is private to the
 * coordinator who generated it (reports/{uid}/{reportId}.pdf).
 */
import { COLLECTIONS, type OpportunityDoc } from "@fbla/shared";
import { coordinatorOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { readDoc } from "../lib/firestore";
import { orgResource } from "../lib/orgAuth";
import { loadOrgReportData } from "../reports/data/orgParticipation";
import { generateReport } from "../reports/reportService";

export const generateOrgReport = defineCallable({
  endpoint: "coordinator",
  op: "generateOrgReport",
  auth: coordinatorOf(orgResource((input: { orgId: string }) => input.orgId)),
  handler: async ({ input, caller, clock, deps, resource }) => {
    const org = resource.data;
    const opportunityId = input.opportunityId ?? null;
    const prepare = async () => {
      const opportunity =
        opportunityId === null ? null : readDoc<OpportunityDoc>(await deps.db.collection(COLLECTIONS.opportunities).doc(opportunityId).get());
      // An opportunity of another org is treated as unknown: it would match no shifts of this org anyway.
      const opportunityTitle = opportunity !== null && opportunity.orgId === resource.id ? opportunity.title : opportunityId === null ? null : "Unknown opportunity";
      const data = await loadOrgReportData(deps.db, { orgId: resource.id, from: input.from, to: input.to, timeZone: org.timeZone, opportunityId });
      return {
        kind: "org-participation" as const,
        orgName: org.name,
        opportunityTitle,
        data,
        sections: input.sections,
        themeId: input.themeId,
        from: input.from,
        to: input.to,
        generatedAt: clock.now(),
        timeZone: org.timeZone
      };
    };
    return generateReport({
      deps,
      uid: caller.uid,
      kind: "org-participation",
      orgId: resource.id,
      requestNonce: input.requestNonce,
      params: { from: input.from, to: input.to, sections: input.sections, themeId: input.themeId, opportunityId },
      nowMs: clock.nowMs(),
      prepare
    });
  }
});
