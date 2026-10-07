/**
 * CsvColumnPicker.tsx
 * Chooses the columns of the CSV export (SPEC 8.6: CSV is built in the
 * browser from data the person can already read). Columns come from the
 * shared CSV column lists, so the header labels match the PDF wording.
 * Collapsed by default inside a <details> so the main flow stays short.
 */
import type { ReactElement } from "react";
import { CSV_COLUMN_LABELS, type CsvColumn } from "@fbla/shared";

interface CsvColumnPickerProps {
  readonly columns: readonly CsvColumn[];
  readonly selected: readonly CsvColumn[];
  readonly onChange: (next: CsvColumn[]) => void;
}

export const CsvColumnPicker = ({ columns, selected, onChange }: CsvColumnPickerProps): ReactElement => (
  <details className="rounded-md border border-border bg-surface px-3 py-2">
    <summary className="min-h-touch cursor-pointer content-center text-sm font-semibold text-fg">CSV columns ({selected.length} of {columns.length})</summary>
    <fieldset className="flex flex-col gap-1 pt-2">
      <legend className="sr-only">CSV columns</legend>
      {columns.map((column) => {
        const checked = selected.includes(column);
        return (
          <label key={column} className="flex min-h-touch items-center gap-3 text-fg">
            <input
              type="checkbox"
              className="size-5 accent-(--accent)"
              checked={checked}
              disabled={checked && selected.length === 1}
              onChange={(event) => onChange(columns.filter((key) => (key === column ? event.target.checked : selected.includes(key))))}
            />
            {CSV_COLUMN_LABELS[column]}
          </label>
        );
      })}
    </fieldset>
  </details>
);
