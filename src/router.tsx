/**
 * router.tsx
 * Every route in the app (plan D2). Volunteer screens share AppLayout (top
 * nav on desktop, bottom tabs on mobile). Coordinator screens live under
 * /org/:orgId/*, admin under /admin, and the kiosk renders without the shell.
 * Each screen is code-split with lazyWithReload so a stale chunk after a
 * deploy heals itself with one reload.
 */
import { Suspense } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { LoadingState } from "./components/LoadingState";
import { RouteError } from "./components/RouteError";
import { AppLayout } from "./layouts/AppLayout";
import { lazyWithReload } from "./lib/lazyWithReload";

const ExplorePage = lazyWithReload(() => import("./pages/ExplorePage"));
const MyShiftsPage = lazyWithReload(() => import("./pages/MyShiftsPage"));
const ImpactPage = lazyWithReload(() => import("./pages/ImpactPage"));
const HelpPage = lazyWithReload(() => import("./pages/HelpPage"));
const VerifyPage = lazyWithReload(() => import("./pages/VerifyPage"));
const OnboardingPage = lazyWithReload(() => import("./pages/OnboardingPage"));
const OrgDashboardPage = lazyWithReload(() => import("./pages/OrgDashboardPage"));
const KioskPage = lazyWithReload(() => import("./pages/KioskPage"));
const AdminPage = lazyWithReload(() => import("./pages/AdminPage"));
const NotFoundPage = lazyWithReload(() => import("./pages/NotFoundPage"));

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <ExplorePage /> },
      { path: "me/shifts", element: <MyShiftsPage /> },
      { path: "impact", element: <ImpactPage /> },
      { path: "help", element: <HelpPage /> },
      { path: "help/:slug", element: <HelpPage /> },
      { path: "verify/:code", element: <VerifyPage /> },
      { path: "onboarding", element: <OnboardingPage /> },
      { path: "org/:orgId/dashboard", element: <OrgDashboardPage /> },
      { path: "admin", element: <AdminPage /> },
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
