/**
 * HelpHome.tsx
 * The Help Center landing view at /help (SPEC 9.2: search box, matching
 * articles, assistant panel). The query lives in the URL (?q=) so a search
 * can be shared or restored with Back. With no query the page shows every
 * topic grouped by audience; with no matches it shows the D6 empty state
 * followed by the same topic index as the way forward.
 */
import { useMemo, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { APP_NAME } from "@/lib/brand";
import { PageHeader } from "@/components/ui/PageHeader";
import type { HelpLibrary } from "@/lib/help";
import { ArticleResultList } from "./ArticleResultList";
import { AssistantPanel } from "./AssistantPanel";
import { NoResults } from "./NoResults";
import { SearchField } from "./SearchField";
import { SearchStatus } from "./SearchStatus";
import { TopicBrowser } from "./TopicBrowser";

interface HelpHomeProps {
  readonly library: HelpLibrary;
}

/** Longest query we keep in the URL; longer input is trimmed, not rejected. */
const MAX_QUERY_LENGTH = 200;

export const HelpHome = ({ library }: HelpHomeProps): ReactElement => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").slice(0, MAX_QUERY_LENGTH);
  const hits = useMemo(() => library.search(query), [library, query]);
  const hasQuery = query.trim() !== "";

  // replace: typing should not add one history entry per keystroke.
  const handleQueryChange = (next: string) =>
    setSearchParams(next ? { q: next.slice(0, MAX_QUERY_LENGTH) } : {}, { replace: true });

  const renderResults = (): ReactElement => {
    if (!hasQuery) return <TopicBrowser library={library} />;
    if (hits.length === 0) {
      return (
        <div className="flex flex-col gap-10">
          <NoResults query={query} />
          <TopicBrowser library={library} />
        </div>
      );
    }
    return (
      <ArticleResultList
        articles={hits.map((hit) => hit.article)}
        terms={hits[0]?.matchedTerms ?? []}
        label="Search results"
      />
    );
  };

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Help Center">Step-by-step answers for volunteers and coordinators using {APP_NAME}.</PageHeader>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-14">
        <section aria-label="Article search" className="flex min-w-0 flex-col gap-4">
          <SearchField
            id="help-search"
            label="Search help articles"
            hint='Try "check in", "verified letter", or "text size".'
            value={query}
            onChange={handleQueryChange}
          />
          <SearchStatus query={query} resultCount={hits.length} />
          {renderResults()}
        </section>

        <aside className="self-start rounded-lg bg-surface-sunken p-5 lg:sticky lg:top-24">
          <AssistantPanel library={library} />
        </aside>
      </div>
    </div>
  );
};
