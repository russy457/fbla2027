/**
 * SectionSelector.tsx
 * Section toggles for a report (SPEC 8.6 customization; port of the old
 * ReportBuilder/SectionSelector, PORT_LEDGER 6c). Section keys and labels come
 * from shared/reports.ts, so the builder and the PDF list the same sections.
 * A checkbox group in a fieldset; at least one section must stay on.
 */
import type { ReactElement } from "react";
import { REPORT_SECTION_LABELS, sectionsFor, type ReportKind, type ReportSection } from "@fbla/shared";

interface SectionSelectorProps {
  readonly kind: ReportKind;
  readonly selected: readonly ReportSection[];
  readonly onChange: (next: ReportSection[]) => void;
}

export const SectionSelector = ({ kind, selected, onChange }: SectionSelectorProps): ReactElement => {
  const all = sectionsFor(kind);
  const toggle = (section: ReportSection, checked: boolean): void =>
    onChange(all.filter((key) => (key === section ? checked : selected.includes(key))));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-fg">Sections</legend>
      {all.map((section) => {
        const checked = selected.includes(section);
        const isLastOn = checked && selected.length === 1;
        return (
          <label key={section} className="flex min-h-touch items-center gap-3 text-fg">
            <input
              type="checkbox"
              className="size-5 accent-(--accent)"
              checked={checked}
              disabled={isLastOn}
              onChange={(event) => toggle(section, event.target.checked)}
            />
            {REPORT_SECTION_LABELS[section]}
          </label>
        );
      })}
      <p className="text-sm text-fg-muted">Keep at least one section on.</p>
    </fieldset>
  );
};
