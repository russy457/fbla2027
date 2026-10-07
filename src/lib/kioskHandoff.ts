/**
 * kioskHandoff.ts
 * Carries a freshly minted kiosk custom token from "Start kiosk" to the
 * kiosk route on the SAME device, in memory only (a module variable). The token is never put in
 * the URL, history state, or storage, so it cannot leak through a shared
 * link or a later visitor. The kiosk page takes it exactly once, signs the
 * coordinator out, and signs in with it (SPEC#kiosk step 1, 5.10, G15).
 */

interface Handoff {
  readonly instanceId: string;
  readonly customToken: string;
}

let pending: Handoff | null = null;

export const setKioskHandoff = (instanceId: string, customToken: string): void => {
  pending = { instanceId, customToken };
};

/**
 * Returns the token for this instance once, then forgets it, so even a
 * double-run effect (React StrictMode) signs in with it only one time.
 */
export const takeKioskHandoff = (instanceId: string): string | null => {
  if (pending === null || pending.instanceId !== instanceId) return null;
  const { customToken } = pending;
  pending = null;
  return customToken;
};
