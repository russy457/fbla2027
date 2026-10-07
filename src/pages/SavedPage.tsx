/**
 * SavedPage.tsx
 * Route "/me/saved" (SPEC#screen-inventory "Saved", Tier 1): saved shifts
 * (opportunities, each linking to its next upcoming date) and saved
 * organizations (linking to their public page, /organizations/:orgId), each
 * with Remove. Saved items are the person's own documents under the rules
 * (SPEC 3.18); names come from the public catalog.
 */
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatShiftTime } from "@fbla/shared";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { SaveToggle } from "@/components/shifts/SaveToggle";
import { OrgLink, organizationPathFor } from "@/components/ui/OrgLink";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { PageHeader } from "@/components/ui/PageHeader";
import { UnverifiedChip } from "@/components/ui/UnverifiedChip";
import { useActiveOpportunities, useSavedItems } from "@/hooks/useInbox";
import { useNow } from "@/hooks/useNow";
import { useUpcomingInstances } from "@/hooks/useShiftData";
import { getOrganizations } from "@/lib/data/orgs";
import { useSessionUser } from "@/store/authStore";

const SavedPage = (): ReactElement => {
  const user = useSessionUser();
  const nowMs = useNow(60_000);
  const saved = useSavedItems(user?.uid ?? null);
  const opportunities = useActiveOpportunities();
  const instances = useUpcomingInstances(nowMs);
  const orgs = useQuery({ queryKey: ["organizations"], queryFn: getOrganizations, staleTime: 60_000 });

  if (saved.error || opportunities.error || orgs.isError) return <ErrorState title="We couldn't load your saved items" description="Check your connection, then reload the page." />;
  if (saved.isLoading || opportunities.isLoading || orgs.isPending) return <LoadingState label="Loading your saved items" />;

  const items = saved.data ?? [];
  const byOpportunity = new Map((opportunities.data ?? []).map((opportunity) => [opportunity.id, opportunity]));
  const byOrg = new Map(orgs.data.map((org) => [org.id, org]));
  const nextDate = (opportunityId: string) =>
    (instances.data ?? []).find((instance) => instance.opportunityId === opportunityId && instance.status === "scheduled" && instance.start.toMillis() > nowMs);
  const savedShifts = items.filter((item) => item.kind === "opportunity");
  const savedOrgs = items.filter((item) => item.kind === "org");

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Saved">Shifts and organizations you saved, so you can come back to them.</PageHeader>
      {items.length === 0 ? (
        <section className="flex flex-col items-start gap-3">
          <p className="text-fg-muted">Nothing saved yet. Use Save on a shift to keep it here.</p>
          <Link to="/" className={buttonClassName("primary")}>
            Find shifts
          </Link>
        </section>
      ) : null}

      {savedShifts.length > 0 ? (
        <section aria-labelledby="saved-shifts" className="flex flex-col">
          <h2 id="saved-shifts" className="border-b border-border-strong pb-2 text-sm font-semibold text-fg-muted">
            Saved shifts
          </h2>
          <ul className="divide-y divide-border">
            {savedShifts.map((item) => {
              const opportunity = byOpportunity.get(item.refId);
              const next = nextDate(item.refId);
              const title = opportunity?.title ?? "A shift that is no longer listed";
              return (
                <li key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="font-semibold text-fg">{title}</p>
                    <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                      {opportunity ? <OrgLink orgId={opportunity.orgId} name={opportunity.orgName} /> : null}
                      {opportunity && !opportunity.orgVerified ? <UnverifiedChip /> : null}
                    </p>
                    {next ? (
                      <Link to={`/opportunity/${encodeURIComponent(next.id)}`} className="w-fit text-sm font-semibold text-accent underline underline-offset-2">
                        Next: {formatShiftTime(next.start.toDate(), next.timeZone)}
                      </Link>
                    ) : (
                      <p className="text-sm text-fg-muted">No upcoming shifts right now.</p>
                    )}
                  </div>
                  <SaveToggle kind="opportunity" refId={item.refId} label={title} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {savedOrgs.length > 0 ? (
        <section aria-labelledby="saved-orgs" className="flex flex-col">
          <h2 id="saved-orgs" className="border-b border-border-strong pb-2 text-sm font-semibold text-fg-muted">
            Saved organizations
          </h2>
          <ul className="divide-y divide-border">
            {savedOrgs.map((item) => {
              const org = byOrg.get(item.refId);
              const name = org?.name ?? "An organization that is no longer listed";
              return (
                <li key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                      {name}
                      {org && !org.verified ? <UnverifiedChip /> : null}
                    </p>
                    {org ? <p className="max-w-[60ch] text-sm text-fg-muted">{org.mission}</p> : null}
                    <Link to={organizationPathFor(item.refId)} className="w-fit text-sm font-semibold text-accent underline underline-offset-2">
                      See the organization and its shifts
                    </Link>
                  </div>
                  <SaveToggle kind="org" refId={item.refId} label={name} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

export default SavedPage;
