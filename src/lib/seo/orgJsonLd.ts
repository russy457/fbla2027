/**
 * orgJsonLd.ts
 * schema.org Organization structured data for /organizations/:orgId (SPEC 1.2
 * Tier 3: "structured data for org pages"). Only fields the page already
 * shows publicly are included: name, mission, page URL, website, postal
 * address, and the cause areas as knowsAbout. Contact email and phone are
 * left out on purpose (the page does not publish them to crawlers).
 */
export interface OrgForJsonLd {
  readonly name: string;
  readonly mission: string;
  readonly website: string | null;
  readonly address: { readonly line1: string; readonly city: string; readonly state: string; readonly zip: string };
  readonly causeLabels: readonly string[];
}

/** Only http(s) websites become sameAs links. */
const safeHttpUrl = (url: string | null): string | null => {
  if (!url) return null;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
};

export const buildOrganizationJsonLd = (org: OrgForJsonLd, pageUrl: string): Record<string, unknown> => {
  const website = safeHttpUrl(org.website);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: org.name,
    description: org.mission,
    url: pageUrl,
    ...(website ? { sameAs: [website] } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: org.address.line1,
      addressLocality: org.address.city,
      addressRegion: org.address.state,
      postalCode: org.address.zip,
      addressCountry: "US"
    },
    ...(org.causeLabels.length > 0 ? { knowsAbout: [...org.causeLabels] } : {})
  };
};
