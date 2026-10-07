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
// Tier 1 lane B
const OrgRegisterPage = lazyWithReload(() => import("./pages/org/OrgRegisterPage"));
const OrgShiftsPage = lazyWithReload(() => import("./pages/org/OrgShiftsPage"));
const OrgShiftNewPage = lazyWithReload(() => import("./pages/org/OrgShiftNewPage"));
const OrgShiftDetailPage = lazyWithReload(() => import("./pages/org/OrgShiftDetailPage"));
const OrgReportsPage = lazyWithReload(() => import("./pages/org/OrgReportsPage"));
const OrgSettingsPage = lazyWithReload(() => import("./pages/org/OrgSettingsPage"));
const JoinPage = lazyWithReload(() => import("./pages/volunteer/JoinPage"));
const ManualHoursPage = lazyWithReload(() => import("./pages/volunteer/ManualHoursPage"));
const HoursReportPage = lazyWithReload(() => import("./pages/volunteer/HoursReportPage"));
// End Tier 1 lane B
// Tier 1 lane A
const NotificationsPage = lazyWithReload(() => import("./pages/NotificationsPage"));
const SavedPage = lazyWithReload(() => import("./pages/SavedPage"));
const CheckinPage = lazyWithReload(() => import("./pages/CheckinPage"));
// End Tier 1 lane A
// Tier 1 integration
const ProfilePage = lazyWithReload(() => import("./pages/volunteer/ProfilePage"));
const OrganizationPage = lazyWithReload(() => import("./pages/OrganizationPage"));
// Tier 2 lane A
const OrgSeriesPage = lazyWithReload(() => import("./pages/org/OrgSeriesPage"));
// End Tier 2 lane A
// Tier 2 lane B
const CollectionPage = lazyWithReload(() => import("./pages/CollectionPage"));
const OrgCollectionsPage = lazyWithReload(() => import("./pages/org/OrgCollectionsPage"));
// End Tier 2 lane B

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <ExplorePage /> },
      { path: "explore", element: <ExplorePage /> },
      { path: "opportunity/:instanceId", element: <OpportunityPage /> },
      // Tier 1 integration: public organization page (SPEC 9.2 "Organization")
      { path: "organizations/:orgId", element: <OrganizationPage /> },
      // Tier 2 lane B: public curated collection page (SPEC 9.1)
      { path: "collections/:collectionId", element: <CollectionPage /> },
      // End Tier 2 lane B
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
          // Tier 1 lane A
          { path: "me/notifications", element: <NotificationsPage /> },
          { path: "me/saved", element: <SavedPage /> },
          { path: "checkin", element: <CheckinPage /> },
          // End Tier 1 lane A
          // Tier 1 integration
          { path: "me/profile", element: <ProfilePage /> },
          { path: "org/:orgId", element: <RequireCoordinator />, children: [{ path: "dashboard", element: <OrgDashboardPage /> }] },
          { path: "admin", element: <RequireAdmin />, children: [{ index: true, element: <AdminPage /> }] },
          // Tier 1 lane B
          { path: "org/register", element: <OrgRegisterPage /> },
          { path: "join", element: <JoinPage /> },
          { path: "impact/report", element: <HoursReportPage /> },
          { path: "impact/hours/new", element: <ManualHoursPage /> },
          {
            path: "org/:orgId",
            element: <RequireCoordinator />,
            children: [
              { path: "shifts", element: <OrgShiftsPage /> },
              { path: "shifts/new", element: <OrgShiftNewPage /> },
              { path: "shifts/:instanceId", element: <OrgShiftDetailPage /> },
              { path: "reports", element: <OrgReportsPage /> },
              { path: "settings", element: <OrgSettingsPage /> }
            ]
          },
          // End Tier 1 lane B
          // Tier 2 lanes A and B: coordinator series page and curated collections
          {
            path: "org/:orgId",
            element: <RequireCoordinator />,
            children: [
              { path: "series/:seriesId", element: <OrgSeriesPage /> },
              { path: "collections", element: <OrgCollectionsPage /> }
            ]
          }
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
