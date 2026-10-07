/**
 * buttonStyles.ts
 * Class names for buttons and button-like links, built only from token-backed
 * utilities. 44px minimum height (D20), visible focus from the global
 * :focus-visible rule, and a small press-down on :active for tactile feedback.
 */
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "quiet";

const BASE =
  "inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold " +
  "transition-[background-color,color,border-color,transform] duration-(--duration-fast) ease-out " +
  "active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "border border-border-strong bg-surface text-fg hover:bg-surface-sunken",
  quiet: "text-fg-muted hover:bg-surface-sunken hover:text-fg"
};

export const buttonClassName = (variant: ButtonVariant = "primary", extra?: string): string =>
  cn(BASE, VARIANTS[variant], extra);
