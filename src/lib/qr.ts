/**
 * qr.ts
 * QR helpers for check-in (SPEC#kiosk 8.1, G20, Tier 1):
 *   qrPath(text)            SVG path data for the QR modules, so the kiosk
 *                           draws the code with fill="currentColor" from
 *                           tokens (no hardcoded colors, check:tokens)
 *   parseCheckinPayload()   what the phone scanner accepts: only
 *                           {origin}/checkin?i={instanceId}&c={6 digits}
 *                           from this app's own origin (APP_BASE_URL)
 *   isQrAvailable()         QR and scanner render only in a secure context
 * The typed code stays the rehearsed primary path; QR is an enhancement.
 */
import QRCode from "qrcode";
import { KIOSK_CODE_PATTERN } from "@fbla/shared";

export interface QrPath {
  /** Modules per side; the SVG viewBox is size + 2 * quiet zone. */
  readonly size: number;
  readonly d: string;
}

/** A 2-module quiet zone keeps the code readable next to other content. */
export const QR_QUIET_ZONE = 2;

export const qrPath = (text: string): QrPath => {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const parts: string[] = [];
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.get(row, col)) parts.push(`M${col + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h1v1h-1z`);
    }
  }
  return { size: modules.size + 2 * QR_QUIET_ZONE, d: parts.join("") };
};

export interface CheckinPayload {
  readonly instanceId: string;
  readonly code: string;
}

const INSTANCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

/** Reads i and c from a /checkin URL's search params; null when either is malformed. */
export const readCheckinParams = (params: URLSearchParams): CheckinPayload | null => {
  const instanceId = params.get("i") ?? "";
  const code = params.get("c") ?? "";
  return INSTANCE_ID_PATTERN.test(instanceId) && KIOSK_CODE_PATTERN.test(code) ? { instanceId, code } : null;
};

/** Accepts only this app's own /checkin links (G20: the scanner never follows other URLs). */
export const parseCheckinPayload = (text: string, expectedOrigin: string): CheckinPayload | null => {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.origin !== expectedOrigin || url.pathname !== "/checkin") return null;
  return readCheckinParams(url.searchParams);
};

/** True on HTTPS (or localhost in development), where the camera and QR are allowed. */
export const isQrAvailable = (): boolean => typeof window !== "undefined" && window.isSecureContext === true;
