/**
 * authClient.ts
 * Thin wrappers over Firebase Auth for the few things the app does with it:
 * email/password sign-in, Google sign-in, account creation (onboarding step 2),
 * sign-out, and switching a device into kiosk mode with a custom token (G15). Errors are
 * mapped to plain, age-appropriate sentences; raw Firebase codes never reach
 * the screen.
 */
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { readClientEnv } from "./env";
import { getFirebase } from "./firebase";

/** Error with a sentence that is safe to show as-is. */
export class AuthFormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthFormError";
  }
}

const AUTH_MESSAGES: Readonly<Record<string, string>> = {
  "auth/invalid-credential": "That email and password don't match. Check them and try again.",
  "auth/wrong-password": "That email and password don't match. Check them and try again.",
  "auth/user-not-found": "That email and password don't match. Check them and try again.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Use at least 8 characters for your password.",
  "auth/too-many-requests": "Too many tries. Wait a minute, then try again.",
  "auth/network-request-failed": "We couldn't reach the server. Check your connection and try again.",
  "auth/user-disabled": "This account is turned off. Ask an admin for help.",
  "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow pop-ups for this site, then try again.",
  "auth/account-exists-with-different-credential": "This email already has an account. Sign in with your email and password.",
  "auth/operation-not-allowed": "Google sign-in isn't turned on for this app yet. Use your email and password."
};

/** Codes for a person closing the Google window themselves: not an error worth showing. */
const POPUP_CANCELLED = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

const FALLBACK_MESSAGE = "We couldn't sign you in. Try again.";

/** Maps a Firebase Auth error to a friendly sentence. */
export const authErrorMessage = (error: unknown): string => {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  if (code === "auth/network-request-failed") {
    const env = readClientEnv();
    if (env.ok && env.env.VITE_USE_EMULATORS) return "Local sign-in service is offline. Run npm run demo:restart in a terminal.";
  }
  return typeof code === "string" ? (AUTH_MESSAGES[code] ?? FALLBACK_MESSAGE) : FALLBACK_MESSAGE;
};

const wrap = async <T>(action: () => Promise<T>): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    throw new AuthFormError(authErrorMessage(error));
  }
};

export const signInWithEmail = (email: string, password: string): Promise<void> =>
  wrap(async () => {
    await signInWithEmailAndPassword(getFirebase().auth, email.trim(), password);
  });

export const createAccount = (email: string, password: string): Promise<void> =>
  wrap(async () => {
    await createUserWithEmailAndPassword(getFirebase().auth, email.trim(), password);
  });

/**
 * Opens the Google sign-in window. Resolves null when the person closes it.
 * isNewUser is true when this created the account, so the caller can send
 * them through onboarding (birth date first; the server repeats the 13+ check
 * and deletes an under-13 account, G18).
 */
export const signInWithGoogle = async (): Promise<{ isNewUser: boolean } | null> => {
  try {
    const result = await signInWithPopup(getFirebase().auth, new GoogleAuthProvider());
    return { isNewUser: getAdditionalUserInfo(result)?.isNewUser ?? false };
  } catch (error) {
    const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
    if (typeof code === "string" && POPUP_CANCELLED.has(code)) return null;
    throw new AuthFormError(authErrorMessage(error));
  }
};

export const signOutUser = (): Promise<void> => wrap(() => signOut(getFirebase().auth));

/**
 * Turns this device into the kiosk (SPEC#kiosk step 1, 5.10): the person's
 * session is signed out first, then the scoped kiosk token signs in, so a
 * coordinator session is never left on a shared tablet.
 */
export const switchToKioskSession = (customToken: string): Promise<void> =>
  wrap(async () => {
    const { auth } = getFirebase();
    await signOut(auth);
    await signInWithCustomToken(auth, customToken);
  });
