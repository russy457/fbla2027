/**
 * MatchesStep.tsx
 * The end of onboarding (SPEC#screen-onboarding D10 step 8: "Finish:
 * completeProfile, then '3 shifts that match you'"). Ranks upcoming shifts
 * against the profile just saved, with the same recommendShifts() Explore
 * uses, and offers a Continue to wherever the person was headed.
 */
import { useMemo, type ReactElement } from "react";
import { RecommendedShifts } from "@/components/explore/RecommendedShifts";
import { LoadingState } from "@/components/LoadingState";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { useActiveOpportunities } from "@/hooks/useInbox";
import { useNow } from "@/hooks/useNow";
import { useUpcomingInstances } from "@/hooks/useShiftData";
import { usePrivateProfile } from "@/hooks/useVolunteerData";
import { recommendShifts } from "@/lib/explore/recommendations";

interface MatchesStepProps {
  readonly uid: string;
  readonly onContinue: () => void;
}

export const MatchesStep = ({ uid, onContinue }: MatchesStepProps): ReactElement => {
  const nowMs = useNow(60_000);
  const profile = usePrivateProfile(uid);
  const instances = useUpcomingInstances(nowMs);
  const opportunities = useActiveOpportunities();
  const picks = useMemo(() => {
    if (!profile.data) return [];
    const byId = new Map((opportunities.data ?? []).map((opportunity) => [opportunity.id, opportunity]));
    const rows = (instances.data ?? []).map((instance) => ({ instance, opportunity: byId.get(instance.opportunityId) ?? null }));
    return recommendShifts(rows, profile.data, new Set(), nowMs);
  }, [profile.data, instances.data, opportunities.data, nowMs]);

  if (profile.isLoading || instances.isLoading || opportunities.isLoading) return <LoadingState label="Finding shifts for you" />;

  return (
    <div className="flex flex-col gap-6">
      <RecommendedShifts picks={picks} hasInterests={(profile.data?.interests.length ?? 0) > 0} title="3 shifts that match you" headingLevel={1} />
      {picks.length === 0 && (profile.data?.interests.length ?? 0) > 0 ? (
        <p className="text-fg-muted">No open shifts match yet. New ones appear on Explore as organizations post them.</p>
      ) : null}
      <button type="button" onClick={onContinue} className={buttonClassName("primary", "w-fit")}>
        Continue
      </button>
    </div>
  );
};
