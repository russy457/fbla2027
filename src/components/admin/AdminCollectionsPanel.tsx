/**
 * AdminCollectionsPanel.tsx
 * Admin-authored curated collections on /admin (SPEC 3.19: orgId null =
 * admin-authored; SPEC 4.1 admin "admin-authored collections"). Same
 * manager as coordinators use, scoped to the app-wide collections.
 */
import type { ReactElement } from "react";
import { CollectionManager } from "@/components/collections/CollectionManager";

export const AdminCollectionsPanel = (): ReactElement => <CollectionManager orgId={null} headingId="admin-collections-title" />;
