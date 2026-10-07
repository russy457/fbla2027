/**
 * usePreferenceSync.ts
 * Keeps E3 display preferences in step with the signed-in account (SPEC
 * 9.16). On sign-in, values saved on the account replace this device's
 * (so text size follows the person to a new phone); after that, every change
 * made with the display controls is written back to the private profile.
 * A failed write is ignored: the choice still applies on this device and
 * localStorage keeps it.
 */
import { useEffect, useRef } from "react";
import { fromProfilePreferences, samePreferences, savePreferencesToProfile } from "@/lib/preferenceSync";
import { usePreferencesStore, type DisplayPreferences } from "@/store/preferencesStore";
import { useSessionUser } from "@/store/authStore";
import { usePrivateProfile } from "./useVolunteerData";

const snapshot = (state: DisplayPreferences): DisplayPreferences => ({ textSize: state.textSize, contrast: state.contrast, motion: state.motion });

export const usePreferenceSync = (): void => {
  const user = useSessionUser();
  const uid = user?.uid ?? null;
  const profile = usePrivateProfile(uid);
  const appliedFor = useRef<string | null>(null);

  // Once per sign-in: the account's saved values win.
  useEffect(() => {
    if (uid === null) {
      appliedFor.current = null;
      return;
    }
    if (appliedFor.current === uid || !profile.data) return;
    const store = usePreferencesStore.getState();
    const current = snapshot(store);
    const merged = fromProfilePreferences(profile.data, current);
    if (!samePreferences(merged, current)) {
      store.setTextSize(merged.textSize);
      store.setContrast(merged.contrast);
      store.setMotion(merged.motion);
    }
    // Marked after applying, so applying the account values is not written straight back.
    appliedFor.current = uid;
  }, [uid, profile.data]);

  // After that: write each change back to the account.
  useEffect(() => {
    if (uid === null) return undefined;
    return usePreferencesStore.subscribe((state, previous) => {
      if (appliedFor.current !== uid || samePreferences(snapshot(state), snapshot(previous))) return;
      void savePreferencesToProfile(uid, snapshot(state)).catch(() => undefined);
    });
  }, [uid]);
};
