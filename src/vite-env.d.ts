/// <reference types="vite/client" />

/** Typed VITE_* variables. Validated at runtime by src/lib/env.ts. */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_USE_EMULATORS?: string;
  readonly VITE_FUNCTIONS_EMULATOR?: string;
  readonly VITE_STORAGE_EMULATOR?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_APPCHECK_SITE_KEY?: string;
  readonly VITE_APPCHECK_DEBUG_TOKEN?: string;
  /** Public site origin for canonical URLs and the sitemap (exposed by vite.config.ts envPrefix). */
  readonly APP_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
