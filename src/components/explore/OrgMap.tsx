/**
 * OrgMap.tsx
 * The Mapbox canvas behind Explore's optional map view (PORT_LEDGER:
 * BusinessMap.tsx rewritten). Loaded lazily with its own chunk, only after
 * the visitor picks "Map", so the library, its styles, and Mapbox's own
 * browser storage never load for anyone who stays on the list.
 *
 *   markers   one button per organization at its coarse (about 5 km) area;
 *             activating it opens the organization page in the app
 *   center    the viewer's own ZIP area when signed in (no marker is drawn
 *             for it), else the bounds of the markers
 *   motion    camera moves jump instead of fly under reduced motion
 *   gestures  cooperative: one finger / plain wheel scrolls the page
 *
 * The canvas is supplemental. ExploreMapView renders the same organizations
 * as a plain list of links next to it for keyboard and screen reader users.
 */
import { useEffect, useRef, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { shiftCountText, type MapPoint } from "@/lib/explore/mapPoints";
import type { GeoPoint } from "@/lib/search";

const MAP_STYLE = "mapbox://styles/mapbox/light-v11";
/** Neutral overview when neither a home area nor organization markers are available. */
const FALLBACK_CENTER: GeoPoint = { lat: 39.8283, lng: -98.5795 };
const OVERVIEW_ZOOM = 3;
const HOME_ZOOM = 10;
const SINGLE_MARKER_ZOOM = 11;
const BOUNDS_PADDING_PX = 48;

interface OrgMapProps {
  readonly accessToken: string;
  readonly points: readonly MapPoint[];
  /** The signed-in viewer's own coarse ZIP area; used only to center the camera. */
  readonly homeArea: GeoPoint | null;
}

const markerClassName =
  "inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border-2 border-surface bg-accent px-2 text-xs font-semibold text-accent-fg shadow-md hover:bg-accent-hover";

const OrgMap = ({ accessToken, points, homeArea }: OrgMapProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const reduceMotion = useReducedMotionPreference();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const map = new mapboxgl.Map({
      container,
      accessToken,
      style: MAP_STYLE,
      center: [(homeArea ?? FALLBACK_CENTER).lng, (homeArea ?? FALLBACK_CENTER).lat],
      zoom: homeArea || points.length > 0 ? HOME_ZOOM : OVERVIEW_ZOOM,
      cooperativeGestures: true
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    const markers = points.map((point) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = markerClassName;
      element.textContent = String(point.shiftCount);
      element.setAttribute("aria-label", `${point.name}, ${shiftCountText(point.shiftCount)}. Open organization`);
      element.addEventListener("click", () => navigate(`/organizations/${encodeURIComponent(point.orgId)}`));
      return new mapboxgl.Marker({ element }).setLngLat([point.lng, point.lat]).addTo(map);
    });

    // Without a home area, frame every marker.
    if (homeArea === null && points.length > 0) {
      const bounds = points.reduce((box, point) => box.extend([point.lng, point.lat]), new mapboxgl.LngLatBounds());
      map.fitBounds(bounds, { padding: BOUNDS_PADDING_PX, maxZoom: SINGLE_MARKER_ZOOM, animate: !reduceMotion });
    }

    return () => {
      markers.forEach((marker) => marker.remove());
      map.remove();
    };
  }, [accessToken, points, homeArea, navigate, reduceMotion]);

  return <div ref={containerRef} className="h-[60vh] min-h-80 w-full overflow-hidden rounded-lg border border-border bg-surface-sunken" />;
};

export default OrgMap;
