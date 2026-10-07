/**
 * index.ts
 * Public barrel for the Help Center library. UI code imports from
 * "@/lib/help" instead of reaching into individual modules.
 */
export { createHelpLibrary, getHelpLibrary, type HelpLibrary } from "./helpLibrary";
export { createHelpSearcher, toSearchableRecord, HELP_FIELD_WEIGHTS } from "./helpSearch";
export { splitHighlights, type HighlightSegment } from "./highlight";
export { parseMarkdown, parseInline, inlineToText, isInternalHref, type BlockNode, type InlineNode } from "./markdown";
export { parseArticle, SLUG_PATTERN } from "./parseArticle";
export { parseFrontMatter } from "./frontMatter";
export { loadHelpArticles, parseArticleFiles } from "./loadArticles";
export { sanitizeRoute, suggestedSlugsForRoute, DEFAULT_SUGGESTIONS } from "./routeContext";
export {
  answerFromHelpCenter,
  COUNTER_THRESHOLD,
  HELP_ANSWER_LABEL,
  MAX_QUESTION_CHARS,
  type HelpAnswer
} from "./answerQuestion";
export type { HelpArticle, HelpRole, HelpSearchHit } from "./types";
