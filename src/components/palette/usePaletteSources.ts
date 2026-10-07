/**
 * usePaletteSources.ts
 * Gathers what the command palette searches, scoped to the viewer's role:
 *   routes         role-based destinations (memberships come from the
 *                  cached query the header already runs)
 *   articlesFor    BM25 help search for a typed query; suggestions for the
 *                  current page when the query is empty
 *   orgs           public organizations, fetched only while the palette is
 *                  open and shared with Explore's ["organizations"] cache,
 *                  so a closed palette costs nothing
 */
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMyMemberships } from "@/hooks/useMemberships";
import { CAUSE_AREA_LABELS } from "@/lib/causeAreas";
import { getOrganizations } from "@/lib/data/orgs";
import type { HelpLibrary } from "@/lib/help";
import { routeCommandsFor, type PaletteArticle, type PaletteOrg } from "@/lib/palette/paletteCommands";
import { useSessionUser } from "@/store/authStore";
import type { PaletteSources } from "./CommandPalette";

const ORGS_STALE_MS = 60_000;

export const usePaletteSources = (isOpen: boolean, pathname: string, getLibrary: () => HelpLibrary): PaletteSources => {
  const user = useSessionUser();
  const memberships = useMyMemberships(user?.uid ?? null);
  const orgs = useQuery({ queryKey: ["organizations"], queryFn: getOrganizations, staleTime: ORGS_STALE_MS, enabled: isOpen });

  const routes = useMemo(
    () =>
      routeCommandsFor({
        signedIn: user !== null,
        isAdmin: user?.isAdmin ?? false,
        memberships: memberships.data ?? []
      }),
    [user, memberships.data]
  );

  const articlesFor = useCallback(
    (query: string): readonly PaletteArticle[] => {
      // The library parses and indexes the bundled articles on first use.
      const library = getLibrary();
      return query.trim() === "" ? library.suggestionsFor(pathname) : library.search(query).map((hit) => hit.article);
    },
    [getLibrary, pathname]
  );

  const paletteOrgs = useMemo(
    (): PaletteOrg[] =>
      (orgs.data ?? [])
        .filter((org) => !org.archived)
        .map((org) => ({ id: org.id, name: org.name, hint: org.causeAreas.map((area) => CAUSE_AREA_LABELS[area]).join(", ") })),
    [orgs.data]
  );

  return useMemo(() => ({ routes, articlesFor, orgs: paletteOrgs }), [routes, articlesFor, paletteOrgs]);
};
