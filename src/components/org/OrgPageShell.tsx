/**
 * OrgPageShell.tsx
 * Frame for every coordinator screen (SPEC#screen-nav D2): OrgNav beside the
 * content on desktop, above it on smaller screens, then the page's h1
 * (PageHeader, focus target after navigation) and its content.
 */
import type { ReactElement, ReactNode } from "react";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { OrgNav } from "./OrgNav";

interface OrgPageShellProps {
  readonly title: string;
  readonly intro?: ReactNode;
  readonly children: ReactNode;
}

export const OrgPageShell = ({ title, intro, children }: OrgPageShellProps): ReactElement => {
  const { orgId = "" } = useParams();
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
      <OrgNav orgId={orgId} />
      <div className="flex min-w-0 flex-1 flex-col gap-10">
        <PageHeader title={title}>{intro}</PageHeader>
        {children}
      </div>
    </div>
  );
};
