/**
 * reports.ts
 * Report vocabulary shared by the report builder (client) and the PDF
 * pipeline (Functions), so the two can never drift (SPEC 8.6, PORT_LEDGER
 * src/lib/reportTypes.ts -> shared/reports.ts):
 *   - section keys and labels for the two report kinds,
 *   - the six preset themes (D16), each contrast-checked to 4.5:1 for white
 *     text on its accent and for the accent as text on white,
 *   - WCAG relative luminance and contrast ratio used by those checks.
 * Themes are hex because pdfkit takes hex; the app shows them only as swatches.
 */
import type { ReportKind } from "./schemas/orgAdminDocs";

export const VOLUNTEER_REPORT_SECTIONS = ["summary", "hoursByOrg", "hoursByMonth", "shiftList", "milestones"] as const;
export type VolunteerReportSection = (typeof VOLUNTEER_REPORT_SECTIONS)[number];

export const ORG_REPORT_SECTIONS = ["summary", "hoursByOpportunity", "hoursByMonth", "attendance", "topVolunteers"] as const;
export type OrgReportSection = (typeof ORG_REPORT_SECTIONS)[number];

export type ReportSection = VolunteerReportSection | OrgReportSection;

export const REPORT_SECTION_LABELS: Readonly<Record<ReportSection, string>> = {
  summary: "Summary",
  hoursByOrg: "Hours by organization",
  hoursByMonth: "Hours by month",
  shiftList: "Shift list",
  milestones: "Milestones",
  hoursByOpportunity: "Hours by opportunity",
  attendance: "Attendance breakdown",
  topVolunteers: "Top volunteers"
};

/** Section keys allowed for a report kind, in the order the PDF prints them. */
export const sectionsFor = (kind: ReportKind): readonly ReportSection[] =>
  kind === "volunteer-hours" ? VOLUNTEER_REPORT_SECTIONS : ORG_REPORT_SECTIONS;

/** Keeps only known sections for the kind, deduplicated, in canonical order. */
export const orderSections = (kind: ReportKind, requested: readonly string[]): ReportSection[] =>
  sectionsFor(kind).filter((section) => requested.includes(section));

export const REPORT_THEME_IDS = ["neutral", "blue", "green", "purple", "orange", "high-contrast"] as const;
export type ReportThemeId = (typeof REPORT_THEME_IDS)[number];

export interface ReportTheme {
  readonly id: ReportThemeId;
  readonly label: string;
  /** Accent for header bars, chart bars, and headings. */
  readonly accent: string;
  /** Text drawn on the accent. */
  readonly onAccent: string;
}

const WHITE = "#FFFFFF";

export const REPORT_THEMES: Readonly<Record<ReportThemeId, ReportTheme>> = {
  neutral: { id: "neutral", label: "Neutral", accent: "#3F3F46", onAccent: WHITE },
  blue: { id: "blue", label: "Blue", accent: "#1D4ED8", onAccent: WHITE },
  green: { id: "green", label: "Green", accent: "#15803D", onAccent: WHITE },
  purple: { id: "purple", label: "Purple", accent: "#6D28D9", onAccent: WHITE },
  orange: { id: "orange", label: "Orange", accent: "#C2410C", onAccent: WHITE },
  "high-contrast": { id: "high-contrast", label: "High contrast", accent: "#000000", onAccent: WHITE }
};

export const DEFAULT_REPORT_THEME: ReportThemeId = "neutral";

/** Minimum contrast for normal text (WCAG 2.2 AA). */
export const MIN_TEXT_CONTRAST = 4.5;

const channel = (value: number): number => {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a "#RRGGBB" color. */
export const relativeLuminance = (hex: string): number => {
  const clean = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((offset) => Number.parseInt(clean.slice(offset, offset + 2), 16)) as [number, number, number];
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG contrast ratio between two "#RRGGBB" colors, from 1 to 21. */
export const contrastRatio = (first: string, second: string): number => {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
};
