import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_STORAGE_KEY, getConsent, hasOptionalConsent, setConsent } from "./consent";

describe("consent storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no choice has been stored yet", () => {
    expect(getConsent()).toBeNull();
  });

  it("round-trips a 'granted' choice", () => {
    setConsent("granted");
    expect(getConsent()).toBe("granted");
  });

  it("round-trips a 'denied' choice", () => {
    setConsent("denied");
    expect(getConsent()).toBe("denied");
  });

  it("treats an unrecognized stored value as not-yet-asked", () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "maybe");
    expect(getConsent()).toBeNull();
  });

  it("returns null when storage throws on read", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getConsent()).toBeNull();
    spy.mockRestore();
  });

  it("does not throw when storage refuses writes", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => setConsent("granted")).not.toThrow();
    spy.mockRestore();
  });
});

describe("hasOptionalConsent", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is false until the visitor explicitly opts in", () => {
    expect(hasOptionalConsent()).toBe(false);
    setConsent("denied");
    expect(hasOptionalConsent()).toBe(false);
    setConsent("granted");
    expect(hasOptionalConsent()).toBe(true);
  });
});
