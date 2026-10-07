/**
 * LetterPreview.tsx
 * The per-organization table a letter will contain (SPEC#letters PDF layout,
 * D8): organization, verified (icon + word), hours, and the total, with the
 * inline line "Hours excluded: N from unverified orgs" whenever unverified
 * hours fall in the range.
 */
import type { ReactElement } from "react";
import type { EvidenceSummary } from "@fbla/shared";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMinutesAsHours } from "@/lib/formatHours";

interface LetterPreviewProps {
  readonly summary: EvidenceSummary;
}

export const LetterPreview = ({ summary }: LetterPreviewProps): ReactElement => (
  <div className="flex min-w-0 flex-col gap-3">
    {/* At large text sizes on a phone the table scrolls inside its own box instead of widening the page (D21). */}
    <div className="max-w-full overflow-x-auto">
    <table className="w-full text-left text-sm">
      <caption className="sr-only">Hours this letter will include, by organization</caption>
      <thead>
        <tr className="border-b border-border-strong text-fg-muted">
          <th scope="col" className="py-2 pr-3 font-semibold">
            Organization
          </th>
          <th scope="col" className="py-2 pr-3 font-semibold">
            Verified
          </th>
          <th scope="col" className="py-2 text-right font-semibold">
            Hours
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {summary.perOrg.map((row) => (
          <tr key={row.orgId}>
            <td className="py-2 pr-3 text-fg">{row.orgName}</td>
            <td className="py-2 pr-3">
              <StatusBadge tone={row.verified ? "success" : "neutral"} label={row.verified ? "Yes" : "No, not counted"} />
            </td>
            <td className="py-2 text-right font-mono text-fg tabular-nums">{formatMinutesAsHours(row.minutes)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-border-strong">
          <th scope="row" colSpan={2} className="py-2 pr-3 font-semibold text-fg">
            Total on the letter
          </th>
          <td className="py-2 text-right font-mono font-semibold text-fg tabular-nums">{formatMinutesAsHours(summary.totalMinutes)}</td>
        </tr>
      </tfoot>
    </table>
    </div>
    {summary.excludedUnverifiedMinutes > 0 ? (
      <p className="text-sm text-fg-muted">Hours excluded: {formatMinutesAsHours(summary.excludedUnverifiedMinutes)} from unverified orgs</p>
    ) : null}
  </div>
);
