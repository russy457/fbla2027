/**
 * ExploreMapView.tsx
 * Explore's List / Map switch and the map view (SPEC 9.1 "Explore map
 * toggle", Tier 2). The list stays the default and the accessible primary
 * view; the switch exists only when a public Mapbox token is configured
 * (mapboxTokenFrom), so a build without VITE_MAPBOX_TOKEN shows no trace
 * of the map.
 *
 * The map view pairs the lazily loaded canvas (OrgMap) with the same
 * organizations as a list of links, so everything on the map is reachable
 * without it. Locations are approximate and the copy says so.
 */
import { Suspense, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { ListBullets, MapTrifold } from "@phosphor-icons/react";
import { LoadingState } from "@/components/LoadingState";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { shiftCountText, type MapPoint } from "@/lib/explore/mapPoints";
import { lazyWithReload } from "@/lib/lazyWithReload";
import type { GeoPoint } from "@/lib/search";
import { cn } from "@/lib/cn";

const OrgMap = lazyWithReload(() => import("./OrgMap"));

export type ExploreView = "list" | "map";

interface ViewToggleProps {
  readonly view: ExploreView;
  readonly onChange: (view: ExploreView) => void;
}

const VIEW_OPTIONS: ReadonlyArray<{ readonly view: ExploreView; readonly label: string; readonly icon: typeof ListBullets }> = [
  { view: "list", label: "List", icon: ListBullets },
  { view: "map", label: "Map", icon: MapTrifold }
];

export const ExploreViewToggle = ({ view, onChange }: ViewToggleProps): ReactElement => (
  <div role="group" aria-label="Show shifts as" className="inline-flex w-fit gap-1 rounded-md border border-border bg-surface p-1">
    {VIEW_OPTIONS.map(({ view: option, label, icon: Icon }) => (
      <button
        key={option}
        type="button"
        aria-pressed={view === option}
        onClick={() => onChange(option)}
        className={cn(buttonClassName("quiet", "px-3"), view === option && "bg-accent-subtle text-accent hover:bg-accent-subtle hover:text-accent")}
      >
        <Icon aria-hidden="true" size={18} />
        {label}
      </button>
    ))}
  </div>
);

interface ExploreMapViewProps {
  readonly accessToken: string;
  readonly points: readonly MapPoint[];
  readonly homeArea: GeoPoint | null;
  readonly isLoading: boolean;
}

export const ExploreMapView = ({ accessToken, points, homeArea, isLoading }: ExploreMapViewProps): ReactElement => (
  <section aria-labelledby="explore-map-title" className="flex flex-col gap-4">
    <div className="flex flex-col gap-1">
      <h2 id="explore-map-title" className="text-xl font-semibold text-fg">
        Organizations with matching shifts
      </h2>
      <p className="max-w-[60ch] text-sm text-fg-muted">
        Markers show each organization's general area (about 5 km), not an exact address.
        {homeArea ? " The map starts at your ZIP area." : null}
      </p>
    </div>
    <Suspense fallback={<LoadingState label="Loading the map" />}>
      <OrgMap accessToken={accessToken} points={points} homeArea={homeArea} />
    </Suspense>
    {isLoading ? <LoadingState label="Loading organizations" /> : null}
    {!isLoading && points.length === 0 ? <p className="text-fg-muted">No organizations with matching shifts have a location yet.</p> : null}
    {points.length > 0 ? (
      <ul aria-label="Organizations on the map" className="divide-y divide-border">
        {points.map((point) => (
          <li key={point.orgId} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <Link to={`/organizations/${encodeURIComponent(point.orgId)}`} className="font-semibold text-fg underline-offset-4 hover:text-accent hover:underline">
              {point.name}
            </Link>
            <span className="text-sm text-fg-muted">{shiftCountText(point.shiftCount)} in this list</span>
          </li>
        ))}
      </ul>
    ) : null}
  </section>
);
