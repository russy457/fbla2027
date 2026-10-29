import { useCallback, useSyncExternalStore } from "react";

/** A small shared matchMedia subscription for responsive behavior that changes markup. */
export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback((notify: () => void): (() => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
    const media = window.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  }, [query]);
  const getSnapshot = useCallback(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};
