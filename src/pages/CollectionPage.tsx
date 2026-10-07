/**
 * CollectionPage.tsx
 * Route "/collections/:collectionId" (SPEC 9.1, Tier 2): one curated
 * collection. Public, like Explore. Shows the title, who curated it (the org
 * or the app team, never a person), the description, and its shifts and
 * organizations with live next dates. A draft is readable only by the org's
 * coordinators and admins (rules); everyone else, and a missing id, sees
 * "Collection not found". A draft view says it is not public yet.
 */
import { useMemo, type ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CollectionRows } from "@/components/collections/CollectionRows";
import { curatorName } from "@/components/collections/curatorName";
import { LoadingState } from "@/components/LoadingState";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useCuratedCollection } from "@/hooks/useCuration";
import { useActiveOpportunities } from "@/hooks/useInbox";
import { useNow } from "@/hooks/useNow";
import { useUpcomingInstances } from "@/hooks/useShiftData";
import { resolveCollectionItems } from "@/lib/collectionItems";
import { getOrganizations } from "@/lib/data/orgs";

const NotFound = (): ReactElement => (
  <section className="flex max-w-xl flex-col items-start gap-3">
    <PageHeader title="Collection not found">This collection may have been removed or is not public yet.</PageHeader>
    <Link to="/explore" className={buttonClassName("primary")}>
      Find shifts
    </Link>
  </section>
);

const CollectionPage = (): ReactElement => {
  const { collectionId = "" } = useParams();
  const nowMs = useNow(60_000);
  const collection = useCuratedCollection(collectionId);
  const opportunities = useActiveOpportunities();
  const instances = useUpcomingInstances(nowMs);
  const orgs = useQuery({ queryKey: ["organizations"], queryFn: getOrganizations, staleTime: 60_000 });
  const orgNames = useMemo(() => new Map((orgs.data ?? []).map((org) => [org.id, org.name])), [orgs.data]);

  // A draft the caller may not read fails the listener with permission-denied: same as missing.
  if (collection.error || collectionId === "") return <NotFound />;
  if (collection.isLoading || opportunities.isLoading || orgs.isPending) return <LoadingState label="Loading the collection" />;
  const data = collection.data;
  if (!data) return <NotFound />;

  const rows = resolveCollectionItems(data.items, {
    opportunities: opportunities.data ?? [],
    orgs: orgs.data ?? [],
    instances: instances.data ?? [],
    nowMs
  });

  return (
    <article className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Collection</p>
        <PageHeader title={data.title}>{data.description || null}</PageHeader>
        <p className="flex flex-wrap items-center gap-3 text-sm text-fg-muted">
          <span>Curated by {curatorName(data.orgId, orgNames)}</span>
          {data.published ? null : <StatusBadge tone="warning" label="Draft: only your team can see this" />}
        </p>
      </div>
      <section aria-label="In this collection" className="flex flex-col">
        <CollectionRows rows={rows} />
      </section>
    </article>
  );
};

export default CollectionPage;
