/**
 * OrgRegisterPage.tsx
 * Route "/org/register" (SPEC 9.2 "Org register", SPEC#fn-registerorganization).
 * An adult with a verified email registers a nonprofit: the form, then
 * registerOrganization with one request nonce kept for retries (the same
 * click never creates two orgs). New organizations start unverified; an
 * admin verifies them. On success the person's memberships refresh and the
 * new dashboard opens ("Your organization is ready.").
 */
import { useState, type ReactElement } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { OpFeedback } from "@/components/org/OpFeedback";
import { OrgProfileForm } from "@/components/org/OrgProfileForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api, newRequestNonce } from "@/lib/api";
import type { OrgProfileValues } from "@/lib/validation/orgForms";

const OrgRegisterPage = (): ReactElement => {
  const [requestNonce] = useState(newRequestNonce);
  const runner = useOpRunner();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const register = async (values: OrgProfileValues): Promise<void> => {
    const result = await runner.run("register", () => api.coordinator.registerOrganization({ ...values, requestNonce }), () => "Organization registered.");
    if (!result) return;
    await queryClient.invalidateQueries({ queryKey: ["myMemberships"] });
    navigate(`/org/${result.orgId}/dashboard`);
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Register your organization">
        Adults (18+) can register a nonprofit. An admin checks the EIN before volunteers under 18 can join and before hours count on verified letters.
      </PageHeader>
      <Link to="/join" className="w-fit text-sm font-semibold text-accent underline underline-offset-2">
        Have an invite code? Join an organization
      </Link>
      <OrgProfileForm submitLabel="Register organization" isPending={runner.pending !== null} onSubmit={(values) => void register(values)} />
      <OpFeedback message={runner.message} error={runner.error} />
    </div>
  );
};

export default OrgRegisterPage;
