/**
 * ErrorBoundary.tsx
 * App-level React error boundary. Catches render errors anywhere below it and
 * shows the ErrorState panel with a reload button instead of a blank page.
 * Ported from the old app. It stays a class component because React 18 has no
 * hook equivalent of getDerivedStateFromError / componentDidCatch.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "./ErrorState";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Called with the error for reporting. Defaults to console.error. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

const reportError = (error: Error, info: ErrorInfo): void => {
  // Diagnostics for developers; a monitoring service can replace this later.
  console.error("Unhandled UI error:", error, info.componentStack);
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    (this.props.onError ?? reportError)(error, info);
  }

  private readonly handleReload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-16">
        <ErrorState
          title="Something went wrong"
          description="An unexpected error interrupted this page. Reloading usually fixes it."
          actionLabel="Reload page"
          onAction={this.handleReload}
        />
      </main>
    );
  }
}
