/**
 * RouteError.tsx
 * React Router errorElement. Shown when a route fails to load or render, for
 * example when a lazy chunk still fails after lazyWithReload's single retry.
 */
import type { ReactElement } from "react";
import { ErrorState } from "./ErrorState";

export const RouteError = (): ReactElement => (
  <main id="main" className="mx-auto w-full max-w-3xl px-4 py-16">
    <ErrorState
      title="This screen could not load"
      description="Check your connection, then reload. If you just updated the app, a reload picks up the new version."
      actionLabel="Reload page"
      onAction={() => window.location.reload()}
    />
  </main>
);
