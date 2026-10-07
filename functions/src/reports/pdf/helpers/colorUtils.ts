/**
 * colorUtils.ts
 * Ported from the old app's PDF pipeline (fblaslc2026 @ f9f6793,
 * functions/src/reports/pdf/helpers/colorUtils.ts; PORT_LEDGER section 10).
 * Hex color helpers for pdfkit, which takes colors as hex strings: validate a
 * preset accent and mix it toward white for soft fills and rules.
 * PDF colors are print output, not app UI, so they do not use tokens.css.
 */
const HEX_COLOR = /^#?[0-9a-fA-F]{6}$/;

/** Neutral fallback accent when a preset value is missing or malformed. */
export const DEFAULT_ACCENT = "#2E7D32";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Uppercase "#RRGGBB", or the fallback when the input is not a 6-digit hex color. */
export const normalizeHexColor = (value?: string | null, fallback = DEFAULT_ACCENT): string => {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!HEX_COLOR.test(trimmed)) return fallback;
  return trimmed.startsWith("#") ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`;
};

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const normalized = normalizeHexColor(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
};

/** Linear blend of two colors; amount 0 returns `hex`, 1 returns `mixWith`. */
export const mixHexColor = (hex: string, mixWith: string, amount: number): string => {
  const base = hexToRgb(hex);
  const overlay = hexToRgb(mixWith);
  const ratio = clamp(amount, 0, 1);
  const toHex = (value: number): string => Math.round(value).toString(16).padStart(2, "0").toUpperCase();
  const r = base.r + (overlay.r - base.r) * ratio;
  const g = base.g + (overlay.g - base.g) * ratio;
  const b = base.b + (overlay.b - base.b) * ratio;
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
