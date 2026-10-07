/**
 * OrganizationPage.tsx
 * Route "/organizations/:orgId" (SPEC#screen-inventory "Organization", Tier 1):
 * trust the org. Public, like Explore. Above the fold, in SPEC order: name
 * with the verification chip (Verified, or the D23 Unverified chip with its
 * explanation), the mission, then upcoming shifts; the primary action opens
 * the next shift, and Save is the secondary action (signed in only). Reviews
 * (Tier 2 lane B) follow About: the aggregate and the public list. An organization with nothing scheduled shows the D6 empty
 * line "No upcoming shifts right now." with Save. The org document and its
 * shifts are public reads (SPEC 4.3); shifts update live.
 * Tier 2 lane C: the page sets its title, description, and schema.org
 * Organization JSON-LD (SPEC 1.2 Tier 3 SEO).
 */
import type { ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatShiftTime } from "@fbla/shared";
import { Globe, MapPin } from "@phosphor-icons/react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { SaveToggle } from "@/components/shifts/SaveToggle";
import { opportunityPathFor, seatsText } from "@/components/shifts/ShiftRow";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UnverifiedChip } from "@/components/ui/UnverifiedChip";
import { useNow } from "@/hooks/useNow";
import { useOrgInstances } from "@/hooks/useShiftData";
import { CAUSE_AREA_LABELS } from "@/lib/causeAreas";
import { getOrganization } from "@/lib/data/orgs";
import { seatsLeft } from "@/lib/signupButtonState";
// Tier 2 lane C
import { usePageHead, type PageHeadOverride } from "@/components/seo/pageHead";
import { resolveBaseUrl } from "@/lib/seo/head";
import { buildOrganizationJsonLd } from "@/lib/seo/orgJsonLd";
import type { Organization } from "@/lib/data/orgs";

/** Head tags for a loaded organization (title, mission, Organization JSON-LD). */
const orgPageHead = (org: Organization): PageHeadOverride => {
  const pageUrl = `${resolveBaseUrl(import.meta.env.APP_BASE_URL, window.location.origin)}/organizations/${encodeURIComponent(org.id)}`;
  return {
    title: org.name,
    description: org.mission,
    jsonLd: buildOrganizationJsonLd({ ...org, causeLabels: org.causeAreas.map((cause) => CAUSE_AREA_LABELS[cause]) }, pageUrl)
  };
};
// Tier 2 lane B
import { OrgReviews } from "@/components/reviews/OrgReviews";

/** Enough to scan a month of a busy org; Explore has the full list. */
const UPCOMING_SHOWN = 10;

const NotFound = (): ReactElement => (
  <section className="flex max-w-xl flex-col items-start gap-3">
    <PageHeader title="Organization not found">This organization may have been removed, or the link is incomplete.</PageHeader>
    <Link to="/explore" className={buttonClassName("primary")}>
      Find shifts
    </Link>
  </section>
);

/** Only http(s) links render, so a stored value can never become a script URL. */
const safeWebsite = (url: string | null): string | null => {
  if (!url) return null;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
};

const OrganizationPage = (): ReactElement => {
  const { orgId = "" } = useParams();
  const nowMs = useNow(60_000);
  const org = useQuery({ queryKey: ["organization", orgId], queryFn: () => getOrganization(orgId), staleTime: 60_000, enabled: orgId !== "" });
  const shifts = useOrgInstances(orgId === "" ? null : orgId);
  usePageHead(org.data ? orgPageHead(org.data) : null); // Tier 2 lane C

  if (org.isError) return <ErrorState title="We couldn't load this organization" description="Check your connection, then reload the page." />;
  if (org.isPending) return <LoadingState label="Loading the organization" />;
  if (org.data === null) return <NotFound />;
  const data = org.data;
  const upcoming = (shifts.data ?? []).filter((shift) => shift.status === "scheduled" && shift.start.toMillis() > nowMs).slice(0, UPCOMING_SHOWN);
  const next = upcoming[0];
  const website = safeWebsite(data.website);

  return (
    <article className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <PageHeader title={data.name} />
        <div className="flex flex-wrap items-center gap-3">
          {data.verified ? <StatusBadge tone="success" label="Verified organization" /> : <UnverifiedChip />}
          <SaveToggle kind="org" refId={orgId} label={data.name} />
        </div>
        <p className="max-w-[65ch] text-lg text-fg">{data.mission}</p>
        {data.archived ? <p className="text-fg-muted">This organization is no longer posting shifts.</p> : null}
        {next ? (
          <Link to={opportunityPathFor(next.id)} className={buttonClassName("primary", "w-fit")}>
            Open next shift: {next.title}
          </Link>
        ) : null}
      </div>

      <section aria-labelledby="org-upcoming" className="flex flex-col gap-3">
        <h2 id="org-upcoming" className="border-b border-border-strong pb-2 text-xl font-semibold text-fg">
          Upcoming shifts
        </h2>
        {shifts.error ? <p className="text-fg-muted">We couldn't load the shifts. Reload to try again.</p> : null}
        {!shifts.error && !shifts.isLoading && upcoming.length === 0 ? <p className="text-fg-muted">No upcoming shifts right now.</p> : null}
        {upcoming.length > 0 ? (
          <ul className="divide-y divide-border">
            {upcoming.map((shift) => (
              <li key={shift.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <Link to={opportunityPathFor(shift.id)} className="font-semibold text-fg underline-offset-4 hover:text-accent hover:underline focus-visible:underline">
                  {shift.title}
                </Link>
                <p className="flex flex-wrap gap-x-4 text-sm text-fg-muted">
                  <span className="font-mono text-fg">{formatShiftTime(shift.start.toDate(), shift.timeZone)}</span>
                  <span>{seatsText(seatsLeft(shift.capacity, shift.signupCount))}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="org-about" className="flex flex-col gap-3">
        <h2 id="org-about" className="text-xl font-semibold text-fg">
          About
        </h2>
        <ul className="flex flex-wrap gap-2" aria-label="Causes">
          {data.causeAreas.map((cause) => (
            <li key={cause} className="rounded-full bg-surface-sunken px-3 py-1 text-sm text-fg">
              {CAUSE_AREA_LABELS[cause]}
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 text-fg">
          <MapPin aria-hidden="true" size={18} />
          {`${data.address.line1}, ${data.address.city}, ${data.address.state} ${data.address.zip}`}
        </p>
        {website ? (
          <p className="flex items-center gap-2">
            <Globe aria-hidden="true" size={18} />
            <a href={website} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline underline-offset-2">
              Website
            </a>
          </p>
        ) : null}
        {data.verified ? null : <p className="max-w-[65ch] text-sm text-fg-muted">Volunteers under 18 can join this organization's shifts after it is verified.</p>}
      </section>

      {/* Tier 2 lane B: org experience reviews (SPEC 3.20) */}
      <OrgReviews orgId={orgId} orgName={data.name} timeZone={data.timeZone} />
    </article>
  );
};

export default OrganizationPage;
