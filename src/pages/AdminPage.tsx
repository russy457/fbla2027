/**
 * AdminPage.tsx
 * Route "/admin". Admin tools, gated by the admin custom claim later (D2).
 * Placeholder until the feature is built (see docs/SPEC.md for the screen spec).
 */
import type { ReactElement } from "react";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

const AdminPage = (): ReactElement => (
  <ScreenPlaceholder title="Admin">
    This screen will let site admins verify organizations and run demo controls.
  </ScreenPlaceholder>
);

export default AdminPage;
