/**
 * ImpactPage.tsx
 * Route "/impact" (SPEC#screen-inventory "Impact", Tier 0: total, letters).
 * Total approved hours (CountUp on first view after a change, D15), progress
 * to the next milestone (D6 "0 of 25 hours..."), the letter builder (D8), and
 * the list of issued letters. The total is computed from the volunteer's own
 * approved hours logs (live) with the shared totalApprovedHours formula, the
 * same math recomputeVolunteerStats uses for users/{uid}; reading the logs
 * directly means the number is right the moment check-out finishes, without
 * waiting for the trigger. The letter preview uses the same logs plus each
 * organization's verified flag.
 */
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { totalApprovedHours } from "@fbla/shared";
import { ErrorState } from "@/components/ErrorState";
import { HoursTotal } from "@/components/impact/HoursTotal";
import { LetterBuilder } from "@/components/impact/LetterBuilder";
import { LetterList } from "@/components/impact/LetterList";
import { MilestoneProgress } from "@/components/impact/MilestoneProgress";
import { LoadingState } from "@/components/LoadingState";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { PageHeader } from "@/components/ui/PageHeader";
import { useMyApprovedLogs, useMyLetters } from "@/hooks/useVolunteerData";
import { getOrganizations } from "@/lib/data/orgs";
import { useSessionUser } from "@/store/authStore";

const ImpactPage = (): ReactElement => {
  const user = useSessionUser();
  const uid = user?.uid ?? null;
  const logs = useMyApprovedLogs(uid);
  const letters = useMyLetters(uid);
  const orgs = useQuery({ queryKey: ["organizations"], queryFn: getOrganizations, staleTime: 60_000 });

  if (logs.error || letters.error || orgs.isError) {
    return <ErrorState title="We couldn't load your impact" description="Check your connection, then reload the page." />;
  }
  if (!uid || logs.isLoading || letters.isLoading || orgs.isPending) {
    return <LoadingState label="Loading your impact" />;
  }

  const approvedLogs = logs.data ?? [];
  const hours = totalApprovedHours(approvedLogs.map((log) => log.minutes));

  return (
    <div className="flex flex-col gap-12">
      <PageHeader title="Impact">Your approved volunteer hours, and letters that prove them.</PageHeader>

      <section aria-label="Approved hours" className="flex flex-col gap-5">
        <HoursTotal uid={uid} hours={hours} />
        <div className="max-w-md">
          <MilestoneProgress hours={hours} />
        </div>
        {hours === 0 ? (
          <Link to="/" className={buttonClassName("secondary", "w-fit")}>
            Find shifts
          </Link>
        ) : null}
      </section>

      {approvedLogs.length === 0 ? (
        <section className="flex flex-col items-start gap-3">
          <h2 className="text-xl font-semibold text-fg">Get a verified letter</h2>
          <p className="text-fg-muted">No approved hours yet. Hours appear after you check out of a shift.</p>
          <Link to="/" className={buttonClassName("primary")}>
            Find shifts
          </Link>
        </section>
      ) : (
        <LetterBuilder logs={approvedLogs} orgs={orgs.data} letters={letters.data ?? []} />
      )}

      <LetterList letters={letters.data ?? []} />

      {/* Tier 1 lane B: manual hours entry and the hours report. */}
      <nav aria-label="More for your hours" className="flex flex-wrap gap-3">
        <Link to="/impact/hours/new" className={buttonClassName("secondary")}>
          Log outside hours
        </Link>
        <Link to="/impact/report" className={buttonClassName("secondary")}>
          Hours report
        </Link>
      </nav>
      {/* End Tier 1 lane B */}
    </div>
  );
};

export default ImpactPage;
