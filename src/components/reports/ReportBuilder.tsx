/**
 * ReportBuilder.tsx
 * Customizable report builder (SPEC 8.6, screen "Reports"; rewrite of the
 * old ReportBuilder, PORT_LEDGER 6c): filters (date range, and for org
 * reports one opportunity), section toggles, one of six themes, a live
 * preview, Generate PDF (server), and Export CSV (browser, chosen columns).
 *
 * One request nonce is kept per set of inputs: a retry after "failed" reuses
 * it (SPEC 5.1), and changing any input starts a new one. There is no
 * optimistic UI; the PDF state comes from the op's answer.
 * `usePreview` is a hook passed in by the page (a stable module function),
 * so this component stays the same for both report kinds.
 */
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { FileCsv, FilePdf } from "@phosphor-icons/react";
import {
  DEFAULT_REPORT_THEME,
  ORG_CSV_COLUMNS,
  VOLUNTEER_CSV_COLUMNS,
  reportCsv,
  sectionsFor,
  type CsvColumn,
  type ReportKind,
  type ReportSection,
  type ReportStatus,
  type ReportThemeId,
  type UserError
} from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { INPUT_CLASSES } from "@/components/ui/TextField";
import { ApiError, NETWORK_USER_ERROR, newRequestNonce } from "@/lib/api";
import { CsvColumnPicker } from "./CsvColumnPicker";
import { DateRangeFields, rangeError, type DateRange } from "./DateRangeFields";
import { DownloadButton } from "./DownloadButton";
import { ReportPreview, type ReportPreviewData } from "./ReportPreview";
import { SectionSelector } from "./SectionSelector";
import { ThemePicker } from "./ThemePicker";

export interface ReportFilters extends DateRange {
  readonly opportunityId: string | null;
}

export interface PreviewState {
  readonly preview: ReportPreviewData | undefined;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly opportunities: ReadonlyArray<{ readonly id: string; readonly title: string }>;
}

export interface GenerateArgs extends ReportFilters {
  readonly sections: ReportSection[];
  readonly themeId: ReportThemeId;
  readonly requestNonce: string;
}

export interface GeneratedReport {
  readonly status: ReportStatus;
  readonly pdfPath: string;
}

interface ReportBuilderProps {
  readonly kind: ReportKind;
  readonly initialRange: DateRange;
  /** Latest selectable date (today in the report zone). */
  readonly maxDate: string;
  readonly usePreview: (filters: ReportFilters) => PreviewState;
  readonly generate: (args: GenerateArgs) => Promise<GeneratedReport>;
  /** Coordinators and admins see error details expanded (D22). */
  readonly expandErrorDetails: boolean;
}

/** Saves text as a file through a temporary object URL. */
const downloadText = (text: string, filename: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const ReportBuilder = ({ kind, initialRange, maxDate, usePreview, generate, expandErrorDetails }: ReportBuilderProps): ReactElement => {
  const csvColumns: readonly CsvColumn[] = kind === "org-participation" ? ORG_CSV_COLUMNS : VOLUNTEER_CSV_COLUMNS;
  const [range, setRange] = useState<DateRange>(initialRange);
  const [opportunityId, setOpportunityId] = useState<string | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([...sectionsFor(kind)]);
  const [themeId, setThemeId] = useState<ReportThemeId>(DEFAULT_REPORT_THEME);
  const [columns, setColumns] = useState<CsvColumn[]>([...csvColumns]);
  const [nonce, setNonce] = useState(newRequestNonce);
  const [result, setResult] = useState<GeneratedReport | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<UserError | null>(null);

  const inputsKey = JSON.stringify([range, opportunityId, sections, themeId]);
  useEffect(() => {
    // New inputs are a new intent: new nonce, and the old PDF no longer matches.
    setNonce(newRequestNonce());
    setResult(null);
    setError(null);
  }, [inputsKey]);

  const filters = useMemo(() => ({ ...range, opportunityId }), [range, opportunityId]);
  const preview = usePreview(filters);
  const invalidRange = rangeError(range);

  const runGenerate = async (): Promise<void> => {
    setIsPending(true);
    setError(null);
    try {
      setResult(await generate({ ...filters, sections, themeId, requestNonce: nonce }));
    } catch (generateError) {
      setError(generateError instanceof ApiError ? generateError.userError : NETWORK_USER_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const exportCsv = (): void => {
    if (!preview.preview) return;
    downloadText(reportCsv(columns, preview.preview.data.rows), `${kind}-${range.from}-to-${range.to}.csv`);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(18rem,22rem)_1fr]">
      <form className="flex flex-col gap-6" onSubmit={(event) => { event.preventDefault(); void runGenerate(); }}>
        <DateRangeFields value={range} max={maxDate} onChange={setRange} />
        {kind === "org-participation" ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="report-opportunity" className="text-sm font-semibold text-fg">Opportunity</label>
            <select id="report-opportunity" className={INPUT_CLASSES} value={opportunityId ?? ""} onChange={(event) => setOpportunityId(event.target.value === "" ? null : event.target.value)}>
              <option value="">All opportunities</option>
              {preview.opportunities.map((option) => (
                <option key={option.id} value={option.id}>{option.title}</option>
              ))}
            </select>
          </div>
        ) : null}
        <SectionSelector kind={kind} selected={sections} onChange={setSections} />
        <ThemePicker value={themeId} onChange={setThemeId} />
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <button type="submit" disabled={isPending || invalidRange !== null} className={buttonClassName("primary")}>
            <FilePdf aria-hidden="true" size={18} />
            {isPending ? "Generating PDF..." : "Generate PDF"}
          </button>
          {result ? <DownloadButton status={result.status} pdfPath={result.pdfPath} onRetry={() => void runGenerate()} isRetrying={isPending} /> : null}
          {error ? <ErrorNotice error={error} expandDetails={expandErrorDetails} /> : null}
          <CsvColumnPicker columns={csvColumns} selected={columns} onChange={setColumns} />
          <button type="button" onClick={exportCsv} disabled={!preview.preview || invalidRange !== null} className={buttonClassName("secondary")}>
            <FileCsv aria-hidden="true" size={18} />
            Export CSV
          </button>
        </div>
      </form>
      <div aria-live="polite">
        {invalidRange !== null ? <p className="text-fg-muted">{invalidRange}</p> : null}
        {invalidRange === null && preview.error ? <ErrorState title="We couldn't load the preview" description="Check your connection, then reload." /> : null}
        {invalidRange === null && !preview.error && preview.isLoading ? <LoadingState label="Loading the preview" /> : null}
        {invalidRange === null && preview.preview ? <ReportPreview preview={preview.preview} sections={sections} from={range.from} to={range.to} /> : null}
      </div>
    </div>
  );
};
