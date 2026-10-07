/**
 * collectionItems.ts
 * Turns a curated collection's items ({kind, refId}, SPEC 3.19) into rows a
 * screen can show, from data the page already has: the active opportunity
 * catalog, the organizations, and upcoming shifts. Pure, so the collection
 * page, the editor preview, and tests share one mapping.
 *
 *   opportunity  title, org, cause, and a link to its next upcoming shift
 *                (opportunity pages are per shift); "No upcoming shifts right
 *                now" when none is scheduled
 *   org          name, mission, and a link to the public org page
 *
 * An item whose target is gone (archived opportunity, deleted org) is kept
 * as a "no longer listed" row so curators notice it, and never linked.
 */
import type { CollectionItem } from "@fbla/shared";
import type { Instance } from "@/lib/data/instances";
import type { Opportunity } from "@/lib/data/opportunities";
import type { Organization } from "@/lib/data/orgs";

export interface CollectionRow {
  readonly key: string;
  readonly kind: CollectionItem["kind"];
  readonly title: string;
  readonly detail: string | null;
  /** In-app path, or null when the target is no longer listed. */
  readonly href: string | null;
  readonly orgId: string | null;
  readonly orgName: string | null;
  /** False only for a listed but unverified organization (shows the D23 chip). */
  readonly verified: boolean;
  /** Next shift start (epoch ms) and zone for opportunities with one scheduled. */
  readonly next: { readonly instanceId: string; readonly startMs: number; readonly timeZone: string } | null;
  readonly missing: boolean;
}

export interface CollectionSources {
  readonly opportunities: readonly Opportunity[];
  readonly orgs: readonly Organization[];
  readonly instances: readonly Instance[];
  readonly nowMs: number;
}

export const MISSING_OPPORTUNITY = "A shift that is no longer listed";
export const MISSING_ORG = "An organization that is no longer listed";

const nextShift = (instances: readonly Instance[], opportunityId: string, nowMs: number): Instance | null =>
  instances
    .filter((instance) => instance.opportunityId === opportunityId && instance.status === "scheduled" && instance.start.toMillis() > nowMs)
    .reduce<Instance | null>((best, instance) => (best === null || instance.start.toMillis() < best.start.toMillis() ? instance : best), null);

const opportunityRow = (item: CollectionItem, sources: CollectionSources): CollectionRow => {
  const opportunity = sources.opportunities.find((candidate) => candidate.id === item.refId);
  const key = `${item.kind}_${item.refId}`;
  if (!opportunity) {
    return { key, kind: item.kind, title: MISSING_OPPORTUNITY, detail: null, href: null, orgId: null, orgName: null, verified: true, next: null, missing: true };
  }
  const next = nextShift(sources.instances, opportunity.id, sources.nowMs);
  return {
    key,
    kind: item.kind,
    title: opportunity.title,
    detail: opportunity.description.length > 0 ? opportunity.description : null,
    href: next ? `/opportunity/${encodeURIComponent(next.id)}` : null,
    orgId: opportunity.orgId,
    orgName: opportunity.orgName,
    verified: opportunity.orgVerified,
    next: next ? { instanceId: next.id, startMs: next.start.toMillis(), timeZone: next.timeZone } : null,
    missing: false
  };
};

const orgRow = (item: CollectionItem, sources: CollectionSources): CollectionRow => {
  const org = sources.orgs.find((candidate) => candidate.id === item.refId && !candidate.archived);
  const key = `${item.kind}_${item.refId}`;
  if (!org) return { key, kind: item.kind, title: MISSING_ORG, detail: null, href: null, orgId: null, orgName: null, verified: true, next: null, missing: true };
  return {
    key,
    kind: item.kind,
    title: org.name,
    detail: org.mission,
    href: `/organizations/${encodeURIComponent(org.id)}`,
    orgId: org.id,
    orgName: org.name,
    verified: org.verified,
    next: null,
    missing: false
  };
};

export const resolveCollectionItems = (items: readonly CollectionItem[], sources: CollectionSources): CollectionRow[] =>
  items.map((item) => (item.kind === "opportunity" ? opportunityRow(item, sources) : orgRow(item, sources)));

/** "3 shifts and 1 organization", for cards and screen readers. */
export const collectionCountText = (items: readonly CollectionItem[]): string => {
  const shifts = items.filter((item) => item.kind === "opportunity").length;
  const orgs = items.length - shifts;
  const part = (count: number, noun: string): string | null => (count === 0 ? null : `${count} ${noun}${count === 1 ? "" : "s"}`);
  const parts = [part(shifts, "shift"), part(orgs, "organization")].filter((value): value is string => value !== null);
  return parts.length === 0 ? "Empty" : parts.join(" and ");
};
