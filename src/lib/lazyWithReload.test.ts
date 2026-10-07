import { describe, expect, it, vi } from "vitest";
import { CHUNK_RELOAD_KEY, importWithReload } from "./lazyWithReload";

/** In-memory sessionStorage stand-in with spied methods. */
const makeStorage = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((k: string) => map.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      map.set(k, v);
    }),
    removeItem: vi.fn((k: string) => {
      map.delete(k);
    })
  };
};

describe("importWithReload (stale-chunk recovery)", () => {
  it("returns the module and clears the reload guard on success", async () => {
    const storage = makeStorage({ [CHUNK_RELOAD_KEY]: "1" });
    const reload = vi.fn();

    const mod = await importWithReload(() => Promise.resolve({ value: 42 }), storage, reload);

    expect(mod).toEqual({ value: 42 });
    expect(storage.removeItem).toHaveBeenCalledWith(CHUNK_RELOAD_KEY);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads exactly once on the first import failure (stale chunk after deploy)", async () => {
    const storage = makeStorage();
    const reload = vi.fn();

    // Intentionally NOT awaited: the recovery path returns a promise that never
    // resolves because the page is reloading out from under us.
    void importWithReload(() => Promise.reject(new Error("boom")), storage, reload);
    await new Promise((resolve) => setTimeout(resolve, 0)); // flush microtasks

    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(CHUNK_RELOAD_KEY, "1");
  });

  it("rethrows without reloading when the guard is already set (no reload loop)", async () => {
    const storage = makeStorage({ [CHUNK_RELOAD_KEY]: "1" });
    const reload = vi.fn();

    await expect(
      importWithReload(() => Promise.reject(new Error("still broken")), storage, reload)
    ).rejects.toThrow("still broken");
    expect(reload).not.toHaveBeenCalled();
  });
});
