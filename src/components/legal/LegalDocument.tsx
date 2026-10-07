/**
 * LegalDocument.tsx
 * Shared layout for the Privacy, Terms, and Accessibility pages: an h1 that
 * takes focus after navigation (D20), a "Last updated" line, a table of
 * contents with in-page anchors, and one h2 section per topic. Pages pass
 * their sections as data so each page file stays copy only.
 */
import type { ReactElement, ReactNode } from "react";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";

export interface LegalSection {
  /** Anchor id, used in the table of contents link (#id). */
  readonly id: string;
  readonly heading: string;
  readonly body: ReactNode;
}

interface LegalDocumentProps {
  readonly title: string;
  readonly intro: ReactNode;
  readonly sections: ReadonlyArray<LegalSection>;
}

const formatUpdated = (isoDate: string): string => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  });
};

const LINK_CLASS = "font-medium text-accent underline underline-offset-2 hover:text-accent-hover";

export const LegalDocument = ({ title, intro, sections }: LegalDocumentProps): ReactElement => (
  <article aria-labelledby="legal-title" className="flex max-w-[68ch] flex-col gap-8">
    <header className="flex flex-col gap-3">
      <h1 id="legal-title" tabIndex={-1} className="text-3xl font-semibold tracking-tight text-fg outline-none md:text-4xl">
        {title}
      </h1>
      <p className="text-sm text-fg-muted">
        Last updated <time dateTime={LEGAL_LAST_UPDATED}>{formatUpdated(LEGAL_LAST_UPDATED)}</time>
      </p>
      <div className="text-lg text-fg-muted">{intro}</div>
    </header>

    <nav aria-labelledby="legal-toc-title" className="rounded-md border border-border bg-surface-sunken p-4">
      <h2 id="legal-toc-title" className="text-sm font-semibold text-fg">
        On this page
      </h2>
      <ol className="mt-2 flex list-decimal flex-col gap-1 pl-6 text-fg">
        {sections.map(({ id, heading }) => (
          <li key={id} className="pl-1 marker:text-fg-subtle">
            <a href={`#${id}`} className={`inline-flex min-h-touch items-center ${LINK_CLASS}`}>
              {heading}
            </a>
          </li>
        ))}
      </ol>
    </nav>

    {sections.map(({ id, heading, body }) => (
      <section key={id} id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
        <h2 id={`${id}-heading`} className="text-xl font-semibold tracking-tight text-fg">
          {heading}
        </h2>
        <div className="mt-3 flex flex-col gap-3 text-fg [&_li]:pl-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-6">
          {body}
        </div>
      </section>
    ))}
  </article>
);
