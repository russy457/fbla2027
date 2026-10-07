/**
 * seo.test.ts
 * The SEO building blocks (SPEC 1.2 Tier 3): the head manager writes and
 * updates tags without duplicates, route defaults and noindex rules,
 * canonical paths, base URL resolution, robots.txt / sitemap.xml content,
 * and the Organization JSON-LD.
 */
import { afterEach, describe, expect, it } from "vitest";
import { applyHead, resolveBaseUrl, serializeJsonLd } from "./head";
import { buildOrganizationJsonLd } from "./orgJsonLd";
import { canonicalPath, documentTitle, metaForPath } from "./routeMeta";
import { DEFAULT_BASE_URL, ROBOTS_DISALLOW, buildRobotsTxt, buildSitemapXml, normalizeBaseUrl, sitemapPaths } from "./sitemap";

const meta = (selector: string): string | null => document.head.querySelector(selector)?.getAttribute("content") ?? null;

describe("applyHead", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("writes the title, description, canonical, and Open Graph tags", () => {
    applyHead(document, { title: "Help Center | Pitch In", description: "Answers.", url: "https://pitch.example/help", noindex: false });
    expect(document.title).toBe("Help Center | Pitch In");
    expect(meta('meta[name="description"]')).toBe("Answers.");
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://pitch.example/help");
    expect(meta('meta[property="og:title"]')).toBe("Help Center | Pitch In");
    expect(meta('meta[property="og:url"]')).toBe("https://pitch.example/help");
    expect(meta('meta[property="og:type"]')).toBe("website");
    expect(meta('meta[property="og:site_name"]')).toBe("Pitch In");
    expect(meta('meta[name="twitter:card"]')).toBe("summary");
    expect(meta('meta[name="robots"]')).toBeNull();
  });

  it("updates tags in place, adds noindex, and replaces then removes JSON-LD", () => {
    applyHead(document, { title: "A", description: "a", url: "https://x.example/a", noindex: false, jsonLd: { name: "One" } });
    applyHead(document, { title: "B", description: "b", url: "https://x.example/b", noindex: true, jsonLd: { name: "Two" } });
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(meta('meta[name="robots"]')).toBe("noindex");
    const scripts = document.head.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0]?.textContent ?? "{}")).toEqual({ name: "Two" });

    applyHead(document, { title: "C", description: "c", url: "https://x.example/c", noindex: false });
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
    expect(meta('meta[name="robots"]')).toBeNull();
  });

  it("escapes < in JSON-LD so stored text cannot close the script tag", () => {
    expect(serializeJsonLd({ name: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});

describe("route meta", () => {
  it("has public defaults and marks private screens noindex", () => {
    expect(metaForPath("/").title).toBeNull();
    expect(metaForPath("/help")).toMatchObject({ title: "Help Center", noindex: false });
    expect(metaForPath("/organizations/alamo")).toMatchObject({ title: "Organization", noindex: false });
    expect(metaForPath("/me/shifts").noindex).toBe(true);
    expect(metaForPath("/impact/hours/new")).toMatchObject({ title: "Impact", noindex: true });
    expect(metaForPath("/org/alamo/shifts/new")).toMatchObject({ title: "Coordinator", noindex: true });
    expect(metaForPath("/org/register").title).toBe("Register your nonprofit");
    expect(metaForPath("/verify/ABCD-1234").noindex).toBe(true);
    expect(metaForPath("/no/such/page")).toMatchObject({ title: "Page not found", noindex: true });
  });

  it("builds titles and canonical paths", () => {
    expect(documentTitle("Help Center")).toBe("Help Center | Pitch In");
    expect(documentTitle(null)).toMatch(/^Pitch In: /);
    expect(canonicalPath("/explore")).toBe("/");
    expect(canonicalPath("/help/")).toBe("/help");
    expect(canonicalPath("/")).toBe("/");
  });
});

describe("resolveBaseUrl", () => {
  it("prefers APP_BASE_URL, then the page origin, then the local default", () => {
    expect(resolveBaseUrl("https://pitch.example/", "http://localhost:63173")).toBe("https://pitch.example");
    expect(resolveBaseUrl("", "http://localhost:63173")).toBe("http://localhost:63173");
    expect(resolveBaseUrl("not a url", "also bad")).toBe(DEFAULT_BASE_URL);
    expect(resolveBaseUrl(undefined, undefined)).toBe(DEFAULT_BASE_URL);
  });
});

describe("robots.txt and sitemap.xml", () => {
  it("normalizes the base URL and rejects other schemes", () => {
    expect(normalizeBaseUrl(" https://pitch.example/app/ ")).toBe("https://pitch.example/app");
    expect(() => normalizeBaseUrl("ftp://pitch.example")).toThrow(/http/);
  });

  it("lists public screens and help articles, never private screens", () => {
    const paths = sitemapPaths(["waitlist-and-promotion", "kiosk-check-in"]);
    expect(paths).toContain("/");
    expect(paths.slice(-2)).toEqual(["/help/kiosk-check-in", "/help/waitlist-and-promotion"]);
    const xml = buildSitemapXml("https://pitch.example/", paths);
    expect(xml).toContain("<loc>https://pitch.example/help/kiosk-check-in</loc>");
    expect(xml).not.toContain("/me/");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it("escapes XML special characters in URLs", () => {
    expect(buildSitemapXml("https://pitch.example", ["/a&b"])).toContain("https://pitch.example/a&amp;b");
  });

  it("disallows private areas and points at the sitemap", () => {
    const robots = buildRobotsTxt("https://pitch.example");
    for (const path of ROBOTS_DISALLOW) expect(robots).toContain(`Disallow: ${path}`);
    expect(robots).toContain("Sitemap: https://pitch.example/sitemap.xml");
    expect(robots).not.toContain("Disallow: /organizations");
  });
});

describe("buildOrganizationJsonLd", () => {
  const org = {
    name: "Alamo Community Pantry",
    mission: "Feeding families.",
    website: "https://alamo.example",
    address: { line1: "100 Main St", city: "San Antonio", state: "TX", zip: "78205" },
    causeLabels: ["Hunger and food"]
  };

  it("describes the organization with public fields only", () => {
    const data = buildOrganizationJsonLd(org, "https://pitch.example/organizations/alamo");
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Alamo Community Pantry",
      url: "https://pitch.example/organizations/alamo",
      sameAs: ["https://alamo.example"],
      knowsAbout: ["Hunger and food"],
      address: { "@type": "PostalAddress", addressLocality: "San Antonio", postalCode: "78205" }
    });
    expect(JSON.stringify(data)).not.toMatch(/email|telephone/);
  });

  it("drops unsafe websites and empty cause lists", () => {
    const data = buildOrganizationJsonLd({ ...org, website: "javascript:alert(1)", causeLabels: [] }, "https://pitch.example/o");
    expect(data).not.toHaveProperty("sameAs");
    expect(data).not.toHaveProperty("knowsAbout");
    expect(buildOrganizationJsonLd({ ...org, website: "not a url" }, "u")).not.toHaveProperty("sameAs");
    expect(buildOrganizationJsonLd({ ...org, website: null }, "u")).not.toHaveProperty("sameAs");
  });
});
