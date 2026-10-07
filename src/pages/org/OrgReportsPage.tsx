/**
 * OrgReportsPage.tsx
 * Route "/org/:orgId/reports" (SPEC#screen-inventory "Reports", SPEC 8.6):
 * the organization participation report. Coordinators pick dates, an
 * optional opportunity, sections, and a theme; the preview, the CSV, and the
 * PDF all use the shared aggregation. Dates are calendar days in the org's
 * time zone. Guarded by RequireCoordinator; the op re-checks membership.
 */
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_TIME_ZONE, localDateIn } from "@fbla/shared";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { defaultReportRange } from "@/components/reports/DateRangeFields";
import { ReportBuilder, type GenerateArgs, type PreviewState, type ReportFilters } from "@/components/reports/ReportBuilder";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { useNow } from "@/hooks/useNow";
import { useOrgReportPreview } from "@/hooks/useReportPreview";
import { api } from "@/lib/api";
import { getOrganization } from "@/lib/data/orgs";

const PAGE_TICK_MS = 60_000;

const OrgReportsPage = (): ReactElement => {
  const { orgId = "" } = useParams();
  const nowMs = useNow(PAGE_TICK_MS);
  const org = useQuery({ queryKey: ["organization", orgId], queryFn: () => getOrganization(orgId), staleTime: 60_000 });

  if (org.isError) return <ErrorState title="We couldn't load this organization" description="Check your connection, then reload." />;
  if (org.isPending) return <LoadingState label="Loading reports" />;

  const timeZone = org.data?.timeZone ?? DEFAULT_TIME_ZONE;
  const usePreview = (filters: ReportFilters): PreviewState => {
    // Called by ReportBuilder on every render, in the same order: a normal hook call.
    const result = useOrgReportPreview(orgId, filters.from, filters.to, timeZone, filters.opportunityId);
    return { ...result, preview: result.data ? { kind: "org-participation", data: result.data } : undefined };
  };
  const generate = async (args: GenerateArgs) =>
    api.coordinator.generateOrgReport({
      orgId,
      from: args.from,
      to: args.to,
      sections: args.sections as Parameters<typeof api.coordinator.generateOrgReport>[0]["sections"],
      themeId: args.themeId,
      opportunityId: args.opportunityId,
      requestNonce: args.requestNonce
    });

  return (
    <OrgPageShell
      title="Reports"
      intro={`Participation at ${org.data?.name ?? "your organization"}: signups, attendance, and approved hours. Preview it here, then download a PDF or a CSV.`}
    >
      <ReportBuilder
        kind="org-participation"
        initialRange={defaultReportRange(nowMs, timeZone)}
        maxDate={localDateIn(new Date(nowMs), timeZone)}
        usePreview={usePreview}
        generate={generate}
        expandErrorDetails
      />
    </OrgPageShell>
  );
};

export default OrgReportsPage;
