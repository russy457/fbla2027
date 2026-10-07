/**
 * ScreenPlaceholder.tsx
 * Honest stand-in for a screen that has not been built yet: one heading and
 * one sentence saying what the screen will do. Lets the router, navigation,
 * and accessibility checks run before Tier 0 features land.
 */
import type { ReactElement, ReactNode } from "react";

interface ScreenPlaceholderProps {
  title: string;
  children: ReactNode;
}

export const ScreenPlaceholder = ({ title, children }: ScreenPlaceholderProps): ReactElement => (
  <section aria-labelledby="screen-title" className="flex max-w-2xl flex-col gap-3">
    <h1 id="screen-title" className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">
      {title}
    </h1>
    <p className="max-w-[60ch] text-lg text-fg-muted">{children}</p>
  </section>
);
