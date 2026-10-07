/**
 * VerifyPage.tsx
 * Route "/verify/:code". Public page where anyone can check a volunteer hours
 * letter by its code (D3). Placeholder until Tier 0 builds the real lookup.
 */
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

const VerifyPage = (): ReactElement => {
  const { code = "" } = useParams();
  return (
    <ScreenPlaceholder title="Verify a volunteer hours letter">
      This screen will confirm whether letter <span className="font-mono text-fg">{code}</span> is valid, superseded,
      or revoked, and show the verified hours.
    </ScreenPlaceholder>
  );
};

export default VerifyPage;
