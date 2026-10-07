/**
 * SearchField.tsx
 * The labeled help search input used by the Help page and the quick help
 * panel. The label is always visible (never placeholder-as-label), the input
 * is type="search" so mobile keyboards show a search key, and a Clear button
 * appears once there is text. Height meets the 44px touch target (D20).
 */
import { forwardRef, type ChangeEvent, type ReactElement } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

interface SearchFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Optional helper line under the label (e.g. an example query). */
  readonly hint?: string;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ id, label, value, onChange, hint }, ref): ReactElement => {
    const hintId = hint ? `${id}-hint` : undefined;
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value);

    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-fg">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="text-sm text-fg-muted">
            {hint}
          </p>
        ) : null}
        <div className="relative">
          <MagnifyingGlass
            aria-hidden="true"
            size={20}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle"
          />
          <input
            ref={ref}
            id={id}
            type="search"
            value={value}
            onChange={handleChange}
            aria-describedby={hintId}
            autoComplete="off"
            spellCheck={false}
            className="min-h-12 w-full rounded-md border border-border-strong bg-surface py-2 pr-12 pl-10 text-base text-fg shadow-sm [&::-webkit-search-cancel-button]:appearance-none"
          />
          {value.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-0.5 inline-flex min-h-touch min-w-touch -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:bg-surface-sunken hover:text-fg"
            >
              <X aria-hidden="true" size={18} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }
);

SearchField.displayName = "SearchField";
