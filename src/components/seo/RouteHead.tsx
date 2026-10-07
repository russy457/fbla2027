/**
 * RouteHead.tsx
 * Keeps <head> in step with the current route (SPEC 1.2 Tier 3 SEO): the
 * title, description, robots rule, canonical URL, and Open Graph tags come
 * from the route table (src/lib/seo/routeMeta.ts), refined by the screen
 * (usePageHead) when it has its own data. Help articles are titled from the
 * bundled article itself. Canonical URLs use APP_BASE_URL, so the deployed
 * site's links are absolute and never point at a preview host.
 * Renders nothing; mounted once in AppLayout.
 */
import { useEffect } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { getHelpLibrary } from "@/lib/help";
import { applyHead, resolveBaseUrl } from "@/lib/seo/head";
import { canonicalPath, documentTitle, metaForPath, type RouteMeta } from "@/lib/seo/routeMeta";
import { clampDescription, usePageHeadStore, type PageHeadOverride } from "./pageHead";

/** A help article's own title and summary for /help/:slug. */
const helpArticleMeta = (pathname: string, fallback: RouteMeta): RouteMeta => {
  const slug = matchPath("/help/:slug", pathname)?.params.slug;
  const article = slug ? getHelpLibrary().getArticle(slug) : undefined;
  return article ? { ...fallback, title: article.title, description: article.summary } : fallback;
};

export const RouteHead = (): null => {
  const { pathname } = useLocation();
  const overridePath = usePageHeadStore((state) => state.pathname);
  const storedOverride = usePageHeadStore((state) => state.override);
  const override: PageHeadOverride | null = overridePath === pathname ? storedOverride : null;

  useEffect(() => {
    const routeMeta = helpArticleMeta(pathname, metaForPath(pathname));
    const baseUrl = resolveBaseUrl(import.meta.env.APP_BASE_URL, window.location.origin);
    applyHead(document, {
      title: documentTitle(override?.title ?? routeMeta.title),
      description: clampDescription(override?.description ?? routeMeta.description),
      url: `${baseUrl}${canonicalPath(pathname)}`,
      noindex: routeMeta.noindex,
      ogType: override?.ogType,
      jsonLd: override?.jsonLd ?? null
    });
  }, [pathname, override]);

  return null;
};
