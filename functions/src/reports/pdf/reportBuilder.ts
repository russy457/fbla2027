/**
 * reportBuilder.ts
 * Ported from the old app's PDF pipeline (fblaslc2026 @ f9f6793,
 * functions/src/reports/pdf/pdfGenerator.ts PdfReportBuilder; PORT_LEDGER
 * section 10). The layout engine is kept: a cursor that flows sections down
 * the page, ensureSpace/addPage for page breaks, section headings, paragraphs,
 * stat and key-value grids, and "Page X of Y" footers written last through
 * buffered pages. Changes from the port: Trove strings removed (product name
 * "Pitch In"), no image loader, the generation time comes from the request
 * clock (SPEC#clock), colors come from a preset theme (D16), and two new
 * helpers draw a table and a server-side bar chart (SPEC 8.6).
 * Fonts are the PDF standard Helvetica family (no font files to embed), the
 * same choice as the letter renderer.
 */
import PDFDocument from "pdfkit";
import { formatLongDate, type ReportTheme } from "@fbla/shared";
import { LETTER_PRODUCT_NAME } from "../../letters/renderLetterPdf";
import { mixHexColor, normalizeHexColor } from "./helpers/colorUtils";
import { CONTENT_BOTTOM, CONTENT_TOP, CONTENT_WIDTH, PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH, SECTION_GAP } from "./helpers/layoutConstants";

export interface StatCardItem {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}

export interface TableColumn {
  readonly header: string;
  /** Share of the content width, 0..1; the shares should add up to 1. */
  readonly width: number;
  readonly align?: "left" | "right";
}

export interface BarItem {
  readonly label: string;
  readonly value: number;
  readonly valueLabel: string;
}

const INK = "#27272A";
const MUTED = "#52525B";
const BORDER = "#D4D4D8";
const WHITE = "#FFFFFF";
const ROW_HEIGHT = 18;
const BAR_HEIGHT = 14;

export interface ReportBuilderOptions {
  readonly title: string;
  readonly theme: ReportTheme;
  /** Generation instant from the request clock (never wall time). */
  readonly generatedAt: Date;
  readonly timeZone: string;
}

export class PdfReportBuilder {
  readonly doc: PDFKit.PDFDocument;
  readonly accent: string;
  readonly accentSoft: string;
  readonly accentMuted: string;
  readonly onAccent: string;
  cursorY = CONTENT_TOP;
  private readonly chunks: Buffer[] = [];
  private readonly generatedLabel: string;

  constructor(private readonly options: ReportBuilderOptions) {
    this.accent = normalizeHexColor(options.theme.accent);
    this.onAccent = normalizeHexColor(options.theme.onAccent, WHITE);
    this.accentSoft = mixHexColor(this.accent, WHITE, 0.88);
    this.accentMuted = mixHexColor(this.accent, WHITE, 0.55);
    this.generatedLabel = formatLongDate(options.generatedAt, options.timeZone);
    this.doc = new PDFDocument({
      size: "LETTER",
      margin: PAGE_MARGIN,
      bufferPages: true,
      info: { Title: options.title, Author: LETTER_PRODUCT_NAME, Subject: `${LETTER_PRODUCT_NAME} report` }
    });
    this.doc.on("data", (chunk: Buffer) => this.chunks.push(chunk));
    this.drawPageChrome();
  }

  get contentX(): number {
    return PAGE_MARGIN;
  }

  get contentWidth(): number {
    return CONTENT_WIDTH;
  }

  ensureSpace(height: number): void {
    if (this.cursorY + height > CONTENT_BOTTOM) this.addPage();
  }

  addPage(): void {
    this.doc.addPage();
    this.drawPageChrome();
    this.cursorY = CONTENT_TOP;
  }

  gap(amount = SECTION_GAP): void {
    this.cursorY += amount;
  }

