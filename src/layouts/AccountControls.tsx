/**
 * AccountControls.tsx
 * Right side of the header (SPEC#screen-nav D2): role links and the account
 * action. Tier 1 adds the notification badge, Saved, and Profile; Tier 2
 * turns the badge into the bell menu (SPEC 8.3). Shows "Coordinator" only when the person has at least one
 * organization membership, "Admin" only with the admin claim, then Sign in
 * or Sign out. Sign-out returns to Explore and clears cached personal data.
 */
import { useState, type ReactElement } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BookmarkSimple, Buildings, ShieldCheck, SignIn, SignOut, UserCircle } from "@phosphor-icons/react";
import { BellMenu } from "@/components/notifications/BellMenu"; // Tier 2 lane C
import { useMyMemberships } from "@/hooks/useMemberships";
import { signOutUser } from "@/lib/authClient";
import { cn } from "@/lib/cn";
import { useSessionUser, useSession } from "@/store/authStore";

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    "inline-flex min-h-touch items-center gap-2 rounded-md px-2 text-sm font-medium whitespace-nowrap transition-colors duration-(--duration-fast) sm:px-3",
    isActive ? "bg-accent-subtle text-accent" : "text-fg-muted hover:bg-surface-sunken hover:text-fg"
  );

export const AccountControls = (): ReactElement | null => {
  const session = useSession();
  const user = useSessionUser();
  const memberships = useMyMemberships(user?.uid ?? null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  if (session.status === "loading" || session.status === "kiosk") return null;

  if (!user) {
    return (
      <NavLink to="/login" className={linkClass}>
        <SignIn aria-hidden="true" size={18} />
        Sign in
      </NavLink>
    );
  }

  const firstOrg = memberships.data?.[0];
  const signOut = async (): Promise<void> => {
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      await signOutUser();
      queryClient.clear();
      navigate("/", { replace: true });
    } catch {
      setSignOutError("Sign-out failed. Try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Tier 2 lane C: the bell menu (latest alerts, Mark all read) replaces the Tier 1 badge link. */}
      <BellMenu uid={user.uid} />
      {/* Tier 1 lane A: saved items. */}
      <NavLink to="/me/saved" className={linkClass} title="Saved shifts and organizations">
        <BookmarkSimple aria-hidden="true" size={18} />
        <span className="sr-only 2xl:not-sr-only">Saved</span>
      </NavLink>
      {/* Below md the header is full at 150% text on a phone; the footer carries Profile there (AppLayout). */}
      <NavLink to="/me/profile" className={(state) => cn(linkClass(state), "hidden md:inline-flex")} title="Profile and settings">
        <UserCircle aria-hidden="true" size={18} />
        <span className="sr-only 2xl:not-sr-only">Profile</span>
      </NavLink>
      {firstOrg ? (
        <NavLink to={`/org/${firstOrg.orgId}/dashboard`} className={linkClass} title="Coordinator dashboard">
          <Buildings aria-hidden="true" size={18} />
          <span className="sr-only xl:not-sr-only">Coordinator</span>
        </NavLink>
      ) : null}
      {/* Tier 1 lane B: registration and invite join are reachable before any membership.
          Below md the header is too narrow at 150% text, so the footer carries this link instead. */}
      {!firstOrg && memberships.isSuccess ? (
        <NavLink to="/org/register" className={(state) => cn(linkClass(state), "hidden md:inline-flex")}>
          <Buildings aria-hidden="true" size={18} />
          <span className="sr-only 2xl:not-sr-only">For organizations</span>
        </NavLink>
      ) : null}
      {/* End Tier 1 lane B */}
      {user.isAdmin ? (
        <NavLink to="/admin" className={linkClass} title="Admin">
          <ShieldCheck aria-hidden="true" size={18} />
          <span className="sr-only 2xl:not-sr-only">Admin</span>
        </NavLink>
      ) : null}
      <button type="button" onClick={() => void signOut()} disabled={isSigningOut} title="Sign out" className={linkClass({ isActive: false })}>
        <SignOut aria-hidden="true" size={18} />
        <span className="sr-only xl:not-sr-only">{isSigningOut ? "Signing out..." : "Sign out"}</span>
      </button>
      {signOutError ? (
        <span role="alert" className="text-sm text-status-danger">
          {signOutError}
        </span>
      ) : null}
    </div>
  );
};
