/**
 * @file lazyWithReload.ts
 * @description React.lazy wrapper that self-heals a stale dynamic-import chunk
 *   after a redeploy. Vite emits content-hashed chunk filenames; once a new
 *   build is deployed the old hashes no longer exist on the server. A browser
 *   tab opened BEFORE the deploy still holds the old module graph, so the next
 *   lazy navigation requests a stale `/assets/<page>-<oldhash>.js`. Firebase
 *   Hosting's SPA rewrite (`** -> /index.html`) answers that missing asset with
 *   index.html (text/html, 200), which the browser refuses to evaluate as a
 *   module: the `import()` rejects with "error loading dynamically imported
 *   module" and the user hits a dead-end error screen.
 *
 *   The cure for a stale chunk is a single full reload: it re-fetches the fresh
 *   index.html and the current chunk hashes. We guard with sessionStorage so a
 *   failure that is NOT a stale chunk (offline, a genuinely missing chunk)
 *   reloads at most once and then surfaces the real error to the route
 *   errorElement instead of reloading forever.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/** sessionStorage key marking that we already reloaded once for a failed import. */
export const CHUNK_RELOAD_KEY = "fbla2027:chunk-reload";

type GuardStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Run a dynamic-import factory with stale-chunk recovery. Exported separately
 * from {@link lazyWithReload} so the retry/guard policy is unit-testable
 * without React.lazy. `storage` and `reload` are injectable for tests.
 */
export async function importWithReload<T>(
  factory: () => Promise<T>,
  storage: GuardStorage = sessionStorage,
  reload: () => void = () => window.location.reload()
): Promise<T> {
  try {
    const mod = await factory();
    // Loaded fine: clear the guard so a LATER deploy can recover again.
    storage.removeItem(CHUNK_RELOAD_KEY);
    return mod;
  } catch (error) {
    if (storage.getItem(CHUNK_RELOAD_KEY)) {
      // Already reloaded once and it still fails: not a stale chunk. Surface
      // the real error (the route errorElement renders a friendly retry panel).
      throw error;
    }
    storage.setItem(CHUNK_RELOAD_KEY, "1");
    reload();
    // The reload navigates away; block forever so React.lazy never renders a
    // broken state in the brief window before the page tears down.
    return new Promise<T>(() => {});
  }
}

/**
 * Drop-in replacement for React.lazy that recovers from a stale chunk by
 * reloading once. Use for every lazily-imported route.
 */
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(() => importWithReload(factory));
}
