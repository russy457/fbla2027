/**
 * HighlightedText.tsx
 * Renders plain text with matched search words wrapped in <mark>. Each piece
 * is a React text node, so text from anywhere (article titles, a typed
 * query) can never become markup. Matches are underlined as well as tinted,
 * so the highlight does not rely on color alone (SPEC 9.16).
 */
import type { ReactElement } from "react";
import { splitHighlights } from "@/lib/help";

interface HighlightedTextProps {
  readonly text: string;
  readonly terms: readonly string[];
}

const MARK_CLASS =
  "rounded-sm bg-accent-subtle px-0.5 text-fg underline decoration-accent decoration-2 underline-offset-2";

export const HighlightedText = ({ text, terms }: HighlightedTextProps): ReactElement => (
  <>
    {splitHighlights(text, terms).map((segment, index) =>
      segment.isMatch ? (
        <mark key={index} className={MARK_CLASS}>
          {segment.text}
        </mark>
      ) : (
        <span key={index}>{segment.text}</span>
      )
    )}
  </>
);
