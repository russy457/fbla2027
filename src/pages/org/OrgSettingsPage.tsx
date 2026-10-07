/**
 * OrgSettingsPage.tsx
 * Route "/org/:orgId/settings" (SPEC 9.2 "Org settings", SPEC 5.8):
 * verification status, the profile form (owner saves through
 * updateOrganization "update"; coordinators see it read-only), members,
 * and for the owner: invites, letters that count the org's hours (revoke),
 * and archive/delete. Changing the name or EIN sends the org back to
 * verification; the server enforces it and the page says so up front.
 */
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { InvitesPanel } from "@/components/org/InvitesPanel";
import { MembersPanel } from "@/components/org/MembersPanel";
import { OpFeedback } from "@/components/org/OpFeedback";
import { OrgDangerZone } from "@/components/org/OrgDangerZone";
import { OrgLettersPanel } from "@/components/org/OrgLettersPanel";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { OrgProfileForm } from "@/components/org/OrgProfileForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UnverifiedChip } from "@/components/ui/UnverifiedChip";
import { useMembership } from "@/hooks/useMemberships";
import { useNow } from "@/hooks/useNow";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import { getOrganization, type Organization } from "@/lib/data/orgs";
import type { OrgProfileDraft, OrgProfileValues } from "@/lib/validation/orgForms";
import { useSessionUser } from "@/store/authStore";

const draftOf = (org: Organization): OrgProfileDraft => ({
  name: org.name,
  mission: org.mission,
  causeAreas: org.causeAreas,
  ein: org.ein,
  address: org.address,
  contactEmail: org.contactEmail,
  contactPhone: org.contactPhone ?? "",
  website: org.website ?? "",
  timeZone: org.timeZone
});

const VerificationStatus = ({ verified }: { verified: boolean }): ReactElement => (
  <section aria-labelledby="verification-status" className="flex flex-col gap-2">
    <h2 id="verification-status" className="text-lg font-semibold text-fg">Verification</h2>
    <div className="flex flex-wrap items-center gap-2">{verified ? <StatusBadge tone="success" label="Verified" size="md" /> : <UnverifiedChip />}</div>
    <p className="text-sm text-fg-muted">
      {verified
        ? "Volunteers of any age can join, and your hours count on verified letters."
        : "An admin is checking your EIN. Until then, volunteers under 18 can't join and hours here don't count on verified letters."}{" "}
      Changing the name or EIN sends the organization back to verification.
    </p>
  </section>
);

const OrgSettingsPage = (): ReactElement => {
  const { orgId = "" } = useParams();
  const user = useSessionUser();
  const nowMs = useNow(60_000);
  const queryClient = useQueryClient();
  const org = useQuery({ queryKey: ["organization", orgId], queryFn: () => getOrganization(orgId), staleTime: 30_000 });
  const membership = useMembership(orgId, user?.uid ?? null);
  const runner = useOpRunner();

  if (org.isError) return <ErrorState title="We couldn't load this organization" description="Check your connection, then reload." />;
  if (org.isPending || membership.isPending) return <LoadingState label="Loading settings" />;
  if (!org.data) return <ErrorState title="Organization not found" description="It may have been deleted." />;
  const isOwner = membership.data?.role === "owner";

  const save = async (patch: OrgProfileValues): Promise<void> => {
    const result = await runner.run("save", () => api.coordinator.updateOrganization({ orgId, action: "update", patch }), (out) =>
      out.verified ? "Changes saved." : "Changes saved. The organization is waiting for verification."
    );
    if (result) await queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
  };

  return (
    <OrgPageShell title="Settings" intro="Keep your organization's details, people, and letters in order.">
      <VerificationStatus verified={org.data.verified} />
      <section aria-labelledby="profile-title" className="flex flex-col gap-3">
        <h2 id="profile-title" className="text-lg font-semibold text-fg">Profile</h2>
        <OrgProfileForm key={org.data.updatedAt.toMillis()} initial={draftOf(org.data)} submitLabel="Save changes" readOnly={!isOwner} isPending={runner.pending !== null} onSubmit={(values) => void save(values)} />
        <OpFeedback message={runner.message} error={runner.error} />
      </section>
      <MembersPanel orgId={orgId} isOwner={isOwner} />
      {isOwner ? (
        <>
          <InvitesPanel orgId={orgId} nowMs={nowMs} />
          <OrgLettersPanel orgId={orgId} />
          <OrgDangerZone orgId={orgId} hasActivity={org.data.hasActivity} isArchived={org.data.archived} />
        </>
      ) : null}
    </OrgPageShell>
  );
};

export default OrgSettingsPage;
