/**
 * useAssistantAccess.ts
 * Who may ask the server assistant (SPEC 8.4 caller column, D7):
 *   signed-out     visitors (and kiosk sessions): Help Center answers + "Sign in to ask"
 *   checking       sign-in or profile still loading: Help Center answers for now
 *   needs-profile  signed in without a finished profile: Help Center answers + finish profile
 *   ready          signed in with a complete profile: ai.askAssistant
 * The server enforces the same gate; this only picks the right UI.
 *
 * The profile is a live Firestore query, so it is read only for signed-in
 * people (useSignedInAccess runs inside a component mounted just for them);
 * visitors never open a listener.
 */
import { usePrivateProfile } from "@/hooks/useVolunteerData";
import type { Session } from "@/store/authStore";

export type AssistantAccess = "signed-out" | "checking" | "needs-profile" | "ready";

/** Access decided from the session alone; null means "signed in, read the profile". */
export const accessFromSession = (session: Session): AssistantAccess | null => {
  if (session.status === "loading") return "checking";
  if (session.status === "user") return null;
  return "signed-out";
};

/** Access for a signed-in person, from their private profile. */
export const useSignedInAccess = (uid: string): AssistantAccess => {
  const profile = usePrivateProfile(uid);
  if (profile.isLoading) return "checking";
  return profile.data?.profileComplete === true ? "ready" : "needs-profile";
};
