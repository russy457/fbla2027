/**
 * RepeatChoice.tsx
 * "Just once" or "Repeats" for the When step of a new shift (Tier 2). A
 * native radio group styled as a two-part segmented control, so arrow keys
 * move between the options and screen readers announce the group.
 */
import { useId, type ReactElement } from "react";

interface RepeatChoiceProps {
  readonly repeats: boolean;
  readonly onChange: (repeats: boolean) => void;
}

const OPTION_CLASSES =
  "relative inline-flex min-h-touch cursor-pointer items-center px-4 text-sm font-semibold text-fg-muted transition-colors duration-(--duration-fast) " +
  "hover:text-fg has-[:checked]:bg-accent has-[:checked]:text-accent-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-focus";

export const RepeatChoice = ({ repeats, onChange }: RepeatChoiceProps): ReactElement => {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-fg">Schedule</legend>
      <div className="inline-flex w-fit overflow-hidden rounded-md border border-border-strong bg-surface">
        <label className={OPTION_CLASSES}>
          <input type="radio" name={name} checked={!repeats} onChange={() => onChange(false)} className="absolute inset-0 m-0 cursor-pointer opacity-0" />
          Just once
        </label>
        <label className={`${OPTION_CLASSES} border-l border-border-strong`}>
          <input type="radio" name={name} checked={repeats} onChange={() => onChange(true)} className="absolute inset-0 m-0 cursor-pointer opacity-0" />
          Repeats
        </label>
      </div>
    </fieldset>
  );
};
