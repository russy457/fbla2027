/**
 * PageHeader.tsx
 * The h1 and one supporting sentence at the top of each screen. The heading
 * takes tabIndex -1 so focus can be moved to it after route changes and
 * submits (D20 focus restore).
 */
import type { ReactElement, ReactNode } from "react";

interface PageHeaderProps {
  readonly title: string;
  readonly children?: ReactNode;
}

export const PageHeader = ({ title, children }: PageHeaderProps): ReactElement => (
  <header className="flex flex-col gap-2">
    <h1 tabIndex={-1} className="text-3xl font-semibold tracking-tight text-fg outline-none md:text-4xl">
      {title}
    </h1>
    {children ? <p className="max-w-[60ch] text-base text-fg-muted md:text-lg">{children}</p> : null}
  </header>
);
