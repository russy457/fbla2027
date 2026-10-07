/**
 * ScreenPlaceholder.tsx
 * Honest stand-in for a screen that has not been built yet: one heading and
 * one sentence saying what the screen will do. Lets the router, navigation,
 * and accessibility checks run before Tier 0 features land.
 */
import type { ReactElement, ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";

interface ScreenPlaceholderProps {
  title: string;
  children: ReactNode;
}

export const ScreenPlaceholder = ({ title, children }: ScreenPlaceholderProps): ReactElement => (
  <section aria-labelledby="screen-title" className="w-full max-w-4xl">
    <PageHeader id="screen-title" title={title}>{children}</PageHeader>
  </section>
);
