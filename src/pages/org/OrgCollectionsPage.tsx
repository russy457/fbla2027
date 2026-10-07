/**
 * OrgCollectionsPage.tsx
 * Route "/org/:orgId/collections" (Tier 2 lane B, SPEC 3.19): a coordinator
 * curates collections for their organization. Published ones appear in the
 * Collections section on Explore and at /collections/:id. RequireCoordinator
 * guards the route; every write is a coordinator op that checks
 * membership against the stored collection.
 */
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";
import { CollectionManager } from "@/components/collections/CollectionManager";
import { OrgPageShell } from "@/components/org/OrgPageShell";

const OrgCollectionsPage = (): ReactElement => {
  const { orgId = "" } = useParams();
  return (
    <OrgPageShell title="Collections" intro="Hand-pick shifts and partner organizations for volunteers. Published collections show on Explore.">
      <CollectionManager orgId={orgId} headingId="org-collections-title" />
    </OrgPageShell>
  );
};

export default OrgCollectionsPage;
