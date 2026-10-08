/**
 * PageHeader.tsx
 * The h1 and one supporting sentence at the top of each screen. The heading
 * takes tabIndex -1 so focus can be moved to it after route changes and
 * submits (D20 focus restore).
 */
import type { ReactElement, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { pageVisualFor } from "@/content/pageVisuals";

interface PageHeaderProps {
  readonly title: string;
  readonly children?: ReactNode;
  readonly level?: 1 | 2;
  readonly id?: string;
}

export const PageHeader = ({ title, children, level = 1, id }: PageHeaderProps): ReactElement => {
  const Heading = level === 1 ? "h1" : "h2";
  const { pathname } = useLocation();
  const visual = pageVisualFor(pathname);
  if (level === 1) {
    return (
      <header className="page-hero">
        <div className="page-hero__copy">
          <p className="page-hero__eyebrow">{visual.eyebrow}</p>
          <Heading id={id} tabIndex={-1} className="page-hero__title outline-none">{title}</Heading>
          {children ? <div className="page-hero__intro">{children}</div> : null}
        </div>
      </header>
    );
  }
  return (
  <header className="flex flex-col gap-2">
    <Heading id={id} className="text-3xl font-semibold text-fg outline-none md:text-4xl">
      {title}
    </Heading>
    {children ? <p className="max-w-[60ch] text-base text-fg-muted md:text-lg">{children}</p> : null}
  </header>
  );
};
