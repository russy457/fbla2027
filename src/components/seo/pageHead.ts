/**
 * pageHead.ts
 * Lets a screen refine its route's default head tags with its own data (an
 * organization's name and mission, its JSON-LD). The override is stored with
 * the path it belongs to, so a stale override can never leak onto the next
 * screen; RouteHead merges it over the route defaults (src/lib/seo/routeMeta).
 *
 *   usePageHead(org ? { title: org.name, description: org.mission } : null);
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { create } from "zustand";

export interface PageHeadOverride {
  readonly title?: string;
  readonly description?: string;
  readonly ogType?: "website" | "article";
  readonly jsonLd?: Readonly<Record<string, unknown>> | null;
}

interface PageHeadState {
  readonly pathname: string | null;
  readonly override: PageHeadOverride | null;
  readonly setOverride: (pathname: string | null, override: PageHeadOverride | null) => void;
}

export const usePageHeadStore = create<PageHeadState>()((set) => ({
  pathname: null,
  override: null,
  setOverride: (pathname, override) => set({ pathname, override })
}));

/** Search engines cut descriptions near 160 characters; longer text is trimmed on a word. */
export const DESCRIPTION_MAX = 160;

export const clampDescription = (text: string): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= DESCRIPTION_MAX) return flat;
  const cut = flat.slice(0, DESCRIPTION_MAX - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,.;:]$/, "")}…`;
};

export const usePageHead = (override: PageHeadOverride | null): void => {
  const { pathname } = useLocation();
  const setOverride = usePageHeadStore((state) => state.setOverride);
  // Compared by content so a new object with the same values does not re-run the effect.
  const key = JSON.stringify(override);
  useEffect(() => {
    setOverride(pathname, override);
    return () => setOverride(null, null);
    // override is captured by content through key on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, key, setOverride]);
};
