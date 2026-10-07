/**
 * ExplorePage.tsx
 * Route "/explore": full-width photography with search and a live schedule
 * that scrolls over the image. Shifts are grouped by day in each shift's own
 * zone, with the signup button matrix (D5) and Save in each row.
 * Visitors can browse; "Sign up" sends them to sign in first. Live: seat
 * counts and the viewer's signup status update without a reload.
 * Tier 2 lane C: with a public Mapbox token configured, a List / Map switch
 * shows the filtered shifts' organizations on a map (list stays default).
 */
import { useMemo, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown } from "@phosphor-icons/react";
import { ExploreFilters } from "@/components/explore/ExploreFilters";
// Tier 2 lane B
import { FeaturedCollections } from "@/components/collections/FeaturedCollections";
import { ExploreCauseRibbon } from "@/components/editorial/ExploreCauseRibbon";
import { RecommendedShifts } from "@/components/explore/RecommendedShifts";
import { ScheduleBoard } from "@/components/explore/ScheduleBoard";
import { PromotionBanner } from "@/components/shifts/PromotionBanner";
import { EXPLORE_SCENE_PHOTOS } from "@/content/pageVisuals";
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
    <div className="explore-page">
      <section className="explore-scene" aria-labelledby="explore-title">
        <div className="explore-scene__media" aria-hidden="true">
          <picture>
            <source media="(max-width: 58rem)" srcSet={EXPLORE_SCENE_PHOTOS.mobile.src} />
            <img src={EXPLORE_SCENE_PHOTOS.desktop.src} alt="" fetchPriority="high" decoding="async" />
          </picture>
        </div>
        <div className="explore-scene__flow">
          <div className="explore-scene__intro">
            <p className="explore-scene__eyebrow">Volunteer schedule</p>
            <h1 id="explore-title" tabIndex={-1}>Find a time that <em>fits your life.</em></h1>
            <p>Choose a day, find a shift, and save your spot.</p>
            <a href="#schedule" className="explore-scene__jump">Browse shifts <ArrowDown aria-hidden="true" size={18} /></a>
          </div>
          <div id="schedule" className="explore-schedule-wrap">
            {uid !== null ? <PromotionBanner uid={uid} signups={signups.data ?? []} nowMs={nowMs} /> : null}
            {!instances.error && !instances.isLoading && rows.length > 0 ? (
              <div className="explore-controls">
                <ExploreFilters filters={filters} onChange={setFilters} resultCount={visibleCount} signedIn={user !== null} canUseDistance={me?.homeGeohash != null} orgName={orgName} />
                {MAPBOX_TOKEN !== null ? <ExploreViewToggle view={view} onChange={setView} /> : null}
              </div>
            ) : null}
            <ScheduleBoard
              days={days}
              unfilteredCount={rows.length}
              signups={signupByInstance}
              birthDate={me?.birthDate ?? null}
              signedIn={user !== null}
              nowMs={nowMs}
              isLoading={instances.isLoading}
              hasError={Boolean(instances.error)}
              onClearFilters={() => setFilters(parseFilters(new URLSearchParams()))}
              mapContent={isMapView && MAPBOX_TOKEN !== null ? <ExploreMapView accessToken={MAPBOX_TOKEN} points={mapPoints} homeArea={homeArea} isLoading={orgs.isLoading} /> : undefined}
            />
          </div>
        </div>
      </section>
      <div className="explore-after">
        <div className="explore-after__inner">
          <ExploreCauseRibbon />
          {me !== null && rows.length > 0 ? <RecommendedShifts picks={picks} hasInterests={me.interests.length > 0} /> : null}
          <FeaturedCollections />
        </div>
      </div>
    </div>
  );
};

export default ExplorePage;
