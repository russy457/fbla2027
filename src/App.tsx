/**
 * App.tsx
 * Root component: error boundary, TanStack Query cache, the app-wide
 * session listeners (Firebase Auth and the demo clock), and the router.
 * Providers that every screen needs are added here and nowhere else.
 */
import { useState, type ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAuthListener } from "./hooks/useAuthListener";
import { useDemoClockSync } from "./hooks/useDemoClockSync";
import { createAppRouter } from "./router";

const QUERY_STALE_TIME_MS = 30_000;

const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: QUERY_STALE_TIME_MS, retry: 1, refetchOnWindowFocus: false }
    }
  });

/** Mounts the single Auth subscription and the demo clock listener (renders nothing). */
const SessionSync = (): null => {
  useAuthListener();
  useDemoClockSync();
  return null;
};

export const App = (): ReactElement => {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(createAppRouter);
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SessionSync />
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
};
