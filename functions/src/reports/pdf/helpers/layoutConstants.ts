/**
 * layoutConstants.ts
 * Ported from the old app's PDF pipeline (fblaslc2026 @ f9f6793,
 * functions/src/reports/pdf/helpers/layoutConstants.ts; PORT_LEDGER section 10).
 * US Letter page geometry in PDF points (72 per inch) shared by letters and
 * (Tier 1) reports, so every document has the same margins and rhythm.
 */
export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;
export const PAGE_MARGIN = 48;
export const HEADER_BAR_HEIGHT = 18;
export const HEADER_HEIGHT = 64;
export const FOOTER_HEIGHT = 34;
export const CONTENT_TOP = PAGE_MARGIN + HEADER_HEIGHT;
export const CONTENT_BOTTOM = PAGE_HEIGHT - PAGE_MARGIN - FOOTER_HEIGHT;
export const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
export const CARD_RADIUS = 14;
export const SECTION_GAP = 18;
export const ITEM_GAP = 12;
