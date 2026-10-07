/**
 * LetterList.tsx
 * Letters the volunteer has issued, newest first, each with its status
 * (valid, superseded, revoked as icon + text, D14), hours, date range, and
 * its public verify link (SPEC#screen-inventory "Impact": letters list).
 * Empty state copy per D6.
 */
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { DEFAULT_TIME_ZONE, formatLongDate, formatVerifyCode, formatYmd } from "@fbla/shared";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Letter } from "@/lib/data/records";
import { formatMinutesAsHours } from "@/lib/formatHours";
import { LETTER_STATUS_LABELS } from "@/lib/statusLabels";
import { verifyPathFor } from "./IssuedLetterPanel";

interface LetterListProps {
  readonly letters: readonly Letter[];
}

export const LetterList = ({ letters }: LetterListProps): ReactElement => (
  <section aria-labelledby="letters-title" className="flex flex-col gap-3">
    <h2 id="letters-title" className="text-xl font-semibold text-fg">
      Your letters
    </h2>
    {letters.length === 0 ? (
      <p className="text-fg-muted">No letters yet. Issue one above once you have approved hours.</p>
    ) : (
      <ul className="divide-y divide-border border-y border-border">
        {letters.map((letter) => {
          const status = LETTER_STATUS_LABELS[letter.status];
          return (
            <li key={letter.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-0.5">
                <p className="font-semibold text-fg">
                  {formatMinutesAsHours(letter.evidence.totalMinutes)}, {formatYmd(letter.evidence.from)} to {formatYmd(letter.evidence.to)}
                </p>
                <p className="text-sm text-fg-muted">
                  Issued {formatLongDate(letter.issuedAt.toDate(), DEFAULT_TIME_ZONE)}. Code{" "}
                  <span className="font-mono">{formatVerifyCode(letter.verifyCode)}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge tone={status.tone} label={status.label} />
                <Link
                  to={verifyPathFor(letter.verifyCode)}
                  className="inline-flex min-h-touch items-center text-sm font-semibold text-accent underline underline-offset-2"
                >
                  Verify page
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);
