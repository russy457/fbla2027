/**
 * preferenceSync.ts
 * E3 display preferences, between this device and the account (SPEC 9.16:
 * "stored in localStorage and copied to users/{uid}/private/profile when
 * signed in"; SPEC 3.17 textSize, contrast, reducedMotion are client-written
 * under the rules allowlist). The store keeps its own spelling ("standard",
 * "system"); the profile uses the SPEC values (normal, reducedMotion: bool).
 */
import { doc, updateDoc } from "firebase/firestore";
import { PATHS, type PrivateProfileDoc } from "@fbla/shared";
import type { DisplayPreferences, TextSize } from "@/store/preferencesStore";
import { getFirebase } from "./firebase";

export type ProfilePreferences = Required<Pick<PrivateProfileDoc, "textSize" | "contrast" | "reducedMotion">>;

export const toProfilePreferences = (prefs: DisplayPreferences): ProfilePreferences => ({
  textSize: Number(prefs.textSize) as ProfilePreferences["textSize"],
  contrast: prefs.contrast === "high" ? "high" : "normal",
  reducedMotion: prefs.motion === "reduced"
});

/** The saved account values over the device's, for whichever fields the account has. */
export const fromProfilePreferences = (
  profile: Pick<PrivateProfileDoc, "textSize" | "contrast" | "reducedMotion">,
  device: DisplayPreferences
): DisplayPreferences => ({
  textSize: profile.textSize === undefined ? device.textSize : (String(profile.textSize) as TextSize),
  contrast: profile.contrast === undefined ? device.contrast : profile.contrast === "high" ? "high" : "standard",
  motion: profile.reducedMotion === undefined ? device.motion : profile.reducedMotion ? "reduced" : "system"
});

export const samePreferences = (a: DisplayPreferences, b: DisplayPreferences): boolean =>
  a.textSize === b.textSize && a.contrast === b.contrast && a.motion === b.motion;

/** Writes the three allowlisted keys; the rules reject anything else. */
export const savePreferencesToProfile = async (uid: string, prefs: DisplayPreferences): Promise<void> => {
  await updateDoc(doc(getFirebase().db, PATHS.privateProfile(uid)), { ...toProfilePreferences(prefs) });
};
