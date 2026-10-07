/**
 * routeMeta.ts
 * Default <title>, meta description, and indexing rule for every route
 * (SPEC 1.2 Tier 3 SEO, SPEC 9.1 route list). Screens with their own data
 * (an organization, a help article) refine these through usePageHead.
 * Private screens are marked noindex in addition to robots.txt, because a
 * shared link can reach a crawler that never reads robots.txt.
 */
import { matchPath } from "react-router-dom";
import { APP_NAME } from "@/lib/brand";

export interface RouteMeta {
  /** Page name without the app name; null means the home title. */
  readonly title: string | null;
  readonly description: string;
  readonly noindex: boolean;
}

const DEFAULT_DESCRIPTION = "Find volunteer shifts with local nonprofits, check in at the event, and get your service hours verified.";

interface RouteMetaEntry extends RouteMeta {
  readonly pattern: string;
  /** Match this pattern and everything under it. */
  readonly prefix?: boolean;
}

const PUBLIC = false;
const PRIVATE = true;

/** First match wins, so specific patterns come before their prefixes. */
const ROUTE_META: readonly RouteMetaEntry[] = [
  { pattern: "/", title: null, description: DEFAULT_DESCRIPTION, noindex: PUBLIC },
  { pattern: "/explore", title: "Find volunteer shifts", description: DEFAULT_DESCRIPTION, noindex: PUBLIC },
  {
    pattern: "/opportunity/:instanceId",
    title: "Volunteer shift",
    description: "Shift details, seats left, and how to sign up.",
    noindex: PUBLIC
  },
  {
    pattern: "/organizations/:orgId",
    title: "Organization",
    description: "A local nonprofit's mission and upcoming volunteer shifts.",
    noindex: PUBLIC
  },
  { pattern: "/help", title: "Help Center", description: "Answers about signing up, checking in, hours, and verified letters.", noindex: PUBLIC },
  { pattern: "/help/:slug", title: "Help", description: "An article from the Help Center.", noindex: PUBLIC },
  { pattern: "/verify", title: "Verify a letter", description: "Check that a volunteer hours letter is real and current.", noindex: PUBLIC },
  { pattern: "/verify/:code", title: "Letter verification", description: "Verification result for a volunteer hours letter.", noindex: PRIVATE },
  { pattern: "/privacy", title: "Privacy policy", description: `How ${APP_NAME} collects, uses, and protects your information.`, noindex: PUBLIC },
  { pattern: "/terms", title: "Terms of use", description: `The rules for using ${APP_NAME}.`, noindex: PUBLIC },
  { pattern: "/accessibility", title: "Accessibility statement", description: `How ${APP_NAME} supports people with disabilities.`, noindex: PUBLIC },
  { pattern: "/login", title: "Sign in", description: DEFAULT_DESCRIPTION, noindex: PRIVATE },
  { pattern: "/onboarding", title: "Create your profile", description: DEFAULT_DESCRIPTION, noindex: PRIVATE },
  { pattern: "/me/shifts", title: "My Shifts", description: DEFAULT_DESCRIPTION, noindex: PRIVATE },
  { pattern: "/me/notifications", title: "Notifications", description: DEFAULT_DESCRIPTION, noindex: PRIVATE },
  { pattern: "/me/saved", title: "Saved", description: DEFAULT_DESCRIPTION, noindex: PRIVATE },
  { pattern: "/me/profile", title: "Profile", description: DEFAULT_DESCRIPTION, noindex: PRIVATE },
  { pattern: "/impact", title: "Impact", description: DEFAULT_DESCRIPTION, noindex: PRIVATE, prefix: true },
  { pattern: "/checkin", title: "Check in", description: DEFAULT_DESCRIPTION, noindex: PRIVATE },
  { pattern: "/join", title: "Join an organization", description: DEFAULT_DESCRIPTION, noindex: PRIVATE },
  { pattern: "/org/register", title: "Register your nonprofit", description: DEFAULT_DESCRIPTION, noindex: PRIVATE },
  { pattern: "/org/:orgId", title: "Coordinator", description: DEFAULT_DESCRIPTION, noindex: PRIVATE, prefix: true },
  { pattern: "/admin", title: "Admin", description: DEFAULT_DESCRIPTION, noindex: PRIVATE, prefix: true }
];

const NOT_FOUND: RouteMeta = { title: "Page not found", description: DEFAULT_DESCRIPTION, noindex: PRIVATE };

export const metaForPath = (pathname: string): RouteMeta => {
  const entry = ROUTE_META.find(({ pattern, prefix }) => matchPath({ path: prefix ? `${pattern}/*` : pattern, end: true }, pathname) !== null);
  return entry ? { title: entry.title, description: entry.description, noindex: entry.noindex } : NOT_FOUND;
};

/** Keep the home tab title to the plain product name. */
export const documentTitle = (title: string | null): string => (title === null ? APP_NAME : `${title} | ${APP_NAME}`);

/** Landing and Explore are separate indexable screens. */
export const canonicalPath = (pathname: string): string => {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return trimmed;
};
