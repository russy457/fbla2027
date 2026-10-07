/**
 * AppLayout.tsx
 * The volunteer app shell (plan D2, D20): skip link, header with the product
 * name and an adaptive top nav, the routed page inside <main>, and a footer
 * with display preferences. Landmarks (header,
 * nav, main, footer) are real elements so screen reader users can jump
 * between them. After each navigation, focus moves to the new screen's h1
 * (or <main> when the screen has none) so keyboard and screen reader users
 * start reading from the top (D20). The header also holds the Quick help
 * button that opens the help slide-over, the Coordinator and Admin links for
 * those roles, and Sign in / Sign out (AccountControls). The full top row
 * collapses to a four-route icon pill after scrolling.
 */
import { Suspense, useEffect, useRef, useState, type ReactElement } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { UserCircle } from "@phosphor-icons/react";
import FadeContent from "@/components/bits/FadeContent";
import { DevEnvironmentBanner } from "@/components/DevEnvironmentBanner";
import { DisplayPreferences } from "@/components/DisplayPreferences";
import { HelpPanelLauncher } from "@/components/help/HelpPanelLauncher";
import { LoadingState } from "@/components/LoadingState";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { isHostingPreview } from "@/lib/hostingPreview";
import { useSessionUser } from "@/store/authStore";
import { AccountControls } from "./AccountControls";
import { LegalLinks } from "./LegalLinks"; // Tier 1 lane C
// Tier 2 lane C
import { CommandPaletteLauncher } from "@/components/palette/CommandPaletteLauncher";
import { CookieConsent } from "@/components/CookieConsent";
import { RouteHead } from "@/components/seo/RouteHead";
import { VOLUNTEER_NAV_ITEMS } from "./navItems";

const navLinkClass = ({ isActive }: { isActive: boolean }): string => cn("site-nav__link", isActive && "is-active");
const COMPACT_AT_SCROLL_Y = 132;

const HeaderAccount = ({ condensed }: { readonly condensed: boolean }): ReactElement => {
  const { pathname } = useLocation();
  const user = useSessionUser();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    detailsRef.current?.removeAttribute("open");
  }, [pathname, condensed]);
  if (!user) return <AccountControls />;
  return (
    <details ref={detailsRef} className="header-account-menu">
      <summary aria-label="Account menu">
        <UserCircle aria-hidden="true" size={20} />
        <span>Account</span>
      </summary>
      <div className="header-account-panel"><AccountControls /></div>
    </details>
  );
};

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
  const user = useSessionUser();
  const [condensed, setCondensed] = useState(false);
  useFocusMainOnNavigate();

  useEffect(() => {
    const update = (): void => setCondensed(window.scrollY > COMPACT_AT_SCROLL_Y);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [pathname]);

  const isHome = pathname === "/" || pathname === "/explore";

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-(--z-overlay) rounded-md bg-accent px-4 py-3 font-semibold text-accent-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      {import.meta.env.DEV ? <DevEnvironmentBanner /> : null}
      {isHostingPreview() ? (
        <div role="status" className="border-b border-border bg-surface-sunken px-4 py-2 text-center text-sm text-fg-muted">
          Browse the site here. Shift signups and account changes are available in the guided demo.
        </div>
      ) : null}
      {/* Tier 2 lane C: per-route title, description, canonical, Open Graph (SPEC Tier 3 SEO). */}
      <RouteHead />

      <header className="site-header" data-condensed={condensed} data-home={isHome} data-explore={pathname === "/explore"}>
        <div className="site-header__inner">
          <Link to="/" className="site-header__brand">
            {APP_NAME}
          </Link>
          <nav aria-label="Main" className="site-nav">
            <ul>
              {VOLUNTEER_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    aria-label={label}
                    className={navLinkClass}
                  >
                    <Icon aria-hidden="true" size={20} weight="regular" />
                    <span className="site-nav__label">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="site-header__tools">
            {/* Tier 2 lane C: command palette, also opened with Ctrl/Cmd+K (SPEC 9.1). */}
            <CommandPaletteLauncher />
            {/* Quick help slide-over, also opened with the "?" key (SPEC 9.6). */}
            <HelpPanelLauncher />
            <HeaderAccount condensed={condensed} />
          </div>
        </div>
      </header>

      {/* Tier 2 lane C: storage notice, in flow so it never covers controls. */}
      <CookieConsent />

      <main id="main" tabIndex={-1} className={cn("w-full flex-1 outline-none", pathname === "/" || pathname === "/explore" ? "" : "mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 md:pt-12", pathname === "/onboarding" && "onboarding-main")}>
        <FadeContent key={pathname}>
          <Suspense fallback={<LoadingState label="Loading this screen" />}>
            <Outlet />
          </Suspense>
        </FadeContent>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          {/* Linked from /me/profile ("Display settings"). */}
          <div id="display-preferences" tabIndex={-1} className="outline-none">
            <DisplayPreferences />
          </div>
          {/* The header shows Profile from md up; on phones it lives here. */}
          {user ? (
            <p className="mt-4 text-sm md:hidden">
              <Link to="/me/profile" className="font-medium text-accent underline-offset-4 hover:underline">
                Your profile and settings
              </Link>
            </p>
          ) : null}
          <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link to="/verify" className="font-medium text-accent underline-offset-4 hover:underline">
              Verify a letter
            </Link>
            <Link to="/org/register" className="font-medium text-accent underline-offset-4 hover:underline">
              Register your nonprofit
            </Link>
          </p>
          {/* Tier 1 lane C */}
          <LegalLinks />
        </div>
      </footer>

    </div>
  );
};
