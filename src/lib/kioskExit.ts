/**
 * kioskExit.ts
 * Who may leave kiosk mode (SPEC#kiosk "Kiosk lock", G15): only an owner or
 * coordinator of the shift's organization. The credentials are checked on an
 * isolated in-memory Firebase app first, so a wrong person never replaces
 * the kiosk session: the tablet stays a kiosk and shows an error. Only after
 * the check passes does this device sign in for real.
 */
import { doc, getDoc } from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { MEMBER_ROLES, PATHS } from "@fbla/shared";
import { AuthFormError, authErrorMessage, signInWithEmail } from "./authClient";
import { createIsolatedServices } from "./firebase";

export const NOT_A_COORDINATOR_MESSAGE = "Only a coordinator of this organization can exit the kiosk. The kiosk is still running.";

const isCoordinatorRole = (role: unknown): boolean => typeof role === "string" && (MEMBER_ROLES as readonly string[]).includes(role);

/** Resolves when the credentials belong to an owner or coordinator of orgId; throws AuthFormError otherwise. */
export const verifyKioskExitCredentials = async (email: string, password: string, orgId: string): Promise<void> => {
  const isolated = createIsolatedServices();
  try {
    let uid: string;
    try {
      uid = (await signInWithEmailAndPassword(isolated.auth, email.trim(), password)).user.uid;
    } catch (error) {
      throw new AuthFormError(authErrorMessage(error));
    }
    // Rules allow reading your own members doc; a missing doc means "not a member".
    const member = await getDoc(doc(isolated.db, PATHS.member(orgId, uid))).catch(() => null);
    if (!member?.exists() || !isCoordinatorRole(member.get("role"))) throw new AuthFormError(NOT_A_COORDINATOR_MESSAGE);
  } finally {
    await isolated.dispose();
  }
};

/** Kiosk exit: verify first, then replace the kiosk session with the coordinator's. */
export const exitKioskWithCredentials = async (email: string, password: string, orgId: string): Promise<void> => {
  await verifyKioskExitCredentials(email, password, orgId);
  await signInWithEmail(email, password);
};