  /** Cover banner: title, subject line, and the date range. */
  drawCover(subtitle: string, rangeLabel: string): void {
    const height = 92;
    this.doc.roundedRect(this.contentX, this.cursorY, this.contentWidth, height, 14).fill(this.accent);
    this.doc.font("Helvetica-Bold").fontSize(20).fillColor(this.onAccent).text(this.options.title, this.contentX + 18, this.cursorY + 16, { width: this.contentWidth - 36 });
    this.doc.font("Helvetica").fontSize(10.5).text(subtitle, this.contentX + 18, this.cursorY + 46, { width: this.contentWidth - 36 });
    this.doc.fontSize(9.5).text(rangeLabel, this.contentX + 18, this.cursorY + 64, { width: this.contentWidth - 36 });
    this.cursorY += height + SECTION_GAP;
  }

  beginSection(title: string, subtitle?: string): void {
    this.ensureSpace(60);
    this.doc.font("Helvetica-Bold").fontSize(15).fillColor(INK).text(title, this.contentX, this.cursorY, { width: this.contentWidth });
    this.cursorY = this.doc.y + 3;
    if (subtitle) {
      this.doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(subtitle, this.contentX, this.cursorY, { width: this.contentWidth });
      this.cursorY = this.doc.y + 6;
    }
    this.doc.moveTo(this.contentX, this.cursorY).lineTo(this.contentX + this.contentWidth, this.cursorY).lineWidth(1).strokeColor(this.accentMuted).stroke();
    this.cursorY += 12;
  }

  paragraph(text: string, color = MUTED): void {
    const height = this.doc.font("Helvetica").fontSize(10.5).heightOfString(text, { width: this.contentWidth, lineGap: 2 });
    this.ensureSpace(height + 6);
    this.doc.font("Helvetica").fontSize(10.5).fillColor(color).text(text, this.contentX, this.cursorY, { width: this.contentWidth, lineGap: 2 });
    this.cursorY = this.doc.y + 6;
  }

  /** The line every section prints when its data is empty. */
  emptyNote(text = "No data in this range."): void {
    this.paragraph(text);
  }

  drawKeyValueGrid(items: ReadonlyArray<{ label: string; value: string }>, columns = 2): void {
    const columnWidth = (this.contentWidth - (columns - 1) * 14) / columns;
    for (let index = 0; index < items.length; index += columns) {
      const row = items.slice(index, index + columns);
      const rowHeight = 50;
      this.ensureSpace(rowHeight + 10);
      row.forEach((item, column) => {
        const x = this.contentX + column * (columnWidth + 14);
        this.doc.roundedRect(x, this.cursorY, columnWidth, rowHeight, 10).fillAndStroke(WHITE, BORDER);
        this.doc.font("Helvetica-Bold").fontSize(8.5).fillColor(this.accent).text(item.label.toUpperCase(), x + 10, this.cursorY + 10, { width: columnWidth - 20 });
        this.doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(item.value, x + 10, this.cursorY + 25, { width: columnWidth - 20 });
      });
      this.cursorY += rowHeight + 10;
    }
  }

