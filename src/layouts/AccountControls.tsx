/** Account actions in the header disclosure. Keep every destination labelled. */
import { useState, type ReactElement } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BookmarkSimple, Buildings, GearSix, ShieldCheck, SignIn, SignOut, UserCircle } from "@phosphor-icons/react";
import { useMyMemberships } from "@/hooks/useMemberships";
import { signOutUser } from "@/lib/authClient";
import { cn } from "@/lib/cn";
import { useSessionUser, useSession } from "@/store/authStore";

const menuLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn("account-menu__item", isActive && "is-active");

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
      <NavLink to="/login" className="account-sign-in">
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
    <nav aria-label="Account" className="account-menu__list">
      <NavLink to="/me/profile" className={menuLinkClass}>
        <UserCircle aria-hidden="true" size={20} />
        <span>Profile</span>
      </NavLink>
      <NavLink to="/me/saved" className={menuLinkClass}>
        <BookmarkSimple aria-hidden="true" size={20} />
        <span>Saved</span>
      </NavLink>
      <NavLink to="/settings" className={menuLinkClass}>
        <GearSix aria-hidden="true" size={20} />
        <span>Settings</span>
      </NavLink>
      {firstOrg ? (
        <NavLink to={`/org/${firstOrg.orgId}/dashboard`} className={menuLinkClass}>
          <Buildings aria-hidden="true" size={20} />
          <span>Coordinator</span>
        </NavLink>
      ) : memberships.isSuccess ? (
        <NavLink to="/org/register" className={menuLinkClass}>
          <Buildings aria-hidden="true" size={20} />
          <span>For nonprofits</span>
        </NavLink>
      ) : null}
      {user.isAdmin ? (
        <NavLink to="/admin" className={menuLinkClass}>
          <ShieldCheck aria-hidden="true" size={20} />
          <span>Admin</span>
        </NavLink>
      ) : null}
      <button type="button" onClick={() => void signOut()} disabled={isSigningOut} className="account-menu__item">
        <SignOut aria-hidden="true" size={20} />
        <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
      </button>
      {signOutError ? <p role="alert" className="account-menu__error">{signOutError}</p> : null}
    </nav>
  );
};
