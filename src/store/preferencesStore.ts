/**
 * preferencesStore.ts
 * Accessibility preferences (text size, contrast, motion) for plan items E3,
 * D18, and D21. The store applies each choice as a data attribute on <html>
 * (data-text-size, data-contrast, data-motion) so tokens.css can react without
 * any component changes. Choices persist in localStorage; every storage call
 * is wrapped in try/catch because private browsing can block storage.
 * Later (Tier 1) the same values are copied to users/{uid}/private when signed in.
 */
import { create } from "zustand";

export type TextSize = "100" | "125" | "150";
export type Contrast = "standard" | "high";
export type MotionPreference = "system" | "reduced";

export interface DisplayPreferences {
  textSize: TextSize;
  contrast: Contrast;
  motion: MotionPreference;
}

interface PreferencesState extends DisplayPreferences {
  setTextSize: (textSize: TextSize) => void;
  setContrast: (contrast: Contrast) => void;
  setMotion: (motion: MotionPreference) => void;
}

export const PREFERENCES_STORAGE_KEY = "fbla2027:display-preferences";

export const DEFAULT_PREFERENCES: DisplayPreferences = Object.freeze({
  textSize: "100",
  contrast: "standard",
  motion: "system"
});

const TEXT_SIZES: readonly TextSize[] = ["100", "125", "150"];
const CONTRASTS: readonly Contrast[] = ["standard", "high"];
const MOTIONS: readonly MotionPreference[] = ["system", "reduced"];

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Reads saved preferences, ignoring anything malformed or unreadable. */
export const loadPreferences = (): DisplayPreferences => {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    const record = (typeof parsed === "object" && parsed !== null ? parsed : {}) as Record<string, unknown>;
    return {
      textSize: pick(TEXT_SIZES, record.textSize, DEFAULT_PREFERENCES.textSize),
      contrast: pick(CONTRASTS, record.contrast, DEFAULT_PREFERENCES.contrast),
      motion: pick(MOTIONS, record.motion, DEFAULT_PREFERENCES.motion)
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

const savePreferences = (prefs: DisplayPreferences): void => {
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage is unavailable (private mode or quota). The choice still applies
    // for this visit; it just will not be remembered.
  }
};

/** Mirrors preferences onto <html> so CSS tokens respond. */
export const applyPreferencesToDocument = (prefs: DisplayPreferences, root: HTMLElement): void => {
  root.dataset.textSize = prefs.textSize;
  root.dataset.contrast = prefs.contrast;
  root.dataset.motion = prefs.motion;
};

const snapshot = (state: PreferencesState): DisplayPreferences => ({
  textSize: state.textSize,
  contrast: state.contrast,
  motion: state.motion
});

export const usePreferencesStore = create<PreferencesState>()((set) => ({
  ...loadPreferences(),
  setTextSize: (textSize) => set({ textSize }),
  setContrast: (contrast) => set({ contrast }),
  setMotion: (motion) => set({ motion })
}));

/**
 * Applies the current preferences now and on every change. Called once from
 * main.tsx. Returns an unsubscribe function for tests.
 */
export const syncPreferencesToDocument = (root: HTMLElement = document.documentElement): (() => void) => {
  applyPreferencesToDocument(snapshot(usePreferencesStore.getState()), root);
  return usePreferencesStore.subscribe((state) => {
    const prefs = snapshot(state);
    applyPreferencesToDocument(prefs, root);
    savePreferences(prefs);
  });
};
