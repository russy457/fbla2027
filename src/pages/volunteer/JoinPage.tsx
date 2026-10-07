/**
 * JoinPage.tsx
 * Route "/join?code=..." (SPEC 9.1 volunteer routes, coordinator.redeemInvite).
 * A person enters the invite code an owner gave them (prefilled from the
 * link), becomes a coordinator of that organization, and lands on its
 * dashboard. INVITE_INVALID and ALREADY_MEMBER show the catalog copy.
 */
import { useState, type FormEvent, type ReactElement } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { INVITE_CODE_PATTERN, normalizeInviteCode } from "@fbla/shared";
import { OpFeedback } from "@/components/org/OpFeedback";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";

const JoinPage = (): ReactElement => {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  const runner = useOpRunner();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const join = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const normalized = normalizeInviteCode(code);
    if (!INVITE_CODE_PATTERN.test(normalized)) return setCodeError("Enter the 10-character code, like ABCDE-FGHIJ.");
    setCodeError(undefined);
    const result = await runner.run("join", () => api.coordinator.redeemInvite({ code: normalized }), () => "You joined the organization.");
    if (!result) return;
    await queryClient.invalidateQueries({ queryKey: ["myMemberships"] });
    navigate(`/org/${result.orgId}/dashboard`);
  };

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader title="Join an organization">Enter the invite code the organization's owner gave you. Codes expire after 7 days.</PageHeader>
      <form onSubmit={(event) => void join(event)} noValidate className="flex flex-col gap-4">
        <TextField label="Invite code" value={code} autoComplete="off" autoCapitalize="characters" onChange={(event) => setCode(event.target.value)} error={codeError} />
        <button type="submit" disabled={runner.pending !== null} className={buttonClassName("primary", "w-fit")}>
          {runner.pending ? "Joining..." : "Join organization"}
        </button>
      </form>
      <OpFeedback message={runner.message} error={runner.error} />
    </div>
  );
};

export default JoinPage;
