/**
 * OrgReviews.tsx
 * The "Reviews" section of the public organization page (SPEC 9.2, Tier 2):
 * the aggregate, a form for a volunteer who finished a shift here and has
 * not reviewed this org yet, and the reviews newest first.
 *
 * Who may write is decided by the rules (completed signup of the author at
 * this org, doc id = signup id). The page offers the form once per
 * volunteer per org: it reviews their most recent completed shift here and
 * hides once they have any review of this org, so the aggregate reflects
 * people rather than shift counts. Reviews show the public name (first name
 * + last initial) or "A volunteer" (SPEC 4.2); text renders as plain text.
 */
import { useMemo, useState, type ReactElement } from "react";
import { Link, useLocation } from "react-router-dom";
import { formatShiftTime, reviewableSignups, summarizeReviews } from "@fbla/shared";
import { useOrgReviews } from "@/hooks/useCuration";
import { useMyPublicUser } from "@/hooks/useInbox";
import { useMyMemberships } from "@/hooks/useMemberships";
import { useMySignups } from "@/hooks/useVolunteerData";
import { useSessionUser } from "@/store/authStore";
import { ReviewForm } from "./ReviewForm";
import { ReviewItem, type ReviewViewer } from "./ReviewItem";
import { ReviewSummary } from "./ReviewSummary";

interface OrgReviewsProps {
  readonly orgId: string;
  readonly orgName: string;
  readonly timeZone: string;
}

/** The form for the signed-in volunteer, when they attended a shift here and have not reviewed this org. */
const WriteReview = ({ orgId, timeZone, reviewedByMe }: { orgId: string; timeZone: string; reviewedByMe: boolean }): ReactElement | null => {
  const user = useSessionUser();
  const uid = user?.uid ?? null;
  const signups = useMySignups(uid);
  const publicUser = useMyPublicUser(uid);
  const [posted, setPosted] = useState<string | null>(null);
  const location = useLocation();

  if (posted) return <p role="status" className="font-medium text-fg">{posted}</p>;
  if (uid === null) {
    return (
      <p className="text-fg-muted">
        <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className="font-semibold text-accent underline underline-offset-2">
          Sign in
        </Link>{" "}
        to review a shift you finished here.
      </p>
    );
  }
  if (reviewedByMe || signups.isLoading || publicUser.isLoading) return null;
  const candidate = reviewableSignups(signups.data ?? [], orgId, new Set()).sort((a, b) => b.instanceStart.toMillis() - a.instanceStart.toMillis())[0];
  const publicName = publicUser.data?.displayName;
  if (!candidate || !publicName) return null;

  return (
    <section aria-labelledby="write-review-title" className="flex flex-col gap-3">
      <h3 id="write-review-title" className="text-lg font-semibold text-fg">
        Review your shift
      </h3>
      <ReviewForm
        target={{ mode: "create", signupId: candidate.id, orgId, uid, publicName, shiftLabel: formatShiftTime(candidate.instanceStart.toDate(), timeZone) }}
        onDone={setPosted}
      />
    </section>
  );
};

export const OrgReviews = ({ orgId, orgName, timeZone }: OrgReviewsProps): ReactElement => {
  const user = useSessionUser();
  const reviews = useOrgReviews(orgId);
  const memberships = useMyMemberships(user?.uid ?? null);
  const list = reviews.data ?? [];
  const summary = useMemo(() => summarizeReviews(list), [list]);
  const viewer: ReviewViewer = {
    uid: user?.uid ?? null,
    isCoordinator: (memberships.data ?? []).some((membership) => membership.orgId === orgId),
    isAdmin: user?.isAdmin ?? false
  };
  const reviewedByMe = viewer.uid !== null && list.some((review) => review.uid === viewer.uid);

  return (
    <section aria-labelledby="org-reviews" className="flex flex-col gap-5">
      <h2 id="org-reviews" className="border-b border-border-strong pb-2 text-xl font-semibold text-fg">
        Reviews
      </h2>
      {reviews.error ? <p className="text-fg-muted">We couldn't load reviews. Reload to try again.</p> : null}
      {!reviews.error && !reviews.isLoading ? <ReviewSummary summary={summary} /> : null}
      <WriteReview orgId={orgId} timeZone={timeZone} reviewedByMe={reviewedByMe} />
      {list.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {list.map((review) => (
            <li key={review.id} className="py-4">
              <ReviewItem review={review} orgName={orgName} timeZone={timeZone} viewer={viewer} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
