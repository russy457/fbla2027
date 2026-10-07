/**
 * KioskQr.tsx
 * The kiosk's QR of qrPayload, next to the 6-digit code (SPEC#kiosk 8.1
 * step 2, D4 "Live": code, ring, QR). Progressive enhancement (G20): it
 * renders only in a secure context, where the phone scanner can also run.
 * Drawn as one SVG path in currentColor on the surface token, so the
 * colors follow tokens (and high contrast) with no hardcoded values. It
 * rotates with the code; the image is decorative for screen readers because
 * the digits beside it carry the same information.
 */
import { useMemo, type ReactElement } from "react";
import { isQrAvailable, qrPath } from "@/lib/qr";

interface KioskQrProps {
  readonly payload: string;
}

export const KioskQr = ({ payload }: KioskQrProps): ReactElement | null => {
  const path = useMemo(() => qrPath(payload), [payload]);
  if (!isQrAvailable()) return null;
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        data-testid="kiosk-qr"
        role="img"
        aria-label="QR code for check-in. Scan it in the app under My Shifts."
        viewBox={`0 0 ${path.size} ${path.size}`}
        shapeRendering="crispEdges"
        className="size-48 rounded-md bg-surface text-fg lg:size-56"
      >
        <path d={path.d} fill="currentColor" />
      </svg>
      <figcaption className="text-sm text-fg-muted">Or scan in the app</figcaption>
    </figure>
  );
};
