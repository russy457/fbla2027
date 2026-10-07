/**
 * head.ts
 * A very small head manager (SPEC 1.2 Tier 3 SEO; replaces the old app's
 * react-helmet-async SeoMeta with no new dependency). applyHead writes one
 * page's tags into <head>, updating the tags it owns in place so repeated
 * calls never duplicate them:
 *
 *   <title>, meta description, meta robots (noindex screens only),
 *   link rel=canonical, Open Graph (og:title, og:description, og:url,
 *   og:type, og:site_name), twitter:card, and one JSON-LD block
 *
 * index.html ships static defaults for the same tags so link previews that
 * do not run JavaScript still get a title and description.
 */
import { APP_NAME } from "@/lib/brand";
import { DEFAULT_BASE_URL, normalizeBaseUrl } from "./sitemap";

export interface HeadData {
  readonly title: string;
  readonly description: string;
  /** Absolute canonical URL. */
  readonly url: string;
  readonly noindex: boolean;
  readonly ogType?: "website" | "article";
  /** Structured data for this page (schema.org), or none. */
  readonly jsonLd?: Readonly<Record<string, unknown>> | null;
}

const JSON_LD_ATTRIBUTE = "data-head-json-ld";

/**
 * The site's public origin: APP_BASE_URL (exposed to the build by
 * vite.config.ts) when set, else the origin the page was served from.
 */
export const resolveBaseUrl = (configured: string | undefined, fallbackOrigin: string | undefined): string => {
  for (const candidate of [configured, fallbackOrigin, DEFAULT_BASE_URL]) {
    if (!candidate || candidate.trim() === "") continue;
    try {
      return normalizeBaseUrl(candidate);
    } catch {
      // A malformed value falls through to the next candidate.
    }
  }
  return DEFAULT_BASE_URL;
};

const upsertMeta = (doc: Document, key: "name" | "property", keyValue: string, content: string | null): void => {
  const existing = doc.head.querySelector<HTMLMetaElement>(`meta[${key}="${keyValue}"]`);
  if (content === null) {
    existing?.remove();
    return;
  }
  const meta = existing ?? doc.head.appendChild(doc.createElement("meta"));
  meta.setAttribute(key, keyValue);
  meta.setAttribute("content", content);
};

const upsertCanonical = (doc: Document, href: string): void => {
  const link = doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? doc.head.appendChild(doc.createElement("link"));
  link.setAttribute("rel", "canonical");
  link.setAttribute("href", href);
};

/** JSON for a <script> body: "<" is escaped so data can never close the tag. */
export const serializeJsonLd = (data: Readonly<Record<string, unknown>>): string => JSON.stringify(data).replace(/</g, "\\u003c");

const upsertJsonLd = (doc: Document, data: Readonly<Record<string, unknown>> | null | undefined): void => {
  const existing = doc.head.querySelector<HTMLScriptElement>(`script[${JSON_LD_ATTRIBUTE}]`);
  if (!data) {
    existing?.remove();
    return;
  }
  const script = existing ?? doc.head.appendChild(doc.createElement("script"));
  script.setAttribute("type", "application/ld+json");
  script.setAttribute(JSON_LD_ATTRIBUTE, "");
  script.textContent = serializeJsonLd(data);
};

export const applyHead = (doc: Document, head: HeadData): void => {
  doc.title = head.title;
  upsertMeta(doc, "name", "description", head.description);
  upsertMeta(doc, "name", "robots", head.noindex ? "noindex" : null);
  upsertCanonical(doc, head.url);
  upsertMeta(doc, "property", "og:title", head.title);
  upsertMeta(doc, "property", "og:description", head.description);
  upsertMeta(doc, "property", "og:url", head.url);
  upsertMeta(doc, "property", "og:type", head.ogType ?? "website");
  upsertMeta(doc, "property", "og:site_name", APP_NAME);
  upsertMeta(doc, "name", "twitter:card", "summary");
  upsertJsonLd(doc, head.jsonLd);
};
