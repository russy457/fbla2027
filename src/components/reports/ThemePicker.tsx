/**
 * ThemePicker.tsx
 * One of six preset report themes (SPEC 8.6, D16; replaces the old free-hex
 * ColorPicker, PORT_LEDGER 6c). Every preset is contrast-checked to 4.5:1 in
 * shared/reports.ts, so there is no way to pick an unreadable color. A radio
 * group; the swatch is decorative (the label always names the theme). The
 * swatch color is the PDF accent from shared data, applied inline because it
 * describes the printed document, not the app's own palette.
 */
import type { ReactElement } from "react";
import { REPORT_THEMES, REPORT_THEME_IDS, type ReportThemeId } from "@fbla/shared";
import { cn } from "@/lib/cn";

interface ThemePickerProps {
  readonly value: ReportThemeId;
  readonly onChange: (next: ReportThemeId) => void;
}

export const ThemePicker = ({ value, onChange }: ThemePickerProps): ReactElement => (
  <fieldset className="flex flex-col gap-2">
    <legend className="mb-1 text-sm font-semibold text-fg">PDF theme</legend>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {REPORT_THEME_IDS.map((id) => {
        const theme = REPORT_THEMES[id];
        const checked = value === id;
        return (
          <label
            key={id}
            className={cn(
              "flex min-h-touch cursor-pointer items-center gap-2 rounded-md border px-3 text-sm text-fg transition-colors duration-(--duration-fast)",
              checked ? "border-accent bg-accent-subtle font-semibold" : "border-border hover:bg-surface-sunken"
            )}
          >
            <input type="radio" name="report-theme" value={id} checked={checked} onChange={() => onChange(id)} className="size-4 accent-(--accent)" />
            <span aria-hidden="true" className="size-4 rounded-full border border-border-strong" style={{ backgroundColor: theme.accent }} />
            {theme.label}
          </label>
        );
      })}
    </div>
  </fieldset>
);
