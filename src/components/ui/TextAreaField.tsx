/**
 * TextAreaField.tsx
 * Multi-line counterpart of TextField: label above, optional hint, error
 * below, aria-describedby wiring (D20 form contract). Used for reasons and
 * notes on coordinator actions (reject reason, attendance note).
 */
import { forwardRef, useId, type ReactElement, type TextareaHTMLAttributes } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { INPUT_CLASSES } from "./TextField";

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, hint, error, className, rows = 3, ...props }, ref): ReactElement => {
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
        <textarea ref={ref} id={id} rows={rows} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={INPUT_CLASSES} {...props} />
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
TextAreaField.displayName = "TextAreaField";
