/**
 * useClientWrite.ts
 * Pending, success, and error state for the few direct Firestore writes the
 * rules allow (Tier 2 lane B: reviews; SPEC 2.4). Callable
 * ops use useOpRunner with the error catalog; a rules denial has no catalog
 * code, so each caller supplies its own plain-language failure sentence.
 * The raw Firestore error is never shown.
 */
import { useCallback, useState } from "react";

export interface ClientWrite {
  readonly pending: boolean;
  readonly message: string | null;
  readonly error: string | null;
  /** Runs `write`; returns true on success. */
  readonly run: (write: () => Promise<void>, success: string, failure: string) => Promise<boolean>;
}

export const useClientWrite = (): ClientWrite => {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (write: () => Promise<void>, success: string, failure: string): Promise<boolean> => {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      await write();
      setMessage(success);
      return true;
    } catch {
      setError(failure);
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, message, error, run };
};
