/**
 * AccountControls.tsx
 * Right side of the header (SPEC#screen-nav D2): role links and the account
 * action. Shows "Coordinator" only when the person has at least one
 * organization membership, "Admin" only with the admin claim, then Sign in
 * or Sign out. Sign-out returns to Explore and clears cached personal data.
 */
import { useState, type ReactElement } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Buildings, ShieldCheck, SignIn, SignOut } from "@phosphor-icons/react";
import { useMyMemberships } from "@/hooks/useMemberships";
import { signOutUser } from "@/lib/authClient";
import { cn } from "@/lib/cn";
import { useSessionUser, useSession } from "@/store/authStore";

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    "inline-flex min-h-touch items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-(--duration-fast)",
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
      {firstOrg ? (
        <NavLink to={`/org/${firstOrg.orgId}/dashboard`} className={linkClass}>
          <Buildings aria-hidden="true" size={18} />
          <span className="hidden sm:inline">Coordinator</span>
          <span className="sr-only sm:hidden">Coordinator dashboard</span>
        </NavLink>
      ) : null}
      {user.isAdmin ? (
        <NavLink to="/admin" className={linkClass}>
          <ShieldCheck aria-hidden="true" size={18} />
          <span className="hidden sm:inline">Admin</span>
          <span className="sr-only sm:hidden">Admin</span>
        </NavLink>
      ) : null}
      <button type="button" onClick={() => void signOut()} disabled={isSigningOut} className={linkClass({ isActive: false })}>
        <SignOut aria-hidden="true" size={18} />
        <span className="hidden sm:inline">{isSigningOut ? "Signing out..." : "Sign out"}</span>
        <span className="sr-only sm:hidden">Sign out</span>
      </button>
      {signOutError ? (
        <span role="alert" className="text-sm text-status-danger">
          {signOutError}
        </span>
      ) : null}
    </div>
  );
};
