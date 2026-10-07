/**
 * routeContext.test.ts
 * Route sanitizing and route-to-article suggestions, including dynamic
 * segments (/org/:orgId/*, /verify/:code, kiosk) and hostile inputs.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SUGGESTIONS, matchesPattern, sanitizeRoute, suggestedSlugsForRoute } from "./routeContext";

describe("sanitizeRoute", () => {
  it.each([
    ["/me/shifts", "/me/shifts"],
    ["/Me/Shifts/?tab=past#top", "/me/shifts"],
    ["", "/"],
    ["/", "/"],
    ["//double//slashes", "/double/slashes"],
    ["/help/../admin", "/help/admin"]
  ])("normalizes %j to %j", (input, expected) => {
    expect(sanitizeRoute(input)).toBe(expected);
  });

  it.each([["/help/<script>"], ["/verify/a b"], ["/x/%2e%2e"], ["/" + "a".repeat(600)]])("rejects %j", (input) => {
    expect(sanitizeRoute(input)).toBeNull();
  });

  it("rejects non-string input defensively", () => {
    expect(sanitizeRoute(undefined as unknown as string)).toBeNull();
  });
});

describe("matchesPattern", () => {
  it("matches dynamic segments one for one", () => {
    expect(matchesPattern("/org/abc/dashboard", "/org/:orgId/dashboard")).toBe(true);
    expect(matchesPattern("/org/abc/dashboard/extra", "/org/:orgId/dashboard")).toBe(false);
    expect(matchesPattern("/org/abc/reports", "/org/:orgId/dashboard")).toBe(false);
  });
});

describe("suggestedSlugsForRoute", () => {
  it("suggests check-in help on My Shifts", () => {
    expect(suggestedSlugsForRoute("/me/shifts")[0]).toBe("kiosk-check-in");
  });

  it("resolves coordinator routes with ids", () => {
    expect(suggestedSlugsForRoute("/org/org_123/dashboard")).toContain("coordinator-start-kiosk");
    expect(suggestedSlugsForRoute("/org/org_123/kiosk/inst-9")[0]).toBe("coordinator-start-kiosk");
  });

  it("resolves the verify page with a letter code", () => {
    expect(suggestedSlugsForRoute("/verify/ABCDEFGH234567")[0]).toBe("verify-a-letter");
  });

  it("falls back to general suggestions for unknown or unsafe routes", () => {
    expect(suggestedSlugsForRoute("/nowhere/at/all")).toBe(DEFAULT_SUGGESTIONS);
    expect(suggestedSlugsForRoute("/help/<img src=x>")).toBe(DEFAULT_SUGGESTIONS);
  });
});
