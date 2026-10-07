/**
 * useReportPreview.ts
 * Loads the rows behind a report preview (src/lib/data/reportData.ts) with
 * TanStack Query and aggregates them with the same shared functions the PDF
 * uses (SPEC 8.6), so what a person previews is what they download.
 * Org rows are refetched when the date range changes; the opportunity filter
 * is applied in memory. Volunteer rows load once (lifetime totals feed the
 * milestones section) and the range is applied in memory.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildOrgReport, buildVolunteerReport, isValidYmd, type OrgReportData, type VolunteerReportData } from "@fbla/shared";
import { loadOrgReportRows, loadVolunteerReportRows, reportRangeFor } from "@/lib/data/reportData";

const PREVIEW_STALE_MS = 30_000;

export interface PreviewResult<T> {
  readonly data: T | undefined;
  readonly isLoading: boolean;
  readonly error: Error | null;
}

/** An opportunity the org report can be filtered to, taken from the org's shifts. */
export interface OpportunityOption {
  readonly id: string;
  readonly title: string;
}

const validRange = (from: string, to: string): boolean => isValidYmd(from) && isValidYmd(to) && from <= to;

export const useOrgReportPreview = (
  orgId: string,
  from: string,
  to: string,
  timeZone: string,
  opportunityId: string | null
): PreviewResult<OrgReportData> & { readonly opportunities: OpportunityOption[] } => {
  const enabled = orgId !== "" && validRange(from, to);
  const range = enabled ? reportRangeFor(from, to, timeZone) : null;
  const rows = useQuery({
    queryKey: ["reportRows", "org", orgId, from, to, timeZone],
    queryFn: () => loadOrgReportRows(orgId, reportRangeFor(from, to, timeZone)),
    enabled,
    staleTime: PREVIEW_STALE_MS
  });
  const data = useMemo(
    () => (rows.data && range ? buildOrgReport({ ...rows.data, range, timeZone, opportunityId }) : undefined),
    // range is derived from from/to/timeZone, which are in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows.data, from, to, timeZone, opportunityId]
  );
  const opportunities = useMemo(() => {
    const byId = new Map(Object.values(rows.data?.shifts ?? {}).map((shift) => [shift.opportunityId, shift.title]));
    return [...byId.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [rows.data]);
  return { data, opportunities, isLoading: enabled && rows.isPending, error: rows.error };
};

export const useVolunteerReportPreview = (uid: string | null, from: string, to: string, timeZone: string): PreviewResult<VolunteerReportData> => {
  const rows = useQuery({
    queryKey: ["reportRows", "volunteer", uid],
    queryFn: () => loadVolunteerReportRows(uid ?? ""),
    enabled: uid !== null,
    staleTime: PREVIEW_STALE_MS
  });
  const data = useMemo(
    () => (rows.data && validRange(from, to) ? buildVolunteerReport({ ...rows.data, range: reportRangeFor(from, to, timeZone), timeZone }) : undefined),
    [rows.data, from, to, timeZone]
  );
  return { data, isLoading: uid !== null && rows.isPending, error: rows.error };
};
