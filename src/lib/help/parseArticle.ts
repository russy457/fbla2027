/**
 * parseArticle.ts
 * Turns one raw Markdown help file into a validated HelpArticle.
 *
 * Front matter must provide slug, title, summary, tags, and roles. Every
 * article ends with a "## Related articles" section that lists other slugs,
 * one per bullet; that section is lifted out of the body into `related` so the
 * UI can show real titles and links instead of bare slugs.
 */
import { parseFrontMatter, type FrontMatterValue } from "./frontMatter";
import { HELP_ROLES, type HelpArticle, type HelpRole } from "./types";

/** Lowercase words joined by single hyphens, e.g. "kiosk-check-in". */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RELATED_HEADING = /^##\s+Related articles\s*$/im;
const BULLET = /^[-*]\s+(.+)$/;

const requireString = (value: FrontMatterValue | undefined, key: string, source: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${source}: front matter "${key}" must be a non-empty string.`);
  }
  return value;
};

/** Accept either "tags: [a, b]" or a single "tags: a". */
const toList = (value: FrontMatterValue | undefined): readonly string[] => {
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : value;
};

const isHelpRole = (value: string): value is HelpRole => (HELP_ROLES as readonly string[]).includes(value);

const parseRoles = (value: FrontMatterValue | undefined, source: string): readonly HelpRole[] => {
  const roles = toList(value);
  if (roles.length === 0) throw new Error(`${source}: front matter "roles" is required.`);
  const invalid = roles.filter((role) => !isHelpRole(role));
  if (invalid.length > 0) {
    throw new Error(`${source}: unknown role(s) ${invalid.join(", ")}. Use volunteer, coordinator, or all.`);
  }
  return roles as readonly HelpRole[];
};

/**
 * Split the trailing related-articles section from the body.
 * Returns the body without that section and the list of slugs it named.
 */
export const extractRelated = (body: string, source: string): { body: string; related: readonly string[] } => {
  const match = RELATED_HEADING.exec(body);
  if (!match) return { body, related: [] };

  const sectionLines = body.slice(match.index + match[0].length).split("\n");
  const related = sectionLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const bullet = BULLET.exec(line);
      const slug = bullet?.[1]?.trim() ?? "";
      if (!SLUG_PATTERN.test(slug)) {
        throw new Error(`${source}: related article "${line}" must be a bullet with a slug.`);
      }
      return slug;
    });

  return { body: body.slice(0, match.index).trim(), related };
};

/** Parse and validate one article. Throws a message naming the file on any problem. */
export const parseArticle = (raw: string, source = "article"): HelpArticle => {
  const { data, body } = parseFrontMatter(raw, source);
  const slug = requireString(data.slug, "slug", source);
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`${source}: slug "${slug}" must be lowercase words joined by hyphens.`);
  }
  const { body: content, related } = extractRelated(body, source);

  return Object.freeze({
    slug,
    title: requireString(data.title, "title", source),
    summary: requireString(data.summary, "summary", source),
    tags: Object.freeze([...toList(data.tags)]),
    roles: Object.freeze([...parseRoles(data.roles, source)]),
    related: Object.freeze(related.filter((relatedSlug) => relatedSlug !== slug)),
    body: content
  });
};
