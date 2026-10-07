/**
 * RevokeLetterByCode.tsx
 * Admin tool to revoke any letter (SPEC 4.1 admin "revoke any letter",
 * SPEC#fn-revokeletter): type the code printed on the letter (spaces and
 * dashes ignored, normalizeVerifyCode), find the letter (admins may read
 * letters), check the name, period, and status, then revoke with a reason.
 */
import { useState, type FormEvent, type ReactElement } from "react";
import { VERIFY_CODE_PATTERN, formatYmd, normalizeVerifyCode } from "@fbla/shared";
import { OpFeedback } from "@/components/org/OpFeedback";
import { RevokeLetterForm } from "@/components/org/RevokeLetterForm";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TextField } from "@/components/ui/TextField";
import { useOpRunner } from "@/hooks/useOpRunner";
import { findLetterByVerifyCode } from "@/lib/data/adminData";
import type { Letter } from "@/lib/data/records";
import { LETTER_STATUS_LABELS } from "@/lib/statusLabels";

type Lookup = { readonly state: "idle" | "searching" | "missing" } | { readonly state: "found"; readonly letter: Letter };

export const RevokeLetterByCode = (): ReactElement => {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const runner = useOpRunner();

  const find = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const normalized = normalizeVerifyCode(code);
    if (!VERIFY_CODE_PATTERN.test(normalized)) return setCodeError("Enter the 26-character letter code.");
    setCodeError(undefined);
    setLookup({ state: "searching" });
    try {
      const letter = await findLetterByVerifyCode(normalized);
      setLookup(letter ? { state: "found", letter } : { state: "missing" });
    } catch {
      setCodeError("We couldn't look up that code. Check your connection and try again.");
      setLookup({ state: "idle" });
    }
  };

  return (
    <section aria-labelledby="revoke-code-title" className="flex flex-col gap-3">
      <h2 id="revoke-code-title" className="text-xl font-semibold text-fg">Revoke a letter</h2>
      <form onSubmit={(event) => void find(event)} noValidate className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
        <TextField label="Letter code" value={code} onChange={(event) => setCode(event.target.value)} error={codeError} className="flex-1" />
        <button type="submit" disabled={lookup.state === "searching"} className={buttonClassName("secondary")}>
          {lookup.state === "searching" ? "Finding..." : "Find letter"}
        </button>
      </form>
      {lookup.state === "missing" ? <p role="status" className="text-fg">No letter has that code.</p> : null}
      {lookup.state === "found" ? (
        <div className="flex flex-col gap-3">
          <p className="flex flex-wrap items-center gap-2 text-fg">
            <span className="font-semibold">{lookup.letter.displayName}</span>
            <span className="text-sm text-fg-muted">
              {formatYmd(lookup.letter.evidence.from)} to {formatYmd(lookup.letter.evidence.to)}
            </span>
            <StatusBadge {...LETTER_STATUS_LABELS[lookup.letter.status]} />
          </p>
          {lookup.letter.status !== "revoked" ? (
            <RevokeLetterForm letterId={lookup.letter.id} name={lookup.letter.displayName} runner={runner} onDone={() => setLookup({ state: "idle" })} />
          ) : null}
        </div>
      ) : null}
      <OpFeedback message={runner.message} error={runner.error} />
    </section>
  );
};
