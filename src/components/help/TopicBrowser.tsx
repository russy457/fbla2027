/**
 * TopicBrowser.tsx
 * Browse every article grouped by audience (everyone, volunteers,
 * coordinators). Shown when the search box is empty and as the way forward
 * from the "No articles match" empty state (D6). Laid out as an index: the
 * group heading sits beside its list on wide screens and above it on phones.
 */
import type { ReactElement } from "react";
import type { HelpLibrary, HelpRole } from "@/lib/help";
import { ArticleResultList } from "./ArticleResultList";
import { renderPageArticleLink, type RenderArticleLink } from "./articleLinks";

const GROUPS: ReadonlyArray<{ role: HelpRole; title: string; blurb: string }> = [
  { role: "all", title: "Using the app", blurb: "Basics, privacy, and fixes" },
  { role: "volunteer", title: "Volunteering", blurb: "Shifts, check-in, and letters" },
  { role: "coordinator", title: "Running shifts", blurb: "Kiosk, hours, and your organization" }
];

interface TopicBrowserProps {
  readonly library: HelpLibrary;
  readonly renderLink?: RenderArticleLink;
  /** Heading level for group titles so the outline nests correctly. */
  readonly headingLevel?: 2 | 3;
}

export const TopicBrowser = ({
  library,
  renderLink = renderPageArticleLink,
  headingLevel = 2
}: TopicBrowserProps): ReactElement => {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="flex flex-col gap-10">
      {GROUPS.map(({ role, title, blurb }) => {
        const articles = library.byPrimaryRole(role);
        if (articles.length === 0) return null;
        const headingId = `help-topic-${role}`;
        return (
          <section key={role} aria-labelledby={headingId} className="grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8">
            <div className="flex flex-col gap-1 md:pt-4">
              <Heading id={headingId} className="text-lg font-semibold tracking-tight text-fg">
                {title}
              </Heading>
              <p className="text-sm text-fg-muted">{blurb}</p>
            </div>
            <ArticleResultList articles={articles} renderLink={renderLink} label={`${title} articles`} />
          </section>
        );
      })}
    </div>
  );
};
