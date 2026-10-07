/**
 * useLiveQuery.ts
 * Bridges a Firestore onSnapshot listener into the TanStack Query cache, for
 * reads where live updates matter (roster, my signup status, letters,
 * instance status). The listener writes each snapshot into the cache under
 * `queryKey`, so two components that ask for the same data share one cached
 * value and both re-render on change. The listener is removed on unmount or
 * when the key changes.
 *
 *   const roster = useLiveQuery({
 *     queryKey: ["roster", instanceId],
 *     enabled: Boolean(instanceId),
 *     subscribe: (onData, onError) => listenToRoster(instanceId, onData, onError)
 *   });
 */
import { useEffect, useState } from "react";
import { skipToken, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";

/** Starts a listener; returns its unsubscribe function. */
export type Subscribe<T> = (onData: (data: T) => void, onError: (error: Error) => void) => () => void;

export interface LiveQueryOptions<T> {
  readonly queryKey: QueryKey;
  readonly subscribe: Subscribe<T>;
  readonly enabled?: boolean;
}

export interface LiveQueryResult<T> {
  readonly data: T | undefined;
  readonly error: Error | null;
  /** True until the first snapshot (or an error) arrives. */
  readonly isLoading: boolean;
}

export const useLiveQuery = <T>({ queryKey, subscribe, enabled = true }: LiveQueryOptions<T>): LiveQueryResult<T> => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  // Serialized key: effect re-runs only when the key's content changes, not its array identity.
  const keyHash = JSON.stringify(queryKey);

  useEffect(() => {
    if (!enabled) return undefined;
    setError(null);
    return subscribe(
      (data) => {
        setError(null);
        queryClient.setQueryData(queryKey, data);
      },
      (listenError) => setError(listenError)
    );
    // subscribe and queryKey are captured by content through keyHash on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyHash, enabled, queryClient]);

  // The cache entry is filled only by the listener above, so no fetch function runs.
  const query = useQuery<T>({ queryKey, queryFn: skipToken, staleTime: Infinity, gcTime: 60_000 });
  return {
    data: enabled ? query.data : undefined,
    error: enabled ? error : null,
    isLoading: enabled && query.data === undefined && error === null
  };
};
