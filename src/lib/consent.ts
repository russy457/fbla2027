/**
 * consent.ts
 * Cookie and analytics consent choice (GDPR/CCPA style). Ported from the old
 * app with a new storage key; reads are guarded because private browsing can
 * throw on localStorage access. null means "not asked yet" (show the banner).
 *
 *   "granted"  the visitor allowed optional storage (analytics)
 *   "denied"   essential storage only
 *
 * Today the app stores only essential data (sign-in session, display
 * preferences, this choice) and ships no analytics, so the banner
 * (src/components/CookieConsent.tsx) explains that and its "Got it" records
 * "denied". Anything optional added later must check hasOptionalConsent()
 * first AND change CONSENT_STORAGE_KEY, so everyone is asked again.
 */
export const CONSENT_STORAGE_KEY = "fbla2027:cookie-consent";

export type ConsentChoice = "granted" | "denied";

export const getConsent = (): ConsentChoice | null => {
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
};

export const setConsent = (choice: ConsentChoice): void => {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Storage unavailable (private mode): the choice simply will not persist.
  }
};

/** True only after an explicit opt-in: the gate for any non-essential storage or analytics. */
export const hasOptionalConsent = (): boolean => getConsent() === "granted";
