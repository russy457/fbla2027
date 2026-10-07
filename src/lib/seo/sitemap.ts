/**
 * sitemap.ts
 * robots.txt and sitemap.xml content (SPEC 1.2 Tier 3 SEO), generated at
 * build time by the Vite plugin in vite.config.ts from APP_BASE_URL. Pure
 * string building with no DOM and no Node APIs, so both the browser test
 * project and the Node-side Vite config can import it (tsconfig.node.json
 * lists this file).
 *
 * What is listed: the public, indexable static screens and every bundled
 * help article. Private screens (signed-in, coordinator, kiosk, admin) and
 * individual letter pages (they carry a person's name) are disallowed.
 *
 * Organization pages (/organizations/:orgId) are dynamic, so they are not in
 * the build-time sitemap. Documented approach (docs/ARCHITECTURE.md, SEO):
 * either run a post-build step with the Admin SDK that appends one <url> per
 * verified, non-archived organization before `firebase deploy`, or serve
 * /sitemap.xml from a Function behind a Hosting rewrite. Crawlers still
 * reach org pages through links on Explore and in the help articles.
 */

/** SPEC 10.6 local default for APP_BASE_URL. */
export const DEFAULT_BASE_URL = "http://localhost:5173";

/** Public screens worth indexing ("/explore" is the same screen as "/"). */
export const PUBLIC_STATIC_PATHS: readonly string[] = Object.freeze(["/", "/help", "/verify", "/privacy", "/terms", "/accessibility"]);

/** Never crawl: personal, coordinator, kiosk, admin, and per-letter screens. */
export const ROBOTS_DISALLOW: readonly string[] = Object.freeze([
  "/me/",
  "/impact",
  "/checkin",
  "/join",
  "/onboarding",
  "/login",
  "/org/",
  "/admin",
  "/verify/"
]);

/** "https://pitch.example/" -> "https://pitch.example"; throws on anything but http(s). */
export const normalizeBaseUrl = (raw: string): string => {
  const url = new URL(raw.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`APP_BASE_URL must be an http(s) URL, got "${raw}".`);
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
};

/** Every path the build-time sitemap lists: static screens, then help articles by slug. */
export const sitemapPaths = (helpSlugs: readonly string[]): string[] => [
  ...PUBLIC_STATIC_PATHS,
  ...[...helpSlugs].sort().map((slug) => `/help/${encodeURIComponent(slug)}`)
];

const XML_ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const escapeXml = (value: string): string => value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);

export const buildSitemapXml = (baseUrl: string, paths: readonly string[]): string => {
  const base = normalizeBaseUrl(baseUrl);
  const urls = paths.map((path) => `  <url><loc>${escapeXml(`${base}${path}`)}</loc></url>`);
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, "</urlset>", ""].join("\n");
};

export const buildRobotsTxt = (baseUrl: string): string => {
  const base = normalizeBaseUrl(baseUrl);
  return ["User-agent: *", "Allow: /", ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`), "", `Sitemap: ${base}/sitemap.xml`, ""].join("\n");
};
