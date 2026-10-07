/**
 * paletteCommands.ts
 * Pure logic behind the command palette (SPEC 9.1: "Tier 2 adds ... the
 * command palette (Ctrl/Cmd+K)"; navigation rubric row). Three jobs:
 *
 *   routeCommandsFor   the destinations a person may open, by role (D2):
 *                      everyone gets the public screens, signed-in people
 *                      get their volunteer screens, coordinators get each
 *                      organization's workspace, admins get /admin
 *   matchesQuery       a forgiving "every typed word appears" text match
 *   buildPaletteGroups the grouped, capped result list the palette renders
 *
 * No React and no Firebase here, so every rule is unit tested directly.
 */

export type PaletteGroupId = "pages" | "shifts" | "organizations" | "help";

export interface PaletteItem {
  /** Unique within one result list; also the DOM id suffix of the option. */
  readonly id: string;
  readonly group: PaletteGroupId;
  readonly label: string;
  /** One short line under the label ("Go to page", an org's cause areas...). */
  readonly hint: string;
  /** In-app path the item opens. */
  readonly to: string;
  /** Extra words that should find this item (synonyms, not shown). */
  readonly keywords: string;
}

export interface PaletteGroup {
  readonly id: PaletteGroupId;
  readonly label: string;
  readonly items: readonly PaletteItem[];
}

export interface PaletteMembership {
  readonly orgId: string;
  readonly orgName: string;
}

export interface PaletteRoleContext {
  readonly signedIn: boolean;
  readonly isAdmin: boolean;
  readonly memberships: readonly PaletteMembership[];
}

/** A help article as the palette needs it (slug, title, summary). */
export interface PaletteArticle {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
}

/** An organization as the palette needs it. */
export interface PaletteOrg {
  readonly id: string;
  readonly name: string;
  readonly hint: string;
}

interface RouteSpec {
  readonly label: string;
  readonly to: string;
  readonly keywords: string;
}

const PAGE_HINT = "Go to page";

/** Public screens (SPEC 9.1 visitor row). Sign in is added only when signed out. */
const PUBLIC_ROUTES: readonly RouteSpec[] = [
  { label: "Explore shifts", to: "/explore", keywords: "home find browse search volunteer opportunities map near me" },
  { label: "Help Center", to: "/help", keywords: "help faq support questions how to articles" },
  { label: "Verify a letter", to: "/verify", keywords: "verify check letter code hours proof" },
  { label: "Register your nonprofit", to: "/org/register", keywords: "organization nonprofit coordinator register create org" },
  { label: "Privacy policy", to: "/privacy", keywords: "privacy data cookies storage legal" },
  { label: "Terms of use", to: "/terms", keywords: "terms rules legal" },
  { label: "Accessibility statement", to: "/accessibility", keywords: "accessibility a11y screen reader keyboard" }
];

const SIGN_IN_ROUTE: RouteSpec = { label: "Sign in", to: "/login", keywords: "login log in account sign up create account" };

/** Volunteer screens (SPEC 9.1 volunteer row). */
const VOLUNTEER_ROUTES: readonly RouteSpec[] = [
  { label: "My Shifts", to: "/me/shifts", keywords: "my shifts upcoming signups schedule calendar cancel" },
  { label: "Impact", to: "/impact", keywords: "impact hours letters milestones badges" },
  { label: "Notifications", to: "/me/notifications", keywords: "notifications alerts inbox updates bell" },
  { label: "Saved", to: "/me/saved", keywords: "saved bookmarks favorites" },
  { label: "Profile and settings", to: "/me/profile", keywords: "profile account settings interests availability display" },
  { label: "Check in to a shift", to: "/checkin", keywords: "check in code kiosk scan qr arrive" },
  { label: "Log outside hours", to: "/impact/hours/new", keywords: "manual hours add log submit" },
  { label: "Hours report", to: "/impact/report", keywords: "report pdf download hours summary" },
  { label: "Join an organization with an invite", to: "/join", keywords: "join invite code coordinator team" }
];

/** Coordinator screens under /org/:orgId (SPEC 9.1 coordinator row). */
const ORG_ROUTES: ReadonlyArray<{ readonly label: string; readonly path: string; readonly keywords: string }> = [
  { label: "Dashboard", path: "dashboard", keywords: "coordinator dashboard today roster needs attention" },
  { label: "Shifts", path: "shifts", keywords: "coordinator shifts schedule manage" },
  { label: "New shift", path: "shifts/new", keywords: "coordinator create post add shift opportunity planner" },
  { label: "Reports", path: "reports", keywords: "coordinator reports csv pdf export hours" },
  { label: "Settings", path: "settings", keywords: "coordinator settings members invites profile" }
];

/** My Shifts, Impact, Notifications: listed before coordinator and admin screens. */
const PRIMARY_VOLUNTEER_COUNT = 3;

const toPage = (spec: RouteSpec): PaletteItem => ({
  id: `page:${spec.to}`,
  group: "pages",
  label: spec.label,
  hint: PAGE_HINT,
  to: spec.to,
  keywords: spec.keywords
});

