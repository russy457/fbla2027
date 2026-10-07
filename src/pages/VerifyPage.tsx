/**
 * VerifyPage.tsx
 * Routes "/verify" and "/verify/:code" (SPEC#letters, D3). Public: works
 * signed out. The code from the URL is normalized (uppercase, no spaces or
 * dashes); a code that cannot be a letter code is answered without a lookup,
 * and a well-formed code does a single exact-id read of the public
 * projection. Not found uses the SPEC's wording.
 */
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { VERIFY_CODE_PATTERN, normalizeVerifyCode } from "@fbla/shared";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { VerifyCodeForm } from "@/components/verify/VerifyCodeForm";
import { VerifyResult } from "@/components/verify/VerifyResult";
import { getLetterVerification } from "@/lib/data/records";

export const NOT_FOUND_MESSAGE = "We couldn't find a letter with that code. Check the code and try again.";
export const MALFORMED_MESSAGE = "That doesn't look like a letter code. Letter codes have 26 letters and numbers.";

const Lookup = ({ code }: { code: string }): ReactElement => {
  const lookup = useQuery({ queryKey: ["letterVerification", code], queryFn: () => getLetterVerification(code), retry: 1 });

  if (lookup.isPending) return <LoadingState label="Checking this letter" lines={3} />;
  if (lookup.isError) {
    return <ErrorState title="We couldn't check this letter" description="Check your connection, then try again." onAction={() => void lookup.refetch()} />;
  }
  if (lookup.data === null) {
    return (
      <div className="flex flex-col gap-6">
        <p role="status" className="text-lg font-semibold text-fg">
          {NOT_FOUND_MESSAGE}
        </p>
        <VerifyCodeForm label="Try another code" />
      </div>
    );
  }
  return <VerifyResult verifyCode={code} verification={lookup.data} />;
};

const VerifyPage = (): ReactElement => {
  const { code: rawCode } = useParams();
  const code = rawCode === undefined ? null : normalizeVerifyCode(rawCode);

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader title="Verify a volunteer hours letter">
        Anyone can check a letter here. No account needed.
      </PageHeader>
      {code === null ? (
        <VerifyCodeForm />
      ) : VERIFY_CODE_PATTERN.test(code) ? (
        <Lookup code={code} />
      ) : (
        <div className="flex flex-col gap-6">
          <p role="status" className="text-lg font-semibold text-fg">
            {MALFORMED_MESSAGE}
          </p>
          <VerifyCodeForm label="Enter the code again" />
        </div>
      )}
    </div>
  );
};

export default VerifyPage;
