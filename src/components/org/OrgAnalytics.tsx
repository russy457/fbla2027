/**
 * OrgAnalytics.tsx
 * The dashboard analytics strip (SPEC 9.2 "Coordinator Dashboard", Tier 1):
 * attendance rate (completed of completed + no-show, with its inputs, never
 * a color alone) and approved hours this month in the org's zone. Reads are
 * live; the math is in lib/orgAnalytics.ts.
 */
import type { ReactElement } from "react";
import { useOrgLogsSince, useOrgSignups } from "@/hooks/useOrgAdmin";
import { computeOrgAnalytics, formatRate, startOfMonthMs } from "@/lib/orgAnalytics";

interface OrgAnalyticsProps {
  readonly orgId: string;
  readonly timeZone: string;
  readonly nowMs: number;
}

const Stat = ({ label, value, note }: { label: string; value: string; note: string }): ReactElement => (
  <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
    <dt className="text-sm font-semibold text-fg-muted">{label}</dt>
    <dd className="text-2xl font-semibold text-fg">{value}</dd>
    <dd className="text-sm text-fg-muted">{note}</dd>
  </div>
);

export const OrgAnalytics = ({ orgId, timeZone, nowMs }: OrgAnalyticsProps): ReactElement | null => {
  const monthStart = startOfMonthMs(nowMs, timeZone);
  const signups = useOrgSignups(orgId);
  const logs = useOrgLogsSince(orgId, monthStart);
  if (signups.error || logs.error || signups.isLoading || logs.isLoading) return null;
  const stats = computeOrgAnalytics(signups.data ?? [], logs.data ?? [], nowMs, timeZone);
  return (
    <section aria-labelledby="analytics-title" className="flex flex-col gap-3">
      <h2 id="analytics-title" className="text-lg font-semibold text-fg">At a glance</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Stat label="Attendance rate" value={formatRate(stats.attendanceRate)} note={`${stats.completed} attended, ${stats.noShows} no-shows`} />
        <Stat label="Hours this month" value={String(stats.hoursThisMonth)} note="Approved hours dated this month" />
      </dl>
    </section>
  );
};
