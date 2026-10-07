/**
 * useReducedMotionPreference.ts
 * True when motion should be skipped: either the operating system asks for
 * reduced motion or the user picked "Reduce motion" in the in-app display
 * preferences (D18). JavaScript animation (motion, GSAP) must check this,
 * because CSS duration tokens only cover CSS transitions.
 */
import { useSyncExternalStore } from "react";
import { usePreferencesStore } from "@/store/preferencesStore";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const hasMatchMedia = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function";

const subscribe = (onChange: () => void): (() => void) => {
  if (!hasMatchMedia()) return () => undefined;
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const getSystemPrefersReduced = (): boolean =>
  hasMatchMedia() && window.matchMedia(REDUCED_MOTION_QUERY).matches;

export const useReducedMotionPreference = (): boolean => {
  const systemPrefersReduced = useSyncExternalStore(subscribe, getSystemPrefersReduced, () => false);
  const userChoice = usePreferencesStore((state) => state.motion);
  return userChoice === "reduced" || systemPrefersReduced;
};
