import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  applyPreferencesToDocument,
  loadPreferences,
  syncPreferencesToDocument,
  usePreferencesStore
} from "./preferencesStore";

beforeEach(() => {
  window.localStorage.clear();
  usePreferencesStore.setState({ ...DEFAULT_PREFERENCES });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadPreferences", () => {
  it("returns defaults when nothing is saved", () => {
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("reads saved values and drops unknown ones", () => {
    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ textSize: "150", contrast: "neon", motion: "reduced" })
    );
    expect(loadPreferences()).toEqual({ textSize: "150", contrast: "standard", motion: "reduced" });
  });

  it("survives malformed JSON and non-object values", () => {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, "{not json");
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, "42");
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("falls back to defaults when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});

describe("syncPreferencesToDocument", () => {
  it("applies data attributes now and after every change, and saves them", () => {
    const root = document.createElement("html");
    const stop = syncPreferencesToDocument(root);
    expect(root.dataset).toMatchObject({ textSize: "100", contrast: "standard", motion: "system" });

    usePreferencesStore.getState().setTextSize("125");
    usePreferencesStore.getState().setContrast("high");
    usePreferencesStore.getState().setMotion("reduced");

    expect(root.dataset).toMatchObject({ textSize: "125", contrast: "high", motion: "reduced" });
    expect(JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "{}")).toEqual({
      textSize: "125",
      contrast: "high",
      motion: "reduced"
    });
    stop();
  });

  it("keeps working when storage refuses writes", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const root = document.createElement("html");
    const stop = syncPreferencesToDocument(root);
    expect(() => usePreferencesStore.getState().setTextSize("150")).not.toThrow();
    expect(root.dataset.textSize).toBe("150");
    stop();
  });
});

describe("applyPreferencesToDocument", () => {
  it("writes all three attributes", () => {
    const root = document.createElement("html");
    applyPreferencesToDocument({ textSize: "150", contrast: "high", motion: "reduced" }, root);
    expect(root.getAttribute("data-text-size")).toBe("150");
    expect(root.getAttribute("data-contrast")).toBe("high");
    expect(root.getAttribute("data-motion")).toBe("reduced");
  });
});
