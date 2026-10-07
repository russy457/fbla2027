/**
 * TextField.tsx
 * Labeled input that follows the form contract: label above, optional hint,
 * error below, and aria-describedby wiring so screen readers read the hint
 * and the error with the field. Works with react-hook-form's register() via
 * forwardRef. Never uses a placeholder as the label.
 */
import { forwardRef, useId, type InputHTMLAttributes, type ReactElement } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly inputClassName?: string;
}

export const INPUT_CLASSES =
  "min-h-touch w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-fg " +
  "transition-colors duration-(--duration-fast) placeholder:text-fg-subtle hover:border-fg-muted " +
  "aria-[invalid=true]:border-status-danger disabled:cursor-not-allowed disabled:bg-surface-sunken";

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, className, inputClassName, ...inputProps }, ref): ReactElement => {
    const id = useId();
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <label htmlFor={id} className="text-sm font-semibold text-fg">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="text-sm text-fg-muted">
            {hint}
          </p>
        ) : null}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(INPUT_CLASSES, inputClassName)}
          {...inputProps}
        />
        {error ? (
          <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-status-danger">
            <WarningCircle aria-hidden="true" size={18} className="mt-px shrink-0" />
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);
TextField.displayName = "TextField";
