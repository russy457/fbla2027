/**
 * renderLetterPdf.ts
 * Draws the one-page verified hours letter (SPEC#letters 8.2) with pdfkit:
 *
 *   header      product name | "Verified Volunteer Hours"; issue date | letter code
 *   volunteer   full name (the PDF is private to its owner) and period
 *   table       organization | verified | hours, then the total
 *   footer      verify URL with a server-side QR code that opens /verify/{code}
 *
 * Built on the page geometry and color helpers ported from the old app's
 * report pipeline. Uses the PDF standard Helvetica family, which every
 * viewer has, so no font files ship with the function. Pure: same input,
 * same drawing; the caller stores the bytes.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { formatVerifyCode, formatYmd, minutesToHours, type PerOrgMinutes } from "@fbla/shared";
import { mixHexColor, normalizeHexColor } from "../reports/pdf/helpers/colorUtils";
import { CONTENT_WIDTH, PAGE_MARGIN, PAGE_WIDTH, SECTION_GAP } from "../reports/pdf/helpers/layoutConstants";

/** Mirrors APP_NAME in src/lib/brand.ts (functions cannot import the web app). */
export const LETTER_PRODUCT_NAME = "Pitch In";
/** Bump when the layout changes; stored on each letter as rendererVersion. */
export const LETTER_RENDERER_VERSION = "letter-v1";

/** Rows that fit on one page; the rest collapse into an "and N more" line. */
const MAX_TABLE_ROWS = 14;
const QR_SIZE = 96;
const ROW_HEIGHT = 20;

const INK = "#18181B";
const MUTED = "#52525B";
const RULE = "#D4D4D8";
const ACCENT = normalizeHexColor("#1D4ED8");

export interface LetterPdfInput {
  readonly fullName: string;
  readonly issuedAtLabel: string;
  readonly verifyCode: string;
  readonly verifyUrl: string;
  readonly from: string;
  readonly to: string;
  /** Verified orgs only, in display order. */
  readonly rows: readonly PerOrgMinutes[];
  readonly totalMinutes: number;
  readonly excludedUnverifiedMinutes: number;
}

const hoursLabel = (minutes: number): string => minutesToHours(minutes).toFixed(2);

const drawHeader = (doc: PDFKit.PDFDocument, input: LetterPdfInput): number => {
  doc.rect(0, 0, PAGE_WIDTH, 10).fill(ACCENT);
  const top = PAGE_MARGIN;
  doc.font("Helvetica-Bold").fontSize(18).fillColor(INK).text(LETTER_PRODUCT_NAME, PAGE_MARGIN, top);
  doc.font("Helvetica-Bold").fontSize(14).fillColor(ACCENT).text("Verified Volunteer Hours", PAGE_MARGIN, top + 2, { width: CONTENT_WIDTH, align: "right" });
  doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`Issued ${input.issuedAtLabel}`, PAGE_MARGIN, top + 28);
  doc.text(`Letter code ${formatVerifyCode(input.verifyCode)}`, PAGE_MARGIN, top + 28, { width: CONTENT_WIDTH, align: "right" });
  const ruleY = top + 50;
  doc.moveTo(PAGE_MARGIN, ruleY).lineTo(PAGE_MARGIN + CONTENT_WIDTH, ruleY).lineWidth(1).strokeColor(RULE).stroke();
  return ruleY + SECTION_GAP;
};

const drawVolunteer = (doc: PDFKit.PDFDocument, input: LetterPdfInput, y: number): number => {
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(`Volunteer: ${input.fullName}`, PAGE_MARGIN, y);
  doc.font("Helvetica").fontSize(11).fillColor(MUTED).text(`Period: ${formatYmd(input.from)} to ${formatYmd(input.to)}`, PAGE_MARGIN, y + 20);
  return y + 50;
};

const drawRow = (doc: PDFKit.PDFDocument, y: number, cells: readonly [string, string, string], bold: boolean): void => {
  const nameWidth = CONTENT_WIDTH - 160;
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10.5).fillColor(INK);
  doc.text(cells[0], PAGE_MARGIN, y, { width: nameWidth, lineBreak: false, ellipsis: true });
  doc.text(cells[1], PAGE_MARGIN + nameWidth, y, { width: 80, lineBreak: false });
  doc.text(cells[2], PAGE_MARGIN + nameWidth + 80, y, { width: 80, align: "right", lineBreak: false });
};

