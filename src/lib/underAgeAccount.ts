/**
 * underAgeAccount.ts
 * The onboarding stop for someone already signed in who enters an under-13
 * birth date (SPEC#minors G18, D10). The account must not keep any data, so
 * the client asks the server to run its under-13 path: completeProfile with
 * the birth date deletes the Auth user and every doc under the uid and
 * answers AGE_UNDER_13. Then this device signs out. Names are not known yet
 * at the birth date step, so neutral placeholders satisfy the input schema;
 * the server refuses before writing or logging anything.
 */
import { api, ApiError } from "./api";
import { signOutUser } from "./authClient";

const PLACEHOLDER_NAME = "Pending";

/** True when the server confirmed the deletion (AGE_UNDER_13); false when the call failed for another reason. */
export const deleteUnderAgeAccount = async (birthDate: string): Promise<boolean> => {
  let isDeleted = false;
  try {
    await api.volunteer.completeProfile({ firstName: PLACEHOLDER_NAME, lastName: PLACEHOLDER_NAME, birthDate });
  } catch (error) {
    isDeleted = error instanceof ApiError && error.userError.code === "AGE_UNDER_13";
  } finally {
    // Always leave this device signed out, even if the deletion call failed.
    await signOutUser().catch(() => undefined);
  }
  return isDeleted;
};
