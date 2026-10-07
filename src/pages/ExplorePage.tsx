/**
 * ExplorePage.tsx
 * Routes "/" and "/explore" (SPEC#screen-inventory: Explore; Tier 0 list,
 * Tier 1 recommended + filters). Above the fold, in SPEC order:
 *   1. the promotion / upcoming banner (signed in; D13),
 *   2. Recommended (SpotlightCard, one-line why; signed in),
 *   3. search + smart filters (URL state),
 *   4. upcoming shifts grouped by day in each shift's own zone, each row
 *      with the signup button matrix (D5) and Save.
 * Visitors can browse; "Sign up" sends them to sign in first. Live: seat
 * counts and the viewer's signup status update without a reload.
 * Tier 2 lane C: with a public Mapbox token configured, a List / Map switch
 * shows the filtered shifts' organizations on a map (list stays default).
 */
import { useMemo, useState, type ReactElement } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ErrorState } from "@/components/ErrorState";
import { ExploreFilters } from "@/components/explore/ExploreFilters";
// Tier 2 lane B
import { FeaturedCollections } from "@/components/collections/FeaturedCollections";
import { RecommendedShifts } from "@/components/explore/RecommendedShifts";
import { LoadingState } from "@/components/LoadingState";
import { PromotionBanner } from "@/components/shifts/PromotionBanner";
import { ShiftRow } from "@/components/shifts/ShiftRow";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { PageHeader } from "@/components/ui/PageHeader";
import { useActiveOpportunities } from "@/hooks/useInbox";
import { useNow } from "@/hooks/useNow";
import { useInstanceDays } from "@/hooks/useInstanceDays";
import { useUpcomingInstances } from "@/hooks/useShiftData";
import { useMySignups, usePrivateProfile } from "@/hooks/useVolunteerData";
import type { Signup } from "@/lib/data/signups";
import { getOrganizations } from "@/lib/data/orgs";
import { applyFilters, filtersToParams, parseFilters, type ExploreFilters as Filters, type ExploreRow } from "@/lib/explore/filters";
import { recommendShifts } from "@/lib/explore/recommendations";
import { useSessionUser } from "@/store/authStore";
// Tier 2 lane C
import { ExploreMapView, ExploreViewToggle, type ExploreView } from "@/components/explore/ExploreMapView";
import { readClientEnv } from "@/lib/env";
import { coarsePoint, mapboxTokenFrom, orgMapPoints } from "@/lib/explore/mapPoints";

/** The public Mapbox token, or null (map switch hidden) when unset or not a pk. token. */
const MAPBOX_TOKEN = ((): string | null => {
  const result = readClientEnv();
  return result.ok ? mapboxTokenFrom(result.env.VITE_MAPBOX_TOKEN) : null;
})();

/** Explore re-checks "Shift started" and seat states every 15 seconds. */
const EXPLORE_TICK_MS = 15_000;

const ExplorePage = (): ReactElement => {
  const nowMs = useNow(EXPLORE_TICK_MS);
  const user = useSessionUser();
  const uid = user?.uid ?? null;
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const [view, setView] = useState<ExploreView>("list"); // Tier 2 lane C
  const isMapView = MAPBOX_TOKEN !== null && view === "map";
  const instances = useUpcomingInstances(nowMs);
  const opportunities = useActiveOpportunities();
  const signups = useMySignups(uid);
  const profile = usePrivateProfile(uid);
  const orgs = useQuery({ queryKey: ["organizations"], queryFn: getOrganizations, staleTime: 60_000, enabled: filters.org !== null || isMapView });

  const signupByInstance = useMemo(
    () => new Map<string, Signup>((signups.data ?? []).map((signup) => [signup.instanceId, signup])),
    [signups.data]
  );
  const rows = useMemo((): ExploreRow[] => {
    const byId = new Map((opportunities.data ?? []).map((opportunity) => [opportunity.id, opportunity]));
    return (instances.data ?? []).map((instance) => ({ instance, opportunity: byId.get(instance.opportunityId) ?? null }));
  }, [instances.data, opportunities.data]);

  const me = profile.data ?? null;
  const filtered = useMemo(
    () => applyFilters(rows, filters, { birthDate: me?.birthDate ?? null, homeGeohash: me?.homeGeohash ?? null }),
    [rows, filters, me]
  );
  const days = useInstanceDays(
    filtered.map((row) => row.instance),
    nowMs
  );
  const picks = useMemo(
    () => (me === null ? [] : recommendShifts(rows, me, new Set(signupByInstance.keys()), nowMs)),
    [rows, me, signupByInstance, nowMs]
  );
  const visibleCount = days.reduce((sum, day) => sum + day.instances.length, 0);
  // Tier 2 lane C: map markers for the organizations behind the filtered list.
  const mapPoints = useMemo(
    () => (isMapView ? orgMapPoints(orgs.data ?? [], filtered.map((row) => row.instance.orgId)) : []),
    [isMapView, orgs.data, filtered]
  );
  const homeGeohash = me?.homeGeohash ?? null;
  const homeArea = useMemo(() => (homeGeohash === null ? null : coarsePoint(homeGeohash)), [homeGeohash]);
  const orgName = filters.org === null ? null : (orgs.data?.find((org) => org.id === filters.org)?.name ?? "one organization");
  const setFilters = (next: Filters): void => setParams(filtersToParams(next), { replace: true });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Explore">Upcoming volunteer shifts from local nonprofits. Times show in each organization's time zone.</PageHeader>

      {uid !== null ? <PromotionBanner uid={uid} signups={signups.data ?? []} nowMs={nowMs} /> : null}
      {me !== null && rows.length > 0 ? <RecommendedShifts picks={picks} hasInterests={me.interests.length > 0} /> : null}
      {/* Tier 2 lane B: published curated collections */}
      <FeaturedCollections />

      {instances.error ? (
        <ErrorState title="We couldn't load shifts" description="Check your connection, then reload the page." />
      ) : instances.isLoading ? (
        <LoadingState label="Loading shifts" />
      ) : rows.length === 0 ? (
        <section className="flex max-w-xl flex-col items-start gap-3 border-t border-border pt-6">
          <h2 className="text-xl font-semibold text-fg">No upcoming shifts right now.</h2>
          <p className="text-fg-muted">New shifts appear here as organizations post them. Check back soon, or read how signing up works.</p>
          <Link to="/help/find-and-sign-up" className={buttonClassName("secondary")}>
            How signing up works
          </Link>
        </section>
      ) : (
        <>
          <ExploreFilters
            filters={filters}
            onChange={setFilters}
            resultCount={visibleCount}
            signedIn={user !== null}
            canUseDistance={me?.homeGeohash != null}
            orgName={orgName}
          />
          {MAPBOX_TOKEN !== null ? <ExploreViewToggle view={view} onChange={setView} /> : null}
          {isMapView && MAPBOX_TOKEN !== null ? (
            <ExploreMapView accessToken={MAPBOX_TOKEN} points={mapPoints} homeArea={homeArea} isLoading={orgs.isLoading} />
          ) : days.length === 0 ? (
            <section className="flex max-w-xl flex-col items-start gap-3 border-t border-border pt-6">
              <h2 className="text-xl font-semibold text-fg">No shifts match these filters.</h2>
              <button type="button" onClick={() => setFilters(parseFilters(new URLSearchParams()))} className={buttonClassName("secondary")}>
                Clear filters
              </button>
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
                      birthDate={me?.birthDate ?? null}
                      signedIn={user !== null}
                      nowMs={nowMs}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
};

export default ExplorePage;
