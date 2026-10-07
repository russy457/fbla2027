/**
 * IssuedLetterPanel.tsx
 * The three states after "Issue letter" (SPEC#screen-letter-flow D8):
 *   generating  progress text while the PDF is made,
 *   failed      "We couldn't create the PDF." with Retry (same request nonce),
 *   ready       Download PDF, Copy verify link, and the letter code.
 * The verify link works in every state because /verify reads the public
 * projection, not the PDF.
 */
import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { getDownloadURL, ref } from "firebase/storage";
import { DownloadSimple, LinkSimple } from "@phosphor-icons/react";
import { formatVerifyCode, type PdfStatus } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { getFirebase } from "@/lib/firebase";

interface IssuedLetterPanelProps {
  readonly verifyCode: string;
  readonly pdfStatus: PdfStatus;
  readonly pdfPath: string | null;
  readonly onRetry: () => void;
  readonly isRetrying: boolean;
}

export const verifyPathFor = (code: string): string => `/verify/${code}`;

type Feedback = { readonly kind: "idle" } | { readonly kind: "message"; readonly text: string };

export const IssuedLetterPanel = ({ verifyCode, pdfStatus, pdfPath, onRetry, isRetrying }: IssuedLetterPanelProps): ReactElement => {
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const verifyUrl = `${window.location.origin}${verifyPathFor(verifyCode)}`;

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setFeedback({ kind: "message", text: "Verify link copied." });
    } catch {
      setFeedback({ kind: "message", text: "Copy didn't work. Select the link below and copy it." });
    }
  };

  const downloadPdf = async (): Promise<void> => {
    if (!pdfPath) return;
    try {
      const url = await getDownloadURL(ref(getFirebase().storage, pdfPath));
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setFeedback({ kind: "message", text: "We couldn't open the PDF. Try again in a moment." });
    }
  };

  return (
    <section aria-labelledby="issued-letter-title" className="flex flex-col gap-3 border-l-4 border-status-success bg-surface py-4 pr-4 pl-5">
      <h3 id="issued-letter-title" className="text-lg font-semibold text-fg">
        Your letter is issued
      </h3>
      <p aria-live="polite" className="text-fg-muted">
        {pdfStatus === "generating" ? "Creating your PDF..." : null}
        {pdfStatus === "failed" ? "We couldn't create the PDF." : null}
        {pdfStatus === "ready" ? "Your PDF is ready." : null}
      </p>
      <p className="text-sm text-fg-muted">
        Letter code <span className="font-mono font-semibold text-fg">{formatVerifyCode(verifyCode)}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {pdfStatus === "ready" ? (
          <button type="button" onClick={() => void downloadPdf()} className={buttonClassName("primary")}>
            <DownloadSimple aria-hidden="true" size={18} />
            Download PDF
          </button>
        ) : null}
        {pdfStatus === "failed" ? (
          <button type="button" onClick={onRetry} disabled={isRetrying} className={buttonClassName("primary")}>
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        ) : null}
        <button type="button" onClick={() => void copyLink()} className={buttonClassName("secondary")}>
          <LinkSimple aria-hidden="true" size={18} />
          Copy verify link
        </button>
        <Link to={verifyPathFor(verifyCode)} className={buttonClassName("quiet")}>
          Open verify page
        </Link>
      </div>
      <p className="font-mono text-xs break-all text-fg-muted">{verifyUrl}</p>
      {feedback.kind === "message" ? (
        <p role="status" className="text-sm font-medium text-fg">
          {feedback.text}
        </p>
      ) : null}
    </section>
  );
};
