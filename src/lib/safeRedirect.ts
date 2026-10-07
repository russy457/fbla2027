/**
 * safeRedirect.ts
 * Reads a "?next=" return path and accepts only paths inside this app, so a
 * crafted link cannot send someone to another site after they sign in
 * (open redirect protection).
 */
export const safeNextPath = (raw: string | null, fallback = "/"): string => {
  if (!raw) return fallback;
  // Must be a single-slash app path: "/me/shifts" yes; "//evil.test" or "https://..." no.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw;
};
