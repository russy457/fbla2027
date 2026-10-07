/**
 * routeContext.ts
 * Suggests help articles for the screen the user is on (SPEC 8.5 "Help route
 * context", ported idea of the old helpRouteContext.ts). The quick help panel
 * shows these before the user types anything.
 *
 * Route strings come from the browser, so they are sanitized first: query and
 * hash are dropped, the path is lowercased, empty and dot segments are
 * removed, and any segment with characters outside a safe set makes the whole
 * path unrecognized (it then gets the general suggestions). Patterns use
 * ":param" for one dynamic segment, matching the routes in SPEC 9.1.
 */

/** Longest path we bother matching; anything longer is not a real app route. */
const MAX_PATH_LENGTH = 512;
const SAFE_SEGMENT = /^[a-z0-9_~.-]{1,128}$/;

/** Shown when no route pattern matches (including unsafe paths). */
export const DEFAULT_SUGGESTIONS: readonly string[] = Object.freeze([
  "getting-started",
  "find-and-sign-up",
  "kiosk-check-in"
]);

/** Route pattern -> article slugs, most specific screens first. */
export const ROUTE_SUGGESTIONS: ReadonlyArray<readonly [pattern: string, slugs: readonly string[]]> = Object.freeze([
  ["/", ["getting-started", "find-and-sign-up", "create-account"]],
  ["/explore", ["find-and-sign-up", "getting-started", "org-verification"]],
  ["/opportunity/:instanceId", ["find-and-sign-up", "kiosk-check-in", "privacy-and-minors"]],
  ["/organizations/:orgId", ["org-verification", "find-and-sign-up", "verified-letters"]],
  ["/me/shifts", ["kiosk-check-in", "check-out-and-hours", "troubleshooting-check-in"]],
  ["/checkin", ["kiosk-check-in", "troubleshooting-check-in", "check-out-and-hours"]],
  ["/impact", ["check-out-and-hours", "verified-letters", "verify-a-letter"]],
  ["/impact/letters/new", ["verified-letters", "verify-a-letter", "org-verification"]],
  ["/impact/report", ["coordinator-reports", "verified-letters"]],
  ["/verify", ["verify-a-letter", "verified-letters"]],
  ["/verify/:code", ["verify-a-letter", "verified-letters"]],
  ["/help", ["getting-started", "ai-assistant", "accessibility-settings"]],
  ["/help/:slug", ["getting-started", "ai-assistant", "accessibility-settings"]],
  ["/login", ["create-account", "getting-started", "privacy-and-minors"]],
  ["/onboarding", ["create-account", "privacy-and-minors", "accessibility-settings"]],
  ["/me/profile", ["accessibility-settings", "privacy-and-minors"]],
  ["/org/register", ["org-verification", "privacy-and-minors"]],
  ["/org/:orgId/dashboard", ["coordinator-start-kiosk", "coordinator-approve-hours", "coordinator-attendance"]],
  ["/org/:orgId/shifts", ["coordinator-attendance", "coordinator-start-kiosk"]],
  ["/org/:orgId/shifts/:instanceId", ["coordinator-start-kiosk", "coordinator-attendance", "coordinator-approve-hours"]],
  ["/org/:orgId/reports", ["coordinator-reports", "coordinator-attendance"]],
  ["/org/:orgId/settings", ["org-verification", "privacy-and-minors"]],
  ["/org/:orgId/kiosk/:instanceId", ["coordinator-start-kiosk", "troubleshooting-check-in"]],
  ["/admin", ["org-verification", "coordinator-attendance"]]
]);

/**
 * Normalize a browser path into "/a/b" form, or null if it is not a plausible
 * app route. Examples:
 *   "/Me/Shifts/?tab=past#x"  -> "/me/shifts"
 *   "//evil.example/../x"     -> "/evil.example/x"  (dot segments dropped)
 *   "/help/<script>"          -> null
 */
export const sanitizeRoute = (rawPath: string): string | null => {
  if (typeof rawPath !== "string" || rawPath.length > MAX_PATH_LENGTH) return null;
  const pathOnly = rawPath.split(/[?#]/, 1)[0] ?? "";
  const segments = pathOnly
    .toLowerCase()
    .split("/")
    .filter((segment) => segment !== "" && segment !== "." && segment !== "..");
  if (!segments.every((segment) => SAFE_SEGMENT.test(segment))) return null;
  return `/${segments.join("/")}`;
};

/** True when a sanitized path matches a pattern segment for segment. */
export const matchesPattern = (path: string, pattern: string): boolean => {
  const pathParts = path.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  return (
    pathParts.length === patternParts.length &&
    patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index])
  );
};

/** Article slugs suggested for a browser path (always non-empty). */
export const suggestedSlugsForRoute = (rawPath: string): readonly string[] => {
  const path = sanitizeRoute(rawPath);
  if (path === null) return DEFAULT_SUGGESTIONS;
  const entry = ROUTE_SUGGESTIONS.find(([pattern]) => matchesPattern(path, pattern));
  return entry ? entry[1] : DEFAULT_SUGGESTIONS;
};
