/**
 * DownloadButton.tsx
 * The PDF states after "Generate PDF" (SPEC 8.6: generating, failed with
 * Retry using the same nonce, ready with Download; port of the old
 * ReportBuilder/DownloadButton with the D8 states added). The PDF is private
 * to its owner: Download asks a Function for a 5-minute link (getUrl, which
 * re-checks ownership server side), never a permanent Storage download URL.
 */
import { useState, type ReactElement } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import type { ReportStatus } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";

interface DownloadButtonProps {
  readonly status: ReportStatus;
  /** Resolves a short-lived link to the ready PDF. */
  readonly getUrl: () => Promise<string>;
  readonly onRetry: () => void;
  readonly isRetrying: boolean;
}

const STATUS_TEXT: Readonly<Record<ReportStatus, string>> = {
  generating: "Creating your PDF...",
  failed: "We couldn't create the PDF.",
  ready: "Your PDF is ready."
};

export const DownloadButton = ({ status, getUrl, onRetry, isRetrying }: DownloadButtonProps): ReactElement => {
  const [message, setMessage] = useState<string | null>(null);

  const download = async (): Promise<void> => {
    setMessage(null);
    try {
      const url = await getUrl();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setMessage("We couldn't open the PDF. Try again in a moment.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p aria-live="polite" className="text-sm font-medium text-fg">
        {STATUS_TEXT[status]}
      </p>
      {status === "ready" ? (
        <button type="button" onClick={() => void download()} className={buttonClassName("primary")}>
          <DownloadSimple aria-hidden="true" size={18} />
          Download PDF
        </button>
      ) : null}
      {status === "failed" ? (
        <button type="button" onClick={onRetry} disabled={isRetrying} className={buttonClassName("primary")}>
          {isRetrying ? "Retrying..." : "Retry"}
        </button>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-fg">
          {message}
        </p>
      ) : null}
    </div>
  );
};
