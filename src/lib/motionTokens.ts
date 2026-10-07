/**
 * motionTokens.ts
 * Lets JavaScript animation (GSAP, motion) read the same duration tokens that
 * CSS uses, so the team's future design doc can retime every animation from
 * src/styles/tokens.css alone.
 */

export type DurationToken = "--duration-fast" | "--duration-base" | "--duration-slow";

/** Parses "240ms" or "0.24s" into seconds. Returns null for anything else. */
export const parseCssDurationSeconds = (value: string): number | null => {
  const trimmed = value.trim();
  const match = /^(-?\d*\.?\d+)(ms|s)$/.exec(trimmed);
  if (!match) return null;
  const amount = Number(match[1]);
  return match[2] === "ms" ? amount / 1000 : amount;
};

/** Reads a duration token from <html> in seconds, with a fallback for tests and SSR. */
export const readDurationSeconds = (token: DurationToken, fallbackSeconds: number): number => {
  if (typeof document === "undefined") return fallbackSeconds;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token);
  return parseCssDurationSeconds(raw) ?? fallbackSeconds;
};
