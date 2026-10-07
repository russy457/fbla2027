/**
 * DemoRoleSwitcher.tsx
 * "Sign in as..." buttons for the four seeded demo accounts (X5, SPEC#demo-accounts).
 * Rendered only in demo mode against the local emulators, where the fixed
 * demo password is the only one that works; it never appears on a build
 * that talks to a real project. Clearly labeled as a demo control.
 */
import { useState, type ReactElement } from "react";
import { UserSwitch } from "@phosphor-icons/react";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { AuthFormError, signInWithEmail } from "@/lib/authClient";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demoMode";

interface DemoRoleSwitcherProps {
  readonly onSignedIn: () => void;
}

export const DemoRoleSwitcher = ({ onSignedIn }: DemoRoleSwitcherProps): ReactElement => {
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signInAs = async (email: string): Promise<void> => {
    setPendingEmail(email);
    setError(null);
    try {
      await signInWithEmail(email, DEMO_PASSWORD);
      onSignedIn();
    } catch (signInError) {
      const message = signInError instanceof AuthFormError ? signInError.message : "Sign-in failed.";
      setError(message.startsWith("That email and password don't match") ? `${message} Is the demo seeded? Run npm run seed:demo.` : message);
    } finally {
      setPendingEmail(null);
    }
  };

  return (
    <section aria-labelledby="demo-switcher-title" className="flex flex-col gap-3 rounded-lg border border-dashed border-border-strong p-4">
      <h2 id="demo-switcher-title" className="flex items-center gap-2 text-sm font-semibold text-fg">
        <UserSwitch aria-hidden="true" size={18} />
        Demo control: sign in as...
      </h2>
      <p className="text-sm text-fg-muted">Local demo accounts only. These work on the emulators and nowhere else.</p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DEMO_ACCOUNTS.map((account) => (
          <li key={account.email}>
            <button
              type="button"
              disabled={pendingEmail !== null}
              onClick={() => void signInAs(account.email)}
              className={buttonClassName("secondary", "w-full justify-start")}
            >
              {pendingEmail === account.email ? "Signing in..." : account.role}
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm font-medium text-status-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
};