const drawTable = (doc: PDFKit.PDFDocument, input: LetterPdfInput, top: number): number => {
  doc.rect(PAGE_MARGIN, top - 4, CONTENT_WIDTH, ROW_HEIGHT).fill(mixHexColor(ACCENT, "#FFFFFF", 0.88));
  drawRow(doc, top, ["Organization", "Verified", "Hours"], true);
  const shown = input.rows.length > MAX_TABLE_ROWS ? input.rows.slice(0, MAX_TABLE_ROWS - 1) : input.rows;
  const hidden = input.rows.slice(shown.length);
  const lines: Array<readonly [string, string, string]> = [
    ...shown.map((row) => [row.orgName, "Yes", hoursLabel(row.minutes)] as const),
    ...(hidden.length > 0
      ? [[`and ${hidden.length} more organizations`, "Yes", hoursLabel(hidden.reduce((sum, row) => sum + row.minutes, 0))] as const]
      : [])
  ];
  lines.forEach((cells, index) => drawRow(doc, top + ROW_HEIGHT * (index + 1), cells, false));
  const totalY = top + ROW_HEIGHT * (lines.length + 1) + 4;
  doc.moveTo(PAGE_MARGIN, totalY - 4).lineTo(PAGE_MARGIN + CONTENT_WIDTH, totalY - 4).lineWidth(1).strokeColor(RULE).stroke();
  drawRow(doc, totalY, ["", "Total", hoursLabel(input.totalMinutes)], true);
  const note =
    input.excludedUnverifiedMinutes > 0
      ? `Hours from unverified organizations are not included (${hoursLabel(input.excludedUnverifiedMinutes)} hours excluded).`
      : "Hours from unverified organizations are not included.";
  doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(MUTED).text(note, PAGE_MARGIN, totalY + ROW_HEIGHT + 4, { width: CONTENT_WIDTH });
  return doc.y + SECTION_GAP * 2;
};

const drawVerifyFooter = (doc: PDFKit.PDFDocument, input: LetterPdfInput, top: number, qrPng: Buffer): void => {
  const boxHeight = QR_SIZE + 24;
  doc.roundedRect(PAGE_MARGIN, top, CONTENT_WIDTH, boxHeight, 10).lineWidth(1).strokeColor(RULE).stroke();
  const textWidth = CONTENT_WIDTH - QR_SIZE - 48;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Verify this letter at", PAGE_MARGIN + 16, top + 18, { width: textWidth });
  doc.font("Helvetica").fontSize(10.5).fillColor(ACCENT).text(input.verifyUrl, PAGE_MARGIN + 16, top + 36, { width: textWidth, link: input.verifyUrl });
  doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text("The verify page shows the current status and totals. An edited PDF will not match it.", PAGE_MARGIN + 16, doc.y + 8, { width: textWidth });
  doc.image(qrPng, PAGE_MARGIN + CONTENT_WIDTH - QR_SIZE - 12, top + 12, { width: QR_SIZE, height: QR_SIZE });
};

/** Renders the letter and resolves with the PDF bytes. */
export const renderLetterPdf = async (input: LetterPdfInput): Promise<Buffer> => {
  const qrPng = await QRCode.toBuffer(input.verifyUrl, { margin: 1, width: QR_SIZE * 3, errorCorrectionLevel: "M" });
  const doc = new PDFDocument({
    size: "LETTER",
    margin: PAGE_MARGIN,
    info: { Title: `${LETTER_PRODUCT_NAME} verified volunteer hours`, Author: LETTER_PRODUCT_NAME, Subject: "Verified volunteer hours letter" }
  });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const afterHeader = drawHeader(doc, input);
  const afterVolunteer = drawVolunteer(doc, input, afterHeader);
  const afterTable = drawTable(doc, input, afterVolunteer);
  drawVerifyFooter(doc, input, afterTable, qrPng);
  doc.end();
  return finished;
};
