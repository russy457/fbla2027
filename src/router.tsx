/**
 * router.tsx
 * Every route in the app (SPEC#screen-nav D2). Public screens (Explore, Help,
 * Verify, Login, Onboarding) share AppLayout with signed-in screens. Guards
 * are layout routes: RequireProfile (signed in + onboarding done, G11) wraps
 * volunteer screens, RequireCoordinator wraps /org/:orgId/*, and
 * RequireAdmin wraps /admin. The kiosk renders without the shell (G15).
 * Each screen is code-split with lazyWithReload so a stale chunk after a
 * deploy heals itself with one reload.
 */
import { Suspense } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { RequireAdmin, RequireCoordinator, RequireProfile } from "./components/guards/RouteGuards";
import { LoadingState } from "./components/LoadingState";
import { RouteError } from "./components/RouteError";
import { AppLayout } from "./layouts/AppLayout";
import { lazyWithReload } from "./lib/lazyWithReload";

const ExplorePage = lazyWithReload(() => import("./pages/ExplorePage"));
const MyShiftsPage = lazyWithReload(() => import("./pages/MyShiftsPage"));
const ImpactPage = lazyWithReload(() => import("./pages/ImpactPage"));
const HelpPage = lazyWithReload(() => import("./pages/HelpPage"));
const VerifyPage = lazyWithReload(() => import("./pages/VerifyPage"));
const OpportunityPage = lazyWithReload(() => import("./pages/OpportunityPage"));
const LoginPage = lazyWithReload(() => import("./pages/LoginPage"));
const OnboardingPage = lazyWithReload(() => import("./pages/OnboardingPage"));
const OrgDashboardPage = lazyWithReload(() => import("./pages/OrgDashboardPage"));
const KioskPage = lazyWithReload(() => import("./pages/KioskPage"));
const AdminPage = lazyWithReload(() => import("./pages/AdminPage"));
const NotFoundPage = lazyWithReload(() => import("./pages/NotFoundPage"));
// Tier 1 lane C
const PrivacyPage = lazyWithReload(() => import("./pages/legal/PrivacyPage"));
const TermsPage = lazyWithReload(() => import("./pages/legal/TermsPage"));
const AccessibilityPage = lazyWithReload(() => import("./pages/legal/AccessibilityPage"));

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <ExplorePage /> },
      { path: "explore", element: <ExplorePage /> },
      { path: "opportunity/:instanceId", element: <OpportunityPage /> },
      { path: "help", element: <HelpPage /> },
      { path: "help/:slug", element: <HelpPage /> },
      { path: "verify", element: <VerifyPage /> },
      { path: "verify/:code", element: <VerifyPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "onboarding", element: <OnboardingPage /> },
      {
        element: <RequireProfile />,
        children: [
          { path: "me/shifts", element: <MyShiftsPage /> },
          { path: "impact", element: <ImpactPage /> },
          { path: "org/:orgId", element: <RequireCoordinator />, children: [{ path: "dashboard", element: <OrgDashboardPage /> }] },
          { path: "admin", element: <RequireAdmin />, children: [{ index: true, element: <AdminPage /> }] }
        ]
      },
      // Tier 1 lane C
      { path: "privacy", element: <PrivacyPage /> },
      { path: "terms", element: <TermsPage /> },
      { path: "accessibility", element: <AccessibilityPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  },
  {
    path: "org/:orgId/kiosk/:instanceId",
    errorElement: <RouteError />,
    element: (
      <Suspense fallback={<LoadingState label="Loading the kiosk" />}>
        <KioskPage />
      </Suspense>
    )
  }
];

export const createAppRouter = () =>
  createBrowserRouter(routes, {
    future: {
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_relativeSplatPath: true,
      v7_skipActionErrorRevalidation: true
    }
  });
