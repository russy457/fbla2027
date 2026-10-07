/**
 * CollectionManager.tsx
 * The list-and-edit surface for curated collections (SPEC 3.19, Tier 2),
 * used by coordinators on /org/:orgId/collections (orgId = their org) and by
 * admins on /admin (orgId null, app-wide picks). Lists the owner's
 * collections with Published or Draft, then View, Edit, and Delete; "New
 * collection" opens the editor with a fresh id kept for retries.
 *
 * Picks come from the public catalog: active opportunities (the org's own
 * first) and organizations. Volunteers never reach this (route guards and
 * rules: collections are coordinator/admin-authored only, gate UC1).
 */
import { useMemo, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "@phosphor-icons/react";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useClientWrite } from "@/hooks/useClientWrite";
import { useOwnedCollections } from "@/hooks/useCuration";
import { useActiveOpportunities } from "@/hooks/useInbox";
import { collectionCountText } from "@/lib/collectionItems";
import { deleteCollection, newCollectionId, type CuratedCollection } from "@/lib/data/curatedCollections";
import { getOrganizations } from "@/lib/data/orgs";
import { useSessionUser } from "@/store/authStore";
import { CollectionEditor, EMPTY_COLLECTION, type CollectionChoice } from "./CollectionEditor";
import { collectionPathFor } from "./FeaturedCollections";
import { WriteFeedback } from "./WriteFeedback";

type Editing = { readonly id: string; readonly existing: CuratedCollection | null } | null;

interface CollectionManagerProps {
  /** The org whose collections these are, or null for admin collections. */
  readonly orgId: string | null;
  /** Id for the section's h2 (unique per page). */
  readonly headingId: string;
}

const useChoices = (orgId: string | null): CollectionChoice[] => {
  const opportunities = useActiveOpportunities();
  const orgs = useQuery({ queryKey: ["organizations"], queryFn: getOrganizations, staleTime: 60_000 });
  return useMemo(() => {
    const own = (candidate: string) => (candidate === orgId ? 0 : 1);
    const shifts = [...(opportunities.data ?? [])]
      .sort((a, b) => own(a.orgId) - own(b.orgId) || a.title.localeCompare(b.title))
      .map((item): CollectionChoice => ({ kind: "opportunity", refId: item.id, label: item.title, detail: item.orgName }));
    const organizations = (orgs.data ?? [])
      .filter((org) => !org.archived)
      .sort((a, b) => own(a.id) - own(b.id) || a.name.localeCompare(b.name))
      .map((org): CollectionChoice => ({ kind: "org", refId: org.id, label: org.name, detail: org.verified ? "Verified organization" : "Not verified yet" }));
    return [...shifts, ...organizations];
  }, [opportunities.data, orgs.data, orgId]);
};

export const CollectionManager = ({ orgId, headingId }: CollectionManagerProps): ReactElement => {
  const user = useSessionUser();
  const collections = useOwnedCollections(orgId, user !== null);
  const choices = useChoices(orgId);
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const removal = useClientWrite();
  const list = collections.data ?? [];

  const remove = async (item: CuratedCollection): Promise<void> => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setNotice(null);
    await removal.run(() => deleteCollection(item.id), `Deleted "${item.title}".`, "We couldn't delete this collection. Try again.");
  };

  if (editing !== null && user !== null) {
    const initial = editing.existing
      ? { title: editing.existing.title, description: editing.existing.description, items: editing.existing.items, published: editing.existing.published }
      : EMPTY_COLLECTION;
    return (
      <section aria-labelledby={headingId} className="flex flex-col gap-4">
        <h2 id={headingId} className="text-xl font-semibold text-fg">
          {editing.existing ? `Edit "${editing.existing.title}"` : "New collection"}
        </h2>
        <CollectionEditor
          collectionId={editing.id}
          orgId={orgId}
          authorUid={editing.existing?.authorUid ?? user.uid}
          initial={initial}
          choices={choices}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
          }}
          onCancel={() => setEditing(null)}
        />
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-xl font-semibold text-fg">
          {orgId === null ? "App-wide collections" : "Your collections"}
        </h2>
        <button type="button" onClick={() => setEditing({ id: newCollectionId(), existing: null })} className={buttonClassName("primary")}>
          <Plus aria-hidden="true" size={18} />
          New collection
        </button>
      </div>
      <p role="status" className="text-sm font-medium text-fg empty:hidden">
        {notice ?? ""}
      </p>
      <WriteFeedback message={removal.message} error={removal.error} />
      {collections.error ? <p className="text-fg-muted">We couldn't load collections. Reload to try again.</p> : null}
      {!collections.error && !collections.isLoading && list.length === 0 ? (
        <p className="max-w-[60ch] text-fg-muted">No collections yet. Group a few shifts or partner organizations, for example "Good first shifts", and publish it to Explore.</p>
      ) : null}
      {list.length > 0 ? (
        <ul className="divide-y divide-border border-y border-border">
          {list.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                  {item.title}
                  <StatusBadge tone={item.published ? "success" : "neutral"} label={item.published ? "Published" : "Draft"} />
                </p>
                <p className="text-sm text-fg-muted">{collectionCountText(item.items)}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Link to={collectionPathFor(item.id)} className={buttonClassName("quiet")} aria-label={`View ${item.title}`}>
                  View
                </Link>
                <button type="button" onClick={() => setEditing({ id: item.id, existing: item })} className={buttonClassName("secondary")} aria-label={`Edit ${item.title}`}>
                  Edit
                </button>
                <button type="button" disabled={removal.pending} onClick={() => void remove(item)} className={buttonClassName("quiet")} aria-label={`Delete ${item.title}`}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
