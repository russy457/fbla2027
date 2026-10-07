/**
 * LoginPage.tsx
 * Route "/login" (SPEC#screen-inventory: Login). Email and password, a link
 * to create an account (onboarding starts with the birth date, D10), and in
 * demo mode the "Sign in as..." switcher (X5). After sign-in it returns to
 * ?next= (same-app paths only) or Explore.
 */
import type { ReactElement } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { DemoRoleSwitcher } from "@/components/auth/DemoRoleSwitcher";
import { SignInForm } from "@/components/auth/SignInForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { isDemoMode } from "@/lib/demoMode";
import { getFirebase } from "@/lib/firebase";
import { safeNextPath } from "@/lib/safeRedirect";
import { useSession } from "@/store/authStore";

const showDemoSwitcher = (): boolean => {
  try {
    return isDemoMode() && getFirebase().usingEmulators;
  } catch {
    return false;
  }
};

const LoginPage = (): ReactElement => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();
  const next = safeNextPath(params.get("next"));

  if (session.status === "user") return <Navigate to={next} replace />;

  const goNext = (): void => navigate(next, { replace: true });

  return (
    <div className="flex max-w-5xl flex-col gap-10">
      <PageHeader title="Sign in">Sign in to sign up for shifts, check in, and get your hours verified.</PageHeader>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex max-w-md flex-col gap-6">
        <SignInForm onSignedIn={goNext} />
        <p className="text-sm text-fg-muted">
          New here?{" "}
          <Link to={`/onboarding?next=${encodeURIComponent(next)}`} className="font-semibold text-accent underline underline-offset-2">
            Create an account
          </Link>
        </p>
      </div>
      {showDemoSwitcher() ? <DemoRoleSwitcher onSignedIn={goNext} /> : null}
      </div>
    </div>
  );
};

export default LoginPage;
