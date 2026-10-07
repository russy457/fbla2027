/**
 * TurnstileWidget.tsx
 * Cloudflare Turnstile human check for onboarding (SPEC 5.9, G13, X11).
 * Loads Cloudflare's script once (allowed by the hosting CSP), renders the
 * widget explicitly, and reports the token (or null when it expires). With
 * a local Functions server, verification is disabled server-side, so the
 * client skips the widget too. This includes the cloud Firestore demo.
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import { readClientEnv } from "@/lib/env";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
}

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

/** Loads the Turnstile script once per page; later calls share the same promise. */
const loadTurnstile = (): Promise<TurnstileApi> => {
  const existing = (window as TurnstileWindow).turnstile;
  if (existing) return Promise.resolve(existing);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      const api = (window as TurnstileWindow).turnstile;
      if (api) resolve(api);
      else reject(new Error("Turnstile did not start"));
    };
    script.onerror = () => {
      scriptPromise = null; // allow a later retry
      reject(new Error("Turnstile script failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
};

export type TurnstileStatus = "loading" | "ready" | "verified" | "unavailable" | "skipped";

interface TurnstileWidgetProps {
  readonly onToken: (token: string | null) => void;
  readonly onStatus: (status: TurnstileStatus) => void;
}

export const TurnstileWidget = ({ onToken, onStatus }: TurnstileWidgetProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<TurnstileStatus>("loading");
  const env = readClientEnv();
  const siteKey = env.ok ? env.env.VITE_TURNSTILE_SITE_KEY : undefined;
  const usingLocalFunctions = env.ok && (env.env.VITE_USE_EMULATORS || env.env.VITE_FUNCTIONS_EMULATOR);

  useEffect(() => {
    onStatus(status);
  }, [status, onStatus]);

  useEffect(() => {
    if (usingLocalFunctions) {
      setStatus("skipped");
      return undefined;
    }
    if (!siteKey) {
      setStatus("unavailable");
      return undefined;
    }
    let widgetId: string | null = null;
    let isActive = true;
    loadTurnstile()
      .then((api) => {
        if (!isActive || !containerRef.current) return;
        widgetId = api.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => {
            onToken(token);
            setStatus("verified");
          },
          "expired-callback": () => {
            onToken(null);
            setStatus("ready");
          },
          "error-callback": () => setStatus("unavailable")
        });
        setStatus("ready");
      })
      .catch(() => {
        if (isActive) setStatus("unavailable");
      });
    return () => {
      isActive = false;
      const api = (window as TurnstileWindow).turnstile;
      if (widgetId && api) api.remove(widgetId);
    };
  }, [siteKey, usingLocalFunctions, onToken]);

  return (
    <div className="flex flex-col gap-2">
      <div ref={containerRef} />
      <p aria-live="polite" className="text-sm text-fg-muted">
        {status === "loading" ? "Loading a quick human check..." : null}
        {status === "verified" ? "Human check done." : null}
        {status === "skipped" ? "Human check skipped for this local demo." : null}
        {status === "unavailable" ? "We couldn't load the human check. Check your connection, then reload this page." : null}
      </p>
    </div>
  );
};