/** Every destination this person may open, in a stable, role-ordered list. */
export const routeCommandsFor = (context: PaletteRoleContext): PaletteItem[] => {
  const publicItems = PUBLIC_ROUTES.map(toPage);
  if (!context.signedIn) return [...publicItems, toPage(SIGN_IN_ROUTE)];
  const orgItems = context.memberships.flatMap((membership) =>
    ORG_ROUTES.map(
      (route): PaletteItem => ({
        id: `page:/org/${membership.orgId}/${route.path}`,
        group: "pages",
        label: `${membership.orgName}: ${route.label}`,
        hint: "Coordinator",
        to: `/org/${encodeURIComponent(membership.orgId)}/${route.path}`,
        keywords: `${route.keywords} ${membership.orgName}`
      })
    )
  );
  const adminItems = context.isAdmin ? [toPage({ label: "Admin console", to: "/admin", keywords: "admin verify organizations jobs demo reset" })] : [];
  const volunteerItems = VOLUNTEER_ROUTES.map(toPage);
  const isDashboard = (item: PaletteItem): boolean => item.to.endsWith("/dashboard");
  // Most-used first, so the short list shown before typing holds each role's home screens.
  return [
    ...publicItems.slice(0, 1),
    ...volunteerItems.slice(0, PRIMARY_VOLUNTEER_COUNT),
    ...orgItems.filter(isDashboard),
    ...adminItems,
    ...volunteerItems.slice(PRIMARY_VOLUNTEER_COUNT),
    ...orgItems.filter((item) => !isDashboard(item)),
    ...publicItems.slice(1)
  ];
};

/** Lowercased words of a query; punctuation splits words. */
export const queryTerms = (query: string): string[] =>
  query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 0);

/** True when every typed word appears somewhere in the text (an empty query matches all). */
export const matchesQuery = (text: string, query: string): boolean => {
  const haystack = text.toLowerCase();
  return queryTerms(query).every((term) => haystack.includes(term));
};

/** Labels that start with the query rank above ones that only mention it. */
const rankByLabel = (items: readonly PaletteItem[], query: string): PaletteItem[] => {
  const needle = query.trim().toLowerCase();
  return [...items].sort((a, b) => Number(b.label.toLowerCase().startsWith(needle)) - Number(a.label.toLowerCase().startsWith(needle)));
};

/** Caps keep the list scannable; the full pages (Explore, Help) have the rest. */
export const PALETTE_LIMITS = Object.freeze({ pagesWhenEmpty: 10, pages: 6, organizations: 4, help: 4 });

/** Explore's search box reads ?q= (src/lib/explore/filters.ts caps it at 100 characters). */
const EXPLORE_QUERY_MAX = 100;

export interface PaletteInput {
  readonly query: string;
  readonly routes: readonly PaletteItem[];
  /** Ranked help hits for a non-empty query (BM25), or suggestions for this page when empty. */
  readonly articles: readonly PaletteArticle[];
  readonly orgs: readonly PaletteOrg[];
}

/** The grouped result list, empty groups removed. */
export const buildPaletteGroups = ({ query, routes, articles, orgs }: PaletteInput): PaletteGroup[] => {
  const trimmed = query.trim();
  const isEmpty = trimmed === "";
  const pages = isEmpty
    ? routes.slice(0, PALETTE_LIMITS.pagesWhenEmpty)
    : rankByLabel(
        routes.filter((item) => matchesQuery(`${item.label} ${item.keywords}`, trimmed)),
        trimmed
      ).slice(0, PALETTE_LIMITS.pages);
  const shifts: PaletteItem[] = isEmpty
    ? []
    : [
        {
          id: "shifts:search",
          group: "shifts",
          label: `Search shifts for "${trimmed}"`,
          hint: "Opens Explore with this search",
          to: `/explore?${new URLSearchParams({ q: trimmed.slice(0, EXPLORE_QUERY_MAX) }).toString()}`,
          keywords: ""
        }
      ];
  const orgItems = isEmpty
    ? []
    : orgs
        .filter((org) => matchesQuery(`${org.name} ${org.hint}`, trimmed))
        .slice(0, PALETTE_LIMITS.organizations)
        .map(
          (org): PaletteItem => ({
            id: `org:${org.id}`,
            group: "organizations",
            label: org.name,
            hint: org.hint,
            to: `/organizations/${encodeURIComponent(org.id)}`,
            keywords: ""
          })
        );
  const helpItems = articles.slice(0, PALETTE_LIMITS.help).map(
    (article): PaletteItem => ({
      id: `help:${article.slug}`,
      group: "help",
      label: article.title,
      hint: article.summary,
      to: `/help/${encodeURIComponent(article.slug)}`,
      keywords: ""
    })
  );
  const groups: PaletteGroup[] = [
    { id: "pages", label: "Pages", items: pages },
    { id: "shifts", label: "Shifts", items: shifts },
    { id: "organizations", label: "Organizations", items: orgItems },
    { id: "help", label: isEmpty ? "Help for this page" : "Help articles", items: helpItems }
  ];
  return groups.filter((group) => group.items.length > 0);
};

/** The groups flattened in display order: the index space for arrow keys. */
export const flattenGroups = (groups: readonly PaletteGroup[]): PaletteItem[] => groups.flatMap((group) => group.items);
