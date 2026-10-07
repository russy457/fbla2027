/**
 * authClient.ts
 * Thin wrappers over Firebase Auth for the few things the app does with it:
 * email/password sign-in, account creation (onboarding step 2), sign-out, and
 * switching a device into kiosk mode with a custom token (G15). Errors are
 * mapped to plain, age-appropriate sentences; raw Firebase codes never reach
 * the screen.
 */
import {
  createUserWithEmailAndPassword,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
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
  "auth/user-disabled": "This account is turned off. Ask an admin for help."
};

const FALLBACK_MESSAGE = "We couldn't sign you in. Try again.";

/** Maps a Firebase Auth error to a friendly sentence. */
export const authErrorMessage = (error: unknown): string => {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
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
