/**
 * useAuthListener.ts
 * The app's single Firebase Auth subscription. Mounted once in App.tsx; it
 * keeps src/store/authStore.ts in sync with the current ID token, including
 * custom claims (admin, kiosk). onIdTokenChanged (not onAuthStateChanged) is
 * used so a refreshed token with new claims also updates the store.
 */
import { useEffect } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { getFirebase } from "@/lib/firebase";
import { sessionFromClaims, useAuthStore } from "@/store/authStore";

export const useAuthListener = (): void => {
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    let auth;
    try {
      auth = getFirebase().auth;
    } catch {
      // Env is incomplete; DevEnvironmentBanner explains it. Treat as signed out.
      setSession({ status: "signed-out" });
      return undefined;
    }
    let isActive = true;
    const unsubscribe = onIdTokenChanged(auth, (user) => {
      if (!user) {
        setSession({ status: "signed-out" });
        return;
      }
      user
        .getIdTokenResult()
        .then((token) => {
          if (isActive) setSession(sessionFromClaims(user.uid, user.email, token.claims));
        })
        .catch(() => {
          // Without claims we cannot tell a kiosk from a person; fail closed as a plain user.
          if (isActive) setSession({ status: "user", user: { uid: user.uid, email: user.email, isAdmin: false } });
        });
    });
    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [setSession]);
};
