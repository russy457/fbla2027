/**
 * DisplayPreferences.tsx
 * Accessibility controls (plan E3, D18, D21): text size 100/125/150%, high
 * contrast, and reduce motion. Changes apply instantly through data
 * attributes on <html> (see preferencesStore.ts) and are remembered on this
 * device. Uses native radio buttons and checkboxes inside a fieldset so every
 * control works with a keyboard and a screen reader without extra ARIA.
 */
import type { ChangeEvent, ReactElement } from "react";
import { usePreferencesStore, type TextSize } from "@/store/preferencesStore";

const TEXT_SIZE_OPTIONS: ReadonlyArray<{ value: TextSize; label: string }> = [
  { value: "100", label: "100%" },
  { value: "125", label: "125%" },
  { value: "150", label: "150%" }
];

const choiceClass =
  "inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm text-fg " +
  "has-[:checked]:border-accent has-[:checked]:bg-accent-subtle has-[:focus-visible]:outline " +
  "has-[:focus-visible]:outline-(length:--focus-ring-width) has-[:focus-visible]:outline-focus";

export const DisplayPreferences = (): ReactElement => {
  const { textSize, contrast, motion, setTextSize, setContrast, setMotion } = usePreferencesStore();

  const handleTextSize = (event: ChangeEvent<HTMLInputElement>) => setTextSize(event.target.value as TextSize);

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-fg">Display</legend>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-6">
        <div role="radiogroup" aria-label="Text size" className="flex flex-wrap items-center gap-2">
          <span aria-hidden="true" className="text-sm text-fg-muted">
            Text size
          </span>
          {TEXT_SIZE_OPTIONS.map((option) => (
            <label key={option.value} className={choiceClass}>
              <input
                type="radio"
                name="text-size"
                value={option.value}
                checked={textSize === option.value}
                onChange={handleTextSize}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <label className={choiceClass}>
            <input
              type="checkbox"
              checked={contrast === "high"}
              onChange={(event) => setContrast(event.target.checked ? "high" : "standard")}
              className="size-4 accent-(--accent)"
            />
            High contrast
          </label>
          <label className={choiceClass}>
            <input
              type="checkbox"
              checked={motion === "reduced"}
              onChange={(event) => setMotion(event.target.checked ? "reduced" : "system")}
              className="size-4 accent-(--accent)"
            />
            Reduce motion
          </label>
        </div>
      </div>
    </fieldset>
  );
};
