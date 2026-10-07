/**
 * FeaturedCollections.tsx
 * The "Collections" section on Explore (SPEC 9.2 + Tier 2 curated
 * collections): published collections, newest first, as an editorial
 * numbered list. Each entry links to /collections/:id and says who curated
 * it and what is inside. Renders nothing while loading, on error, or when
 * no collection is published, so Explore's primary path is never blocked.
 */
import { useMemo, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "@phosphor-icons/react";
import { usePublishedCollections } from "@/hooks/useCuration";
import { collectionCountText } from "@/lib/collectionItems";
import { getOrganizations } from "@/lib/data/orgs";
import { curatorName } from "./curatorName";

/** Explore shows at most this many; each card links to the full page. */
const SHOWN = 6;

export const collectionPathFor = (collectionId: string): string => `/collections/${encodeURIComponent(collectionId)}`;

export const FeaturedCollections = (): ReactElement | null => {
  const collections = usePublishedCollections();
  const orgs = useQuery({ queryKey: ["organizations"], queryFn: getOrganizations, staleTime: 60_000 });
  const orgNames = useMemo(() => new Map((orgs.data ?? []).map((org) => [org.id, org.name])), [orgs.data]);
  const shown = (collections.data ?? []).slice(0, SHOWN);
  if (shown.length === 0) return null;

  return (
    <section aria-labelledby="collections-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="collections-title" className="text-xl font-semibold text-fg">
          Collections
        </h2>
        <p className="text-sm text-fg-muted">Shifts and organizations picked by local coordinators.</p>
      </div>
      <ol className="grid grid-cols-1 border-t border-border sm:grid-cols-2">
        {shown.map((item, index) => (
          <li key={item.id} className="group relative flex min-w-0 flex-col gap-2 border-b border-border py-5 sm:pr-6 sm:even:border-l sm:even:pl-6">
            <span aria-hidden="true" className="font-mono text-xs text-editorial-accent">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="font-display text-xl font-semibold text-fg">
              {/* The stretched link makes the whole card clickable while keeping one accessible name. */}
              <Link to={collectionPathFor(item.id)} className="underline-offset-4 after:absolute after:inset-0 hover:text-accent hover:underline focus-visible:underline">
                {item.title}
              </Link>
            </h3>
            {item.description ? <p className="line-clamp-2 text-sm text-fg-muted">{item.description}</p> : null}
            <p className="mt-auto flex items-center justify-between gap-2 pt-1 text-sm text-fg-muted">
              <span>
                {collectionCountText(item.items)} · by {curatorName(item.orgId, orgNames)}
              </span>
              <ArrowRight aria-hidden="true" size={16} className="shrink-0 text-accent transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" />
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
};
