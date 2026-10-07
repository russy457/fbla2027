/**
 * AppLayout.tsx
 * The volunteer app shell (plan D2, D20): skip link, header with the product
 * name and desktop top nav, the routed page inside <main>, a footer with
 * display preferences, and a bottom tab bar on mobile. Landmarks (header,
 * nav, main, footer) are real elements so screen reader users can jump
 * between them. After each navigation, focus moves to the new screen's h1
 * (or <main> when the screen has none) so keyboard and screen reader users
 * start reading from the top (D20). The header also holds the Quick help
 * button that opens the help slide-over, the Coordinator and Admin links for
 * those roles, and Sign in / Sign out (AccountControls).
 */
import { Suspense, useEffect, useRef, type ReactElement } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import FadeContent from "@/components/bits/FadeContent";
import { DevEnvironmentBanner } from "@/components/DevEnvironmentBanner";
import { DisplayPreferences } from "@/components/DisplayPreferences";
import { HelpPanelLauncher } from "@/components/help/HelpPanelLauncher";
import { LoadingState } from "@/components/LoadingState";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { AccountControls } from "./AccountControls";
import { LegalLinks } from "./LegalLinks"; // Tier 1 lane C
import { VOLUNTEER_NAV_ITEMS } from "./navItems";

const desktopLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    "inline-flex min-h-touch items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-(--duration-fast)",
    isActive ? "bg-accent-subtle text-accent" : "text-fg-muted hover:bg-surface-sunken hover:text-fg"
  );

const tabLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-(--duration-fast)",
    isActive ? "text-accent" : "text-fg-muted hover:text-fg"
  );

const useFocusMainOnNavigate = (): void => {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Lazy screens render a moment after the URL changes; wait one frame so their h1 exists.
    const frame = window.requestAnimationFrame(() => {
      const main = document.getElementById("main");
      const heading = main?.querySelector<HTMLElement>("h1[tabindex='-1']");
      (heading ?? main)?.focus({ preventScroll: false });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);
};

export const AppLayout = (): ReactElement => {
  const { pathname } = useLocation();
  useFocusMainOnNavigate();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-(--z-overlay) rounded-md bg-accent px-4 py-3 font-semibold text-accent-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      {import.meta.env.DEV ? <DevEnvironmentBanner /> : null}

      <header className="sticky top-0 z-(--z-header) border-b border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/" className="inline-flex min-h-touch items-center rounded-md text-lg font-semibold tracking-tight text-fg">
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-2">
            <nav aria-label="Main" className="hidden lg:block">
              <ul className="flex items-center gap-1">
                {VOLUNTEER_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink to={to} end={end} className={desktopLinkClass}>
                      <Icon aria-hidden="true" size={18} weight="regular" />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            {/* Quick help slide-over, also opened with the "?" key (SPEC 9.6). */}
            <HelpPanelLauncher />
            <AccountControls />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-12 outline-none">
        <FadeContent key={pathname}>
          <Suspense fallback={<LoadingState label="Loading this screen" />}>
            <Outlet />
          </Suspense>
        </FadeContent>
      </main>

      <footer className="border-t border-border bg-surface pb-20 lg:pb-0">
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <DisplayPreferences />
          {/* Tier 1 lane C */}
          <LegalLinks />
        </div>
      </footer>

      <nav
        aria-label="Main tabs"
        className="fixed inset-x-0 bottom-0 z-(--z-tabbar) border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="flex">
          {VOLUNTEER_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex flex-1">
              <NavLink to={to} end={end} className={tabLinkClass}>
                <Icon aria-hidden="true" size={22} weight="regular" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};
