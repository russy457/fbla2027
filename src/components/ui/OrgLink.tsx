/**
 * OrgLink.tsx
 * An organization's name as a link to its public page,
 * /organizations/:orgId (SPEC#screen-inventory "Organization"). Used wherever
 * a shift or saved item names its organization: Explore rows, recommended
 * cards, the Opportunity page, and Saved.
 */
import type { ReactElement } from "react";
import { Link } from "react-router-dom";

export const organizationPathFor = (orgId: string): string => `/organizations/${encodeURIComponent(orgId)}`;

const ORG_LINK_CLASS = "underline-offset-4 hover:text-accent hover:underline focus-visible:underline";

interface OrgLinkProps {
  readonly orgId: string;
  readonly name: string;
  readonly className?: string;
}

export const OrgLink = ({ orgId, name, className = ORG_LINK_CLASS }: OrgLinkProps): ReactElement => (
  <Link to={organizationPathFor(orgId)} className={className}>
    {name}
  </Link>
);
