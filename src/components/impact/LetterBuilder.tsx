/**
 * LetterBuilder.tsx
 * Build and issue a verified hours letter (SPEC#screen-letter-flow D8,
 * SPEC#fn-issueletter). Scope is all organizations or one, plus a date range
 * (validated with zod: real dates, start before end, end not in the future).
 * The preview updates as the scope changes. One request nonce is kept per
 * scope ("one per user intent"): a retry after a failure reuses it, so the
 * server returns the same letter instead of issuing a second one.
 */
import { useMemo, useRef, useState, type ReactElement } from "react";
import { ALL_ORGS, DEFAULT_TIME_ZONE, clock, localDateIn, type UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { INPUT_CLASSES, TextField } from "@/components/ui/TextField";
import { ApiError, NETWORK_USER_ERROR, api, newRequestNonce } from "@/lib/api";
import type { Organization } from "@/lib/data/orgs";
import type { HoursLog, Letter } from "@/lib/data/records";
import { defaultLetterRange, previewLetter, type LetterScopeInput } from "@/lib/letterPreview";
import { letterRangeSchema } from "@/lib/validation/formSchemas";
import { IssuedLetterPanel } from "./IssuedLetterPanel";
import { LetterPreview } from "./LetterPreview";

interface LetterBuilderProps {
  readonly logs: readonly HoursLog[];
  readonly orgs: readonly Organization[];
  /** Live letters, used to follow the issued letter's PDF status. */
  readonly letters: readonly Letter[];
}

interface Issued {
  readonly letterId: string;
  readonly verifyCode: string;
  readonly pdfStatus: Letter["pdfStatus"];
}

type FieldErrors = Partial<Record<"from" | "to", string>>;

export const LetterBuilder = ({ logs, orgs, letters }: LetterBuilderProps): ReactElement => {
  const [scope, setScope] = useState<LetterScopeInput>(() => ({ orgId: ALL_ORGS, ...defaultLetterRange(logs, clock.now()) }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<UserError | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const nonce = useRef(newRequestNonce());

  const summary = useMemo(() => previewLetter(logs, orgs, scope), [logs, orgs, scope]);
  const orgOptions = useMemo(() => [...new Set(logs.map((log) => log.orgId))], [logs]);
  const orgName = (orgId: string): string => orgs.find((org) => org.id === orgId)?.name ?? "Unknown organization";

  const updateScope = (patch: Partial<LetterScopeInput>): void => {
    setScope((current) => ({ ...current, ...patch }));
    nonce.current = newRequestNonce(); // a different scope is a new intent
    setIssued(null);
    setError(null);
  };

  const issue = async (): Promise<void> => {
    const parsed = letterRangeSchema(localDateIn(clock.now(), DEFAULT_TIME_ZONE)).safeParse(scope);
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    setFieldErrors({});
    setError(null);
    setIsIssuing(true);
    try {
      const result = await api.volunteer.issueLetter({ scope: parsed.data, requestNonce: nonce.current });
      setIssued({ letterId: result.letterId, verifyCode: result.verifyCode, pdfStatus: result.pdfStatus });
    } catch (issueError) {
      setError(issueError instanceof ApiError ? issueError.userError : NETWORK_USER_ERROR);
    } finally {
      setIsIssuing(false);
    }
  };

  const liveLetter = issued ? letters.find((letter) => letter.id === issued.letterId) : undefined;

  return (
    <section id="letter-builder" aria-labelledby="letter-builder-title" className="flex flex-col gap-5">
      <h2 id="letter-builder-title" className="text-xl font-semibold text-fg">
        Get a verified letter
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="letter-org" className="text-sm font-semibold text-fg">
            Organizations
          </label>
          <select id="letter-org" value={scope.orgId} onChange={(event) => updateScope({ orgId: event.target.value })} className={INPUT_CLASSES}>
            <option value={ALL_ORGS}>All organizations</option>
            {orgOptions.map((orgId) => (
              <option key={orgId} value={orgId}>
                {orgName(orgId)}
              </option>
            ))}
          </select>
        </div>
        <TextField label="From" type="date" value={scope.from} error={fieldErrors.from} onChange={(event) => updateScope({ from: event.target.value })} />
        <TextField label="To" type="date" value={scope.to} error={fieldErrors.to} onChange={(event) => updateScope({ to: event.target.value })} />
      </div>

      <LetterPreview summary={summary} />

      {error ? <ErrorNotice error={error} /> : null}
      {issued ? (
        <IssuedLetterPanel
          verifyCode={issued.verifyCode}
          pdfStatus={liveLetter?.pdfStatus ?? issued.pdfStatus}
          pdfPath={liveLetter?.pdfPath ?? null}
          onRetry={() => void issue()}
          isRetrying={isIssuing}
        />
      ) : (
        <button type="button" onClick={() => void issue()} disabled={isIssuing || summary.totalMinutes === 0} className={buttonClassName("primary", "w-fit")}>
          {isIssuing ? "Issuing letter..." : "Issue letter"}
        </button>
      )}
      {summary.totalMinutes === 0 && !issued ? (
        <p className="text-sm text-fg-muted">There are no approved hours from verified organizations in this range.</p>
      ) : null}
    </section>
  );
};
