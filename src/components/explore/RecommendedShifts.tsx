/**
 * RecommendedShifts.tsx
 * The "Recommended" row on Explore (SPEC 9.2) and the "3 shifts that match
 * you" step after onboarding (SPEC 9.9): up to three SpotlightCards (D15:
 * SpotlightCard is used only for recommended shift cards), each with the
 * shift, its time in the org zone, and a one-line why. The first card's
 * link is the screen's primary action ("Open the top recommended shift").
 * Without interests it shows the D6 empty state instead.
 */
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { Sparkle } from "@phosphor-icons/react";
import { formatShiftTime } from "@fbla/shared";
import SpotlightCard from "@/components/bits/SpotlightCard";
import { OrgLink } from "@/components/ui/OrgLink";
import { UnverifiedChip } from "@/components/ui/UnverifiedChip";
import type { Recommendation } from "@/lib/explore/recommendations";

interface RecommendedShiftsProps {
  readonly picks: readonly Recommendation[];
  readonly hasInterests: boolean;
  readonly title?: string;
  /** Heading level: h2 on Explore, h1 on the onboarding finish screen. */
  readonly headingLevel?: 1 | 2;
}

export const RecommendedShifts = ({ picks, hasInterests, title = "Recommended", headingLevel = 2 }: RecommendedShiftsProps): ReactElement | null => {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const headingClass = headingLevel === 1 ? "text-3xl font-semibold tracking-tight text-fg outline-none md:text-4xl" : "text-xl font-semibold text-fg";

  if (!hasInterests) {
    return (
      <section aria-labelledby="recommended-title" className="flex flex-col gap-2">
        <Heading id="recommended-title" tabIndex={headingLevel === 1 ? -1 : undefined} className={headingClass}>
          {title}
        </Heading>
        <p className="text-fg-muted">
          <Link to="/me/profile#interests" className="font-semibold text-accent underline underline-offset-2">
            Add interests
          </Link>{" "}
          to see shifts picked for you.
        </p>
      </section>
    );
  }
  if (picks.length === 0) return null;

  return (
    <section aria-labelledby="recommended-title" className="flex flex-col gap-3">
      <Heading id="recommended-title" tabIndex={headingLevel === 1 ? -1 : undefined} className={headingClass}>
        {title}
      </Heading>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {picks.map(({ row, why }) => (
          <li key={row.instance.id} className="min-w-0">
            <SpotlightCard className="h-full rounded-md bg-surface p-5">
              <div className="flex h-full flex-col gap-2">
                <p className="flex items-start gap-1.5 text-sm font-semibold text-accent">
                  <Sparkle aria-hidden="true" size={16} weight="fill" className="mt-0.5 shrink-0" />
                  {why}
                </p>
                <h3 className="text-lg font-semibold text-fg">
                  <Link to={`/opportunity/${encodeURIComponent(row.instance.id)}`} className="underline-offset-4 hover:text-accent hover:underline focus-visible:underline">
                    {row.instance.title}
                  </Link>
                </h3>
                <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                  <OrgLink orgId={row.instance.orgId} name={row.instance.orgName} />
                  {row.instance.orgVerified ? null : <UnverifiedChip />}
                </p>
                <p className="mt-auto font-mono text-sm text-fg">{formatShiftTime(row.instance.start.toDate(), row.instance.timeZone)}</p>
              </div>
            </SpotlightCard>
          </li>
        ))}
      </ul>
    </section>
  );
};