  drawStatGrid(items: readonly StatCardItem[], columns = 2): void {
    const columnWidth = (this.contentWidth - (columns - 1) * 12) / columns;
    for (let index = 0; index < items.length; index += columns) {
      const row = items.slice(index, index + columns);
      const rowHeight = row.some((item) => item.note) ? 70 : 56;
      this.ensureSpace(rowHeight + 10);
      row.forEach((item, column) => {
        const x = this.contentX + column * (columnWidth + 12);
        this.doc.roundedRect(x, this.cursorY, columnWidth, rowHeight, 10).fillAndStroke(this.accentSoft, this.accentMuted);
        this.doc.font("Helvetica-Bold").fontSize(17).fillColor(this.accent).text(item.value, x + 10, this.cursorY + 9, { width: columnWidth - 20 });
        this.doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK).text(item.label, x + 10, this.cursorY + 34, { width: columnWidth - 20 });
        if (item.note) this.doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(item.note, x + 10, this.cursorY + 48, { width: columnWidth - 20 });
      });
      this.cursorY += rowHeight + 10;
    }
  }

  private drawRow(cells: readonly string[], columns: readonly TableColumn[], bold: boolean): void {
    let x = this.contentX;
    this.doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).fillColor(INK);
    columns.forEach((column, index) => {
      const width = column.width * this.contentWidth;
      this.doc.text(cells[index] ?? "", x + 4, this.cursorY + 4, { width: width - 8, align: column.align ?? "left", lineBreak: false, ellipsis: true });
      x += width;
    });
    this.cursorY += ROW_HEIGHT;
  }

  private drawTableHeader(columns: readonly TableColumn[]): void {
    this.doc.rect(this.contentX, this.cursorY, this.contentWidth, ROW_HEIGHT).fill(this.accentSoft);
    this.drawRow(columns.map((column) => column.header), columns, true);
  }

  /** A simple table; the header repeats on each new page. */
  drawTable(columns: readonly TableColumn[], rows: ReadonlyArray<readonly string[]>): void {
    this.ensureSpace(ROW_HEIGHT * 2);
    this.drawTableHeader(columns);
    rows.forEach((row) => {
      if (this.cursorY + ROW_HEIGHT > CONTENT_BOTTOM) {
        this.addPage();
        this.drawTableHeader(columns);
      }
      this.drawRow(row, columns, false);
      this.doc.moveTo(this.contentX, this.cursorY).lineTo(this.contentX + this.contentWidth, this.cursorY).lineWidth(0.5).strokeColor(BORDER).stroke();
    });
    this.cursorY += 6;
  }

  /** Horizontal bar chart: one labeled bar per item, values printed as text so nothing relies on color. */
  drawBarChart(items: readonly BarItem[]): void {
    const labelWidth = 90;
    const valueWidth = 70;
    const trackWidth = this.contentWidth - labelWidth - valueWidth;
    const max = Math.max(1, ...items.map((item) => item.value));
    items.forEach((item) => {
      this.ensureSpace(BAR_HEIGHT + 8);
      const y = this.cursorY;
      this.doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(item.label, this.contentX, y + 2, { width: labelWidth - 6, lineBreak: false });
      this.doc.rect(this.contentX + labelWidth, y, trackWidth, BAR_HEIGHT).fill(this.accentSoft);
      const barWidth = (item.value / max) * trackWidth;
      if (barWidth > 0) this.doc.rect(this.contentX + labelWidth, y, barWidth, BAR_HEIGHT).fill(this.accent);
      this.doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(item.valueLabel, this.contentX + labelWidth + trackWidth, y + 2, { width: valueWidth, align: "right", lineBreak: false });
      this.cursorY += BAR_HEIGHT + 8;
    });
  }

  private drawPageChrome(): void {
    this.doc.rect(0, 0, PAGE_WIDTH, 14).fill(this.accent);
    this.doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(LETTER_PRODUCT_NAME, PAGE_MARGIN, 30, { width: 200, lineBreak: false });
    this.doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(this.options.title, PAGE_MARGIN, 44, { width: CONTENT_WIDTH, lineBreak: false, ellipsis: true });
  }

  private writeFooters(): void {
    const range = this.doc.bufferedPageRange();
    for (let page = 0; page < range.count; page += 1) {
      this.doc.switchToPage(range.start + page);
      // Footer text sits inside the bottom margin; without this pdfkit would start a new page.
      this.doc.page.margins.bottom = 0;
      const y = PAGE_HEIGHT - PAGE_MARGIN - 2;
      this.doc.moveTo(PAGE_MARGIN, y - 12).lineTo(PAGE_WIDTH - PAGE_MARGIN, y - 12).lineWidth(1).strokeColor(BORDER).stroke();
      this.doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(`Generated on ${this.generatedLabel}`, PAGE_MARGIN, y, { width: 200, lineBreak: false });
      this.doc.text(`Page ${page + 1} of ${range.count}`, PAGE_WIDTH - PAGE_MARGIN - 100, y, { width: 100, align: "right", lineBreak: false });
    }
  }

  async finalize(): Promise<Buffer> {
    this.writeFooters();
    return new Promise<Buffer>((resolve, reject) => {
      this.doc.on("end", () => resolve(Buffer.concat(this.chunks)));
      this.doc.on("error", reject);
      this.doc.end();
    });
  }
}
