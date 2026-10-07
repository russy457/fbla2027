/**
 * VerifyResult.tsx
 * The public verification of one letter, in the order SPEC#letters (D3)
 * requires: 1) status band with icon + text (never color alone),
 * 2) display name, verified hours, date range, organizations, 3) issue date
 * and code, 4) "What this means". Presentational only: the page loads the
 * projection and passes it in, so tests can render every status.
 */
import type { ReactElement } from "react";
import { CheckCircle, MinusCircle, XCircle, type Icon } from "@phosphor-icons/react";
import { DEFAULT_TIME_ZONE, formatLongDate, formatVerifyCode, formatYmd, type LetterStatus } from "@fbla/shared";
import type { LetterVerification } from "@/lib/data/records";
import { formatMinutesAsHours } from "@/lib/formatHours";
import { cn } from "@/lib/cn";

interface BandCopy {
  readonly title: string;
  readonly detail: string;
  readonly icon: Icon;
  readonly classes: string;
}

/** Status band copy, word for word from SPEC#letters. */
export const statusBandCopy = (verification: Pick<LetterVerification, "status" | "supersededByIssuedAt" | "revokeReasonLabel">): BandCopy => {
  const bands: Readonly<Record<LetterStatus, () => BandCopy>> = {
    valid: () => ({
      title: "Valid",
      detail: "This letter is current.",
      icon: CheckCircle,
      classes: "border-status-success bg-status-success-subtle text-status-success"
    }),
    superseded: () => ({
      title: "Superseded",
      detail: verification.supersededByIssuedAt
        ? `A newer letter was issued on ${formatLongDate(verification.supersededByIssuedAt.toDate(), DEFAULT_TIME_ZONE)}.`
        : "The hours on this letter changed after it was issued.",
      icon: MinusCircle,
      classes: "border-status-neutral bg-status-neutral-subtle text-status-neutral"
    }),
    revoked: () => ({
      title: "Revoked",
      detail: `This letter was revoked: ${verification.revokeReasonLabel ?? "Other"}.`,
      icon: XCircle,
      classes: "border-status-danger bg-status-danger-subtle text-status-danger"
    })
  };
  return bands[verification.status]();
};

interface VerifyResultProps {
  readonly verifyCode: string;
  readonly verification: LetterVerification;
}

export const VerifyResult = ({ verifyCode, verification }: VerifyResultProps): ReactElement => {
  const band = statusBandCopy(verification);
  const BandIcon = band.icon;
  return (
    <article aria-labelledby="verify-status" className="flex flex-col gap-8">
      <div role="status" className={cn("flex items-start gap-4 rounded-lg border-2 p-5", band.classes)}>
        <BandIcon aria-hidden="true" size={40} weight="fill" className="shrink-0" />
        <div className="flex flex-col gap-1">
          <h2 id="verify-status" className="text-3xl font-bold tracking-tight">
            {band.title}
          </h2>
          <p className="text-base font-medium text-fg">{band.detail}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-sm font-semibold text-fg-muted">Volunteer</dt>
          <dd className="text-xl font-semibold text-fg">{verification.displayName}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-sm font-semibold text-fg-muted">Verified hours</dt>
          <dd className="font-mono text-xl font-semibold text-fg">{formatMinutesAsHours(verification.totalMinutes)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-sm font-semibold text-fg-muted">Dates covered</dt>
          <dd className="text-fg">
            {formatYmd(verification.from)} to {formatYmd(verification.to)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-sm font-semibold text-fg-muted">Organizations</dt>
          <dd className="text-fg">{verification.orgNames.length > 0 ? verification.orgNames.join(", ") : "None listed"}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-sm font-semibold text-fg-muted">Issued</dt>
          <dd className="text-fg">{formatLongDate(verification.issuedAt.toDate(), DEFAULT_TIME_ZONE)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-sm font-semibold text-fg-muted">Letter code</dt>
          <dd className="font-mono break-all text-fg">{formatVerifyCode(verifyCode)}</dd>
        </div>
      </dl>

      <section aria-labelledby="what-this-means" className="flex max-w-[65ch] flex-col gap-2 border-t border-border pt-6">
        <h2 id="what-this-means" className="text-lg font-semibold text-fg">
          What this means
        </h2>
        <p className="text-fg-muted">
          These hours come from shift check-ins or coordinator-approved records at verified organizations. This page always shows
          the letter's current status. If a PDF shows different numbers than this page, the PDF was edited and should not be
          trusted.
        </p>
      </section>
    </article>
  );
};
