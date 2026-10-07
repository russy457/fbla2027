/**
 * RouteGuards.tsx
 * Layout routes that protect screens by role (SPEC#screen-nav D2, G11):
 *   RequireSignedIn       a person is signed in (else /login?next=...)
 *   RequireProfile        signed in AND onboarding finished (else /onboarding)
 *   RequireCoordinator    member (owner or coordinator) of :orgId
 *   RequireAdmin          admin custom claim
 * A kiosk session on a person's screen is told to return to its kiosk, since
 * the kiosk token can do nothing else (G15). Guards render <Outlet /> when
 * access is allowed. The server still authorizes every op; guards only keep
 * people from landing on screens that cannot work for them.
 */
import type { ReactElement } from "react";
import { Link, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { useMembership } from "@/hooks/useMemberships";
import { usePrivateProfile } from "@/hooks/useVolunteerData";
import { useSession } from "@/store/authStore";

/** Where to come back to after signing in. Only same-app paths are kept. */
export const loginPathFor = (returnTo: string): string => `/login?next=${encodeURIComponent(returnTo)}`;

const KioskSessionNotice = ({ orgId, instanceId }: { orgId: string; instanceId: string }): ReactElement => (
  <section className="flex max-w-xl flex-col items-start gap-4">
    <h1 className="text-2xl font-semibold text-fg">This device is a check-in kiosk</h1>
    <p className="text-fg-muted">Kiosk mode can only show the check-in code. Go back to the kiosk screen to continue.</p>
    <Link to={`/org/${orgId}/kiosk/${instanceId}`} className={buttonClassName("primary")}>
      Return to the kiosk
    </Link>
  </section>
);

export const RequireSignedIn = (): ReactElement => {
  const session = useSession();
  const location = useLocation();
  if (session.status === "loading") return <LoadingState label="Checking your sign-in" />;
  if (session.status === "signed-out") return <Navigate to={loginPathFor(location.pathname + location.search)} replace />;
  if (session.status === "kiosk") return <KioskSessionNotice orgId={session.kiosk.orgId} instanceId={session.kiosk.instanceId} />;
  return <Outlet />;
};

/** Profile gate (G11): every volunteer and coordinator screen needs a finished profile. */
export const RequireProfile = (): ReactElement => {
  const session = useSession();
  const location = useLocation();
  const uid = session.status === "user" ? session.user.uid : null;
  const profile = usePrivateProfile(uid);

  if (session.status !== "user") return <RequireSignedIn />;
  if (profile.error) {
    return <ErrorState title="We couldn't load your profile" description="Check your connection, then reload the page." />;
  }
  if (profile.isLoading) return <LoadingState label="Loading your profile" />;
  if (profile.data?.profileComplete !== true) {
    return <Navigate to={`/onboarding?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <Outlet />;
};

export const RequireCoordinator = (): ReactElement => {
  const { orgId = "" } = useParams();
  const session = useSession();
  const uid = session.status === "user" ? session.user.uid : null;
  const membership = useMembership(orgId, uid);

  if (membership.isPending) return <LoadingState label="Checking your organization access" />;
  if (membership.isError) {
    return <ErrorState title="We couldn't check your access" description="Check your connection, then try again." onAction={() => void membership.refetch()} />;
  }
  if (!membership.data) {
    return (
      <ErrorState
        title="You don't have access to this organization"
        description="Only owners and coordinators of this organization can open its dashboard. Ask the organization owner for an invite."
      />
    );
  }
  return <Outlet />;
};

export const RequireAdmin = (): ReactElement => {
  const session = useSession();
  if (session.status === "user" && !session.user.isAdmin) {
    return <ErrorState title="Admins only" description="This page is for site admins. If you should have access, sign out and sign in again." />;
  }
  return <Outlet />;
};
