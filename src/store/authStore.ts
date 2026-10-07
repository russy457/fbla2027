/**
 * authStore.ts
 * The signed-in session as the UI sees it: who is signed in and which custom
 * claims their ID token carries (SPEC#roles 4.1). Written only by
 * useAuthListener (one Firebase onIdTokenChanged subscription for the whole
 * app); every screen and route guard reads from here.
 *
 * Kinds of session:
 *   loading     Firebase has not reported yet (guards show a skeleton)
 *   signed-out  no user
 *   user        a person (volunteer, coordinator, admin)
 *   kiosk       a kiosk custom token scoped to one shift (G15)
 */
import { create } from "zustand";

export interface KioskClaim {
  readonly instanceId: string;
  readonly orgId: string;
  /** Token expiry in epoch ms (claim kioskExp). */
  readonly expMs: number;
}

export interface SessionUser {
  readonly uid: string;
  readonly email: string | null;
  readonly isAdmin: boolean;
}

export type Session =
  | { readonly status: "loading" }
  | { readonly status: "signed-out" }
  | { readonly status: "user"; readonly user: SessionUser }
  | { readonly status: "kiosk"; readonly uid: string; readonly kiosk: KioskClaim };

interface AuthState {
  readonly session: Session;
  readonly setSession: (session: Session) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  session: { status: "loading" },
  setSession: (session) => set({ session })
}));

/** Reads kiosk claims from decoded token claims, or null for a person's token. */
export const readKioskClaim = (claims: Readonly<Record<string, unknown>>): KioskClaim | null => {
  const { kioskInstanceId, kioskOrgId, kioskExp } = claims;
  if (typeof kioskInstanceId !== "string") return null;
  return {
    instanceId: kioskInstanceId,
    orgId: typeof kioskOrgId === "string" ? kioskOrgId : "",
    expMs: typeof kioskExp === "number" ? kioskExp : 0
  };
};

/** Builds the Session for a signed-in Firebase user from their token claims. */
export const sessionFromClaims = (
  uid: string,
  email: string | null,
  claims: Readonly<Record<string, unknown>>
): Session => {
  const kiosk = readKioskClaim(claims);
  if (kiosk) return { status: "kiosk", uid, kiosk };
  return { status: "user", user: { uid, email, isAdmin: claims.admin === true } };
};

/** The signed-in person, or null for signed-out, loading, and kiosk sessions. */
export const useSessionUser = (): SessionUser | null =>
  useAuthStore((state) => (state.session.status === "user" ? state.session.user : null));

export const useSession = (): Session => useAuthStore((state) => state.session);
