/**
 * badgeCard.ts
 * The shareable milestone badge card (E4, SPEC 3.16 "badge-card fields":
 * display name, badges, hours). Built as an SVG string from public fields
 * only (first name + last initial, never a full name, age, or school), then
 * rasterized to a PNG for download or the share sheet.
 *
 * Colors are read from the design tokens at runtime (getComputedStyle on
 * <html>), so the card follows tokens.css and there are no hardcoded colors.
 */
import { APP_NAME } from "./brand";

export interface BadgeCardColors {
  readonly background: string;
  readonly foreground: string;
  readonly muted: string;
  readonly accent: string;
  readonly accentForeground: string;
}

export interface BadgeCardInput {
  readonly displayName: string;
  readonly milestone: number;
  readonly totalHours: number;
  readonly colors: BadgeCardColors;
}

export const BADGE_CARD_WIDTH = 1200;
export const BADGE_CARD_HEIGHT = 630;

const escapeXml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export const badgeCardSvg = ({ displayName, milestone, totalHours, colors }: BadgeCardInput): string => {
  const hours = Number.isInteger(totalHours) ? String(totalHours) : totalHours.toFixed(2);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_CARD_WIDTH}" height="${BADGE_CARD_HEIGHT}" viewBox="0 0 ${BADGE_CARD_WIDTH} ${BADGE_CARD_HEIGHT}">`,
    `<rect width="100%" height="100%" fill="${escapeXml(colors.background)}"/>`,
    `<circle cx="300" cy="315" r="190" fill="${escapeXml(colors.accent)}"/>`,
    `<text x="300" y="330" text-anchor="middle" font-family="sans-serif" font-size="150" font-weight="700" fill="${escapeXml(colors.accentForeground)}">${milestone}</text>`,
    `<text x="300" y="400" text-anchor="middle" font-family="sans-serif" font-size="40" font-weight="600" fill="${escapeXml(colors.accentForeground)}">HOURS</text>`,
    `<text x="560" y="230" font-family="sans-serif" font-size="40" fill="${escapeXml(colors.muted)}">${escapeXml(APP_NAME)} milestone</text>`,
    `<text x="560" y="320" font-family="sans-serif" font-size="64" font-weight="700" fill="${escapeXml(colors.foreground)}">${escapeXml(displayName)}</text>`,
    `<text x="560" y="390" font-family="sans-serif" font-size="40" fill="${escapeXml(colors.foreground)}">reached ${milestone} volunteer hours</text>`,
    `<text x="560" y="450" font-family="sans-serif" font-size="32" fill="${escapeXml(colors.muted)}">${escapeXml(hours)} approved hours in total</text>`,
    "</svg>"
  ].join("");
};

/** The token colors, resolved on the live page (they change with high contrast). */
export const tokenColors = (root: HTMLElement = document.documentElement): BadgeCardColors => {
  const style = getComputedStyle(root);
  const read = (name: string): string => style.getPropertyValue(name).trim() || "currentColor";
  return {
    background: read("--surface"),
    foreground: read("--fg"),
    muted: read("--fg-muted"),
    accent: read("--accent"),
    accentForeground: read("--accent-fg")
  };
};

/** Rasterizes the SVG to a PNG blob (for download and the share sheet). */
export const svgToPng = (svg: string): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = BADGE_CARD_WIDTH;
      canvas.height = BADGE_CARD_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas is not available"));
        return;
      }
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image"))), "image/png");
    };
    image.onerror = () => reject(new Error("Could not draw the badge card"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
