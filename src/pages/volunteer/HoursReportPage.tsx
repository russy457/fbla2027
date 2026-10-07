/**
 * HoursReportPage.tsx
 * Route "/impact/report" (SPEC#screen-inventory "Reports", SPEC 8.6): the
 * volunteer's own hours report. Pick dates, sections, and a theme; preview
 * on screen, then download a PDF or a CSV of your hours. Dates are calendar
 * days in America/Chicago, the same zone letters use. Guarded by
 * RequireProfile, so the viewer is signed in with a finished profile.
 */
import type { ReactElement } from "react";
import { DEFAULT_TIME_ZONE, localDateIn } from "@fbla/shared";
import { defaultReportRange } from "@/components/reports/DateRangeFields";
import { ReportBuilder, type GenerateArgs, type PreviewState, type ReportFilters } from "@/components/reports/ReportBuilder";
import { PageHeader } from "@/components/ui/PageHeader";
import { useNow } from "@/hooks/useNow";
import { useVolunteerReportPreview } from "@/hooks/useReportPreview";
import { api } from "@/lib/api";
import { useSessionUser } from "@/store/authStore";

const PAGE_TICK_MS = 60_000;
const TIME_ZONE = DEFAULT_TIME_ZONE;

const HoursReportPage = (): ReactElement => {
  const user = useSessionUser();
  const nowMs = useNow(PAGE_TICK_MS);
  const uid = user?.uid ?? null;

  const usePreview = (filters: ReportFilters): PreviewState => {
    // Called by ReportBuilder on every render, in the same order: a normal hook call.
    const result = useVolunteerReportPreview(uid, filters.from, filters.to, TIME_ZONE);
    return { ...result, opportunities: [], preview: result.data ? { kind: "volunteer-hours", data: result.data } : undefined };
  };
  const generate = async (args: GenerateArgs) =>
    api.volunteer.generateVolunteerReport({
      from: args.from,
      to: args.to,
      sections: args.sections as Parameters<typeof api.volunteer.generateVolunteerReport>[0]["sections"],
      themeId: args.themeId,
      requestNonce: args.requestNonce
    });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Hours report">Your volunteer hours by organization and month. Preview it here, then download a PDF or a CSV.</PageHeader>
      <ReportBuilder
        kind="volunteer-hours"
        initialRange={defaultReportRange(nowMs, TIME_ZONE)}
        maxDate={localDateIn(new Date(nowMs), TIME_ZONE)}
        usePreview={usePreview}
        generate={generate}
        expandErrorDetails={false}
      />
    </div>
  );
};

export default HoursReportPage;
