/**
 * paletteCommands.test.ts
 * Role-based destinations, the text match, and the grouped result list of
 * the command palette.
 */
import { describe, expect, it } from "vitest";
import { PALETTE_LIMITS, buildPaletteGroups, flattenGroups, matchesQuery, queryTerms, routeCommandsFor } from "./paletteCommands";

const VISITOR = { signedIn: false, isAdmin: false, memberships: [] };
const VOLUNTEER = { signedIn: true, isAdmin: false, memberships: [] };
const COORDINATOR = { signedIn: true, isAdmin: false, memberships: [{ orgId: "common-table", orgName: "Common Table Pantry" }] };
const ADMIN = { signedIn: true, isAdmin: true, memberships: [] };

const paths = (context: Parameters<typeof routeCommandsFor>[0]): string[] => routeCommandsFor(context).map((item) => item.to);

describe("routeCommandsFor", () => {
  it("gives visitors only public screens plus Sign in", () => {
    const visitor = paths(VISITOR);
    expect(visitor).toContain("/explore");
    expect(visitor).toContain("/verify");
    expect(visitor).toContain("/login");
    expect(visitor).not.toContain("/me/shifts");
    expect(visitor).not.toContain("/admin");
  });

  it("adds volunteer screens for signed-in people and drops Sign in", () => {
    const volunteer = paths(VOLUNTEER);
    expect(volunteer).toEqual(expect.arrayContaining(["/me/shifts", "/impact", "/me/notifications", "/me/saved", "/me/profile"]));
    expect(volunteer).not.toContain("/login");
    expect(volunteer[0]).toBe("/explore");
  });

  it("adds each organization's workspace for coordinators, named by org", () => {
    const items = routeCommandsFor(COORDINATOR);
    const dashboard = items.find((item) => item.to === "/org/common-table/dashboard");
    expect(dashboard?.label).toBe("Common Table Pantry: Dashboard");
    expect(dashboard?.keywords).toContain("Common Table Pantry");
    expect(items.map((item) => item.to)).toContain("/org/common-table/shifts/new");
  });

  it("shows the admin console only with the admin claim", () => {
    expect(paths(ADMIN)).toContain("/admin");
    expect(paths(COORDINATOR)).not.toContain("/admin");
  });

  it("gives every item a unique id", () => {
    const ids = routeCommandsFor({ ...COORDINATOR, isAdmin: true }).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("matchesQuery", () => {
  it("matches when every word appears, in any order and case", () => {
    expect(matchesQuery("My Shifts upcoming schedule", "SCHEDULE my")).toBe(true);
    expect(matchesQuery("My Shifts", "shifts report")).toBe(false);
  });

  it("matches everything for an empty or punctuation-only query", () => {
    expect(matchesQuery("anything", "  ")).toBe(true);
    expect(queryTerms("--")).toEqual([]);
  });
});

describe("buildPaletteGroups", () => {
  const routes = routeCommandsFor(VOLUNTEER);
  const articles = [{ slug: "kiosk-check-in", title: "Checking in at the kiosk", summary: "How the code works." }];
  const orgs = [
    { id: "common-table", name: "Common Table Pantry", hint: "Hunger relief" },
    { id: "river", name: "Riverwalk Cleanup", hint: "Environment" }
  ];

  it("lists pages and page help when nothing is typed", () => {
    const groups = buildPaletteGroups({ query: "", routes, articles, orgs });
    expect(groups.map((group) => group.id)).toEqual(["pages", "help"]);
    expect(groups[0]?.items).toHaveLength(Math.min(routes.length, PALETTE_LIMITS.pagesWhenEmpty));
    expect(groups[1]?.label).toBe("Help for this page");
  });

  it("filters pages, offers a shift search, and matches organizations", () => {
    const groups = buildPaletteGroups({ query: "pantry", routes, articles: [], orgs });
    expect(groups.map((group) => group.id)).toEqual(["shifts", "organizations"]);
    const [shiftSearch, org] = flattenGroups(groups);
    expect(shiftSearch?.to).toBe("/explore?q=pantry");
    expect(org).toMatchObject({ label: "Common Table Pantry", to: "/organizations/common-table" });
  });

  it("ranks pages whose label starts with the query first", () => {
    const groups = buildPaletteGroups({ query: "check", routes, articles, orgs: [] });
    const pages = groups.find((group) => group.id === "pages")?.items ?? [];
    expect(pages[0]?.label).toBe("Check in to a shift");
    expect(groups.find((group) => group.id === "help")?.items[0]?.to).toBe("/help/kiosk-check-in");
  });

  it("keeps the Explore search query within the filter's length cap", () => {
    const long = "a".repeat(150);
    const shift = flattenGroups(buildPaletteGroups({ query: long, routes: [], articles: [], orgs: [] }))[0];
    expect(new URLSearchParams(shift?.to.split("?")[1]).get("q")).toHaveLength(100);
  });
});
