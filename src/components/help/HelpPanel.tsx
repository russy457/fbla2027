/**
 * HelpPanel.tsx
 * The quick help slide-over (SPEC 9.6: "openable from any page"). A modal
 * dialog on the right edge with: search, articles suggested for the current
 * route, an in-place article reader, and the Ask box. Focus is trapped while
 * it is open and Escape or the close button dismisses it. The opener
 * (HelpPanelLauncher) owns open state and focus restore.
 *
 * Articles open inside the panel so the user keeps their place in the app;
 * "Open in Help Center" goes to the full page.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ArrowLeft, ArrowSquareOut, X } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { buttonClassName } from "@/components/ui/buttonStyles";
import type { HelpLibrary } from "@/lib/help";
import { ArticleResultList } from "./ArticleResultList";
import { ArticleView } from "./ArticleView";
import { AssistantPanel } from "./AssistantPanel";
import { articlePath, type RenderArticleLink } from "./articleLinks";
import { NoResults } from "./NoResults";
import { SearchField } from "./SearchField";
import { SearchStatus } from "./SearchStatus";
import { useFocusTrap } from "./useFocusTrap";

interface HelpPanelProps {
  readonly library: HelpLibrary;
  /** Current route, used for "Suggested for this page". */
  readonly pathname: string;
  readonly onClose: () => void;
}

const TITLE_ID = "help-panel-title";

export const HelpPanel = ({ library, pathname, onClose }: HelpPanelProps): ReactElement => {
  const [query, setQuery] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  useFocusTrap({ containerRef: dialogRef, initialFocusRef: searchRef, onEscape: onClose });

  // The link that opened an article unmounts, so move focus to Back instead of losing it.
  useEffect(() => {
    if (openSlug) backRef.current?.focus();
  }, [openSlug]);

  const hits = useMemo(() => library.search(query), [library, query]);
  const suggestions = useMemo(() => library.suggestionsFor(pathname), [library, pathname]);
  const openArticle = openSlug ? library.getArticle(openSlug) : undefined;

  // Inside the panel, article links swap the reader in place instead of navigating.
  const renderInPanel = useCallback<RenderArticleLink>(
    (article, content, className) => (
      <button type="button" className={className} onClick={() => setOpenSlug(article.slug)}>
        {content}
      </button>
    ),
    []
  );

  const renderSearchBody = (): ReactElement => {
    if (query.trim() === "") {
      return (
        <section aria-labelledby="help-panel-suggested" className="flex flex-col gap-1">
          <h3 id="help-panel-suggested" className="text-sm font-semibold text-fg-muted">
            Suggested for this page
          </h3>
          <ArticleResultList articles={suggestions} renderLink={renderInPanel} label="Suggested articles" compact />
        </section>
      );
    }
    if (hits.length === 0) {
      const browseLink = (
        <Link to="/help" className={buttonClassName("secondary", "self-start")}>
          Browse all topics
        </Link>
      );
      return <NoResults query={query} action={browseLink} />;
    }
    return (
      <ArticleResultList
        articles={hits.map((hit) => hit.article)}
        terms={hits[0]?.matchedTerms ?? []}
        renderLink={renderInPanel}
        label="Search results"
        compact
      />
    );
  };
  const searchBody = renderSearchBody();

  const closeArticle = () => {
    setOpenSlug(null);
    // Return focus to the search box so keyboard users are not dropped at the top.
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  return (
    <div className="fixed inset-0 z-(--z-overlay)">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-fg/40" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-lg transition-transform duration-(--duration-base) ease-out starting:translate-x-full"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 id={TITLE_ID} className="text-lg font-semibold tracking-tight text-fg">
            Quick help
          </h2>
          <button type="button" onClick={onClose} aria-label="Close help" className={buttonClassName("quiet", "px-0")}>
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-8 overflow-y-auto overscroll-contain px-5 py-5">
          {openArticle ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button ref={backRef} type="button" onClick={closeArticle} className={buttonClassName("secondary")}>
                  <ArrowLeft aria-hidden="true" size={16} />
                  Back
                </button>
                <Link to={articlePath(openArticle.slug)} className={buttonClassName("quiet")}>
                  Open in Help Center
                  <ArrowSquareOut aria-hidden="true" size={16} />
                </Link>
              </div>
              <ArticleView article={openArticle} library={library} titleLevel={3} renderLink={renderInPanel} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <SearchField ref={searchRef} id="help-panel-search" label="Search help" value={query} onChange={setQuery} />
              <SearchStatus query={query} resultCount={hits.length} />
              {searchBody}
            </div>
          )}

          <div className="border-t border-border pt-6">
            <AssistantPanel library={library} renderLink={renderInPanel} headingLevel={3} />
          </div>
        </div>

        <footer className="border-t border-border px-5 py-3 text-xs text-fg-muted">
          Press <kbd className="rounded-sm border border-border-strong px-1 font-mono">?</kbd> to open help,{" "}
          <kbd className="rounded-sm border border-border-strong px-1 font-mono">Esc</kbd> to close.
        </footer>
      </div>
    </div>
  );
};
