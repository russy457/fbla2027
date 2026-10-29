/**
 * AppLayout.tsx
 * The volunteer app shell (plan D2, D20): skip link, header with the product
 * name and an adaptive top nav, the routed page inside <main>, and a footer.
 * Landmarks (header,
 * nav, main, footer) are real elements so screen reader users can jump
 * between them. After each navigation, focus moves to the new screen's h1
 * (or <main> when the screen has none) so keyboard and screen reader users
 * start reading from the top (D20). The header also holds the Quick help
 * button that opens the help slide-over, notifications, and the account menu.
 * The full top row
 * collapses to a four-route icon pill after scrolling.
 */
import { Suspense, useEffect, useRef, useState, type ReactElement } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { UserCircle } from "@phosphor-icons/react";
import FadeContent from "@/components/bits/FadeContent";
import { DevEnvironmentBanner } from "@/components/DevEnvironmentBanner";
import { BellMenu } from "@/components/notifications/BellMenu";
import { HelpPanelLauncher } from "@/components/help/HelpPanelLauncher";
import { LoadingState } from "@/components/LoadingState";
import { TandemBike } from "@/components/brand/TandemBike";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { isHostingPreview } from "@/lib/hostingPreview";
import { useSessionUser } from "@/store/authStore";
import { AccountControls } from "./AccountControls";
import { LegalLinks } from "./LegalLinks"; // Tier 1 lane C
// Tier 2 lane C
import { CommandPaletteLauncher } from "@/components/palette/CommandPaletteLauncher";
import { CookieConsent } from "@/components/CookieConsent";
import { pageVisualFor } from "@/content/pageVisuals";
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
  useEffect(() => {
    const dismiss = (event: PointerEvent): void => {
      if (event.target instanceof Node && !detailsRef.current?.contains(event.target)) detailsRef.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  if (!user) return <AccountControls />;
  return (
    <details ref={detailsRef} className="header-account-menu" onKeyDown={(event) => {
      if (event.key === "Escape" && detailsRef.current?.open) {
        event.preventDefault();
        detailsRef.current.removeAttribute("open");
        detailsRef.current.querySelector("summary")?.focus();
      }
    }}>
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
  const isEditorialInterior = !isHome && pathname !== "/onboarding";
  const visual = pageVisualFor(pathname);

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
      {/* In flow above the photo scene, so this notice never overlaps the navigation. */}
      <CookieConsent />

      <header className="site-header" data-condensed={condensed} data-home={isHome} data-scene="true">
        <div className="site-header__inner">
          <Link to="/" className="site-header__brand">
            <TandemBike className="site-header__brand-icon" />
            <span>{APP_NAME}</span>
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
            {user ? <BellMenu uid={user.uid} /> : null}
            <HeaderAccount condensed={condensed} />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className={cn("w-full flex-1 outline-none", isEditorialInterior && "interior-scene", pathname === "/onboarding" && "onboarding-main")}>
        {isEditorialInterior ? (
          <div className="interior-scene__media" aria-hidden="true">
            {visual.photo ? <img src={visual.photo.src} alt="" fetchPriority="high" decoding="async" style={{ objectPosition: visual.position }} /> : null}
          </div>
        ) : null}
        {pathname === "/onboarding" && visual.photo ? (
          <div className="onboarding-stage">
            <img src={visual.photo.src} alt="" fetchPriority="high" decoding="async" />
            <p>Join in</p>
          </div>
        ) : null}
        <div className={isEditorialInterior ? "interior-scene__flow" : undefined}>
          <FadeContent key={pathname} className={isEditorialInterior ? "interior-scene__route" : pathname === "/onboarding" ? "onboarding-route-shell" : undefined}>
            <Suspense fallback={isEditorialInterior ? <div className="interior-scene__loading"><LoadingState label="Loading this screen" lines={0} /></div> : <LoadingState label="Loading this screen" lines={0} />}>
              <Outlet />
            </Suspense>
          </FadeContent>
        </div>
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <Link to="/" className="site-footer__brand" aria-label={`${APP_NAME} home`}>
            <TandemBike />
            <span>{APP_NAME}</span>
          </Link>
          <div className="site-footer__content">
            <nav aria-label="Footer" className="site-footer__nav">
              <Link to="/explore">Explore shifts</Link>
              {user ? <Link to="/me/shifts">My shifts</Link> : null}
              <Link to="/verify">Verify a letter</Link>
              <Link to="/org/register">For nonprofits</Link>
              <Link to="/settings">Settings</Link>
              <Link to="/help">Help</Link>
            </nav>
            <LegalLinks />
          </div>
        </div>
      </footer>

    </div>
  );
};
