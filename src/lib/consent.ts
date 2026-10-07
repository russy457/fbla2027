/**
 * consent.ts
 * Cookie and analytics consent choice (GDPR/CCPA style). Analytics stays off
 * until the visitor opts in. The choice persists in localStorage; null means
 * "not asked yet" (show the banner). Ported from the old app with a new
 * storage key, and reads are now guarded too because private browsing can
 * throw on localStorage access.
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
