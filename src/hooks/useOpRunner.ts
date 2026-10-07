/**
 * useOpRunner.ts
 * Pending, result, and error state for trusted writes on coordinator and
 * admin screens (SPEC 5.1 "no optimistic UI", D22 errors). `run(key, call,
 * successMessage)` marks `key` pending until the op returns, then sets a
 * status message (announced by a role=status line) or the friendly
 * UserError. The screen re-renders from Firestore listeners, never from a
 * guessed local state.
 */
import { useCallback, useState } from "react";
import type { UserError } from "@fbla/shared";
import { ApiError, NETWORK_USER_ERROR } from "@/lib/api";

export interface OpRunner {
  readonly pending: string | null;
  readonly message: string | null;
  readonly error: UserError | null;
  readonly run: <T>(key: string, call: () => Promise<T>, success: (result: T) => string) => Promise<T | null>;
  readonly reset: () => void;
}

export const toUserErrorOrNetwork = (error: unknown): UserError => (error instanceof ApiError ? error.userError : NETWORK_USER_ERROR);

export const useOpRunner = (): OpRunner => {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<UserError | null>(null);

  const run = useCallback(async <T>(key: string, call: () => Promise<T>, success: (result: T) => string): Promise<T | null> => {
    setPending(key);
    setError(null);
    setMessage(null);
    try {
      const result = await call();
      setMessage(success(result));
      return result;
    } catch (runError) {
      setError(toUserErrorOrNetwork(runError));
      return null;
    } finally {
      setPending(null);
    }
  }, []);

  const reset = useCallback(() => {
    setMessage(null);
    setError(null);
  }, []);

  return { pending, message, error, run, reset };
};
