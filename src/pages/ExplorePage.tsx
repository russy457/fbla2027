/**
 * ExplorePage.tsx
 * Routes "/" and "/explore" (SPEC#screen-inventory: Explore, Tier 0 list).
 * Upcoming shifts from every organization, grouped by day in each shift's
 * own time zone, with the signup button matrix on each row. Visitors can
 * browse; "Sign up" sends them to sign in first. Live: seat counts and the
 * viewer's signup status update without a reload.
 */
import { useMemo, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { ShiftRow } from "@/components/shifts/ShiftRow";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { PageHeader } from "@/components/ui/PageHeader";
import { useNow } from "@/hooks/useNow";
import { useInstanceDays } from "@/hooks/useInstanceDays";
import { useUpcomingInstances } from "@/hooks/useShiftData";
import { useMySignups, usePrivateProfile } from "@/hooks/useVolunteerData";
import type { Signup } from "@/lib/data/signups";
import { useSessionUser } from "@/store/authStore";

/** Explore re-checks "Shift started" and seat states every 15 seconds. */
const EXPLORE_TICK_MS = 15_000;

const ExplorePage = (): ReactElement => {
  const nowMs = useNow(EXPLORE_TICK_MS);
  const user = useSessionUser();
  const uid = user?.uid ?? null;
  const instances = useUpcomingInstances(nowMs);
  const signups = useMySignups(uid);
  const profile = usePrivateProfile(uid);
  const days = useInstanceDays(instances.data ?? [], nowMs);

  const signupByInstance = useMemo(
    () => new Map<string, Signup>((signups.data ?? []).map((signup) => [signup.instanceId, signup])),
    [signups.data]
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Explore">Upcoming volunteer shifts from local nonprofits. Times show in each organization's time zone.</PageHeader>

      {instances.error ? (
        <ErrorState title="We couldn't load shifts" description="Check your connection, then reload the page." />
      ) : instances.isLoading ? (
        <LoadingState label="Loading shifts" />
      ) : days.length === 0 ? (
        <section className="flex max-w-xl flex-col items-start gap-3 border-t border-border pt-6">
          <h2 className="text-xl font-semibold text-fg">No upcoming shifts right now.</h2>
          <p className="text-fg-muted">New shifts appear here as organizations post them. Check back soon, or read how signing up works.</p>
          <Link to="/help/find-and-sign-up" className={buttonClassName("secondary")}>
            How signing up works
          </Link>
        </section>
      ) : (
        days.map((day) => (
          <section key={day.key} aria-labelledby={`day-${day.key}`} className="flex flex-col">
            <h2 id={`day-${day.key}`} className="border-b border-border-strong pb-2 text-sm font-semibold tracking-wide text-fg-muted">
              {day.label}
            </h2>
            <ul className="divide-y divide-border">
              {day.instances.map((instance) => (
                <ShiftRow
                  key={instance.id}
                  instance={instance}
                  signup={signupByInstance.get(instance.id) ?? null}
                  birthDate={profile.data?.birthDate ?? null}
                  signedIn={user !== null}
                  nowMs={nowMs}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
};

export default ExplorePage;
