/**
 * OnboardingPage.tsx
 * Route "/onboarding" (SPEC#screen-onboarding D10, SPEC#minors G18). Steps:
 *   1 birth date (always first; under 13 stops here, nothing is created;
 *     someone already signed in has their account deleted by the server
 *     through completeProfile and is signed out, lib/underAgeAccount.ts)
 *   2 create account (only for people who are signed out)
 *   3 name and phone, 4 interests, 5 skills, 6 availability, 7 ZIP
 *     (5 to 7 skippable), 8 human check + volunteer.completeProfile, then
 *     "3 shifts that match you" (Tier 1 lane A, MatchesStep) before ?next=.
 * The draft lives in this component's state only; nothing is saved until
 * the final step. People with a finished profile are sent on to ?next=.
 */
import { useState, type ReactElement } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { clock } from "@fbla/shared";
import { LoadingState } from "@/components/LoadingState";
import { AccountStep } from "@/components/onboarding/AccountStep";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { BirthDateStep } from "@/components/onboarding/BirthDateStep";
import { FinishStep } from "@/components/onboarding/FinishStep";
import { MatchesStep } from "@/components/onboarding/MatchesStep";
import { NameStep } from "@/components/onboarding/NameStep";
import { AvailabilityStep, InterestsStep, SkillsStep, ZipStep } from "@/components/onboarding/PreferenceSteps";
import { UnderAgeStop } from "@/components/onboarding/UnderAgeStop";
import { usePrivateProfile } from "@/hooks/useVolunteerData";
import { EMPTY_DRAFT, type OnboardingDraft } from "@/lib/onboardingDraft";
import { deleteUnderAgeAccount } from "@/lib/underAgeAccount";
import { safeNextPath } from "@/lib/safeRedirect";
import { isUnderMinimumAge } from "@/lib/validation/formSchemas";
import { useSession } from "@/store/authStore";

type StepKey = "birth" | "account" | "name" | "interests" | "skills" | "availability" | "zip" | "finish";

const ALL_STEPS: readonly StepKey[] = ["birth", "account", "name", "interests", "skills", "availability", "zip", "finish"];

const OnboardingPage = (): ReactElement => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();
  const uid = session.status === "user" ? session.user.uid : null;
  const profile = usePrivateProfile(uid);
  const next = safeNextPath(params.get("next"));

  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [stepIndex, setStepIndex] = useState(0);
  const [isUnderAge, setIsUnderAge] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [accountDeleted, setAccountDeleted] = useState<boolean | undefined>(undefined);
  // Decided once, as soon as the session is known, so creating the account mid-flow does not renumber the steps.
  const [needsAccount, setNeedsAccount] = useState<boolean | null>(null);
  if (needsAccount === null && session.status !== "loading") setNeedsAccount(session.status !== "user");
  // Tier 1 lane A: set once completeProfile succeeds, so the matches screen shows before the redirect below.
  const [isFinished, setIsFinished] = useState(false);
  if (isFinished && uid !== null) return <MatchesStep uid={uid} onContinue={() => navigate(next, { replace: true })} />;

  if (needsAccount === null || (uid !== null && profile.isLoading)) return <LoadingState label="Getting set up" />;
  if (profile.data?.profileComplete === true) return <Navigate to={next} replace />;

  const steps = needsAccount ? ALL_STEPS : ALL_STEPS.filter((step) => step !== "account");
  const step = steps[stepIndex] ?? "finish";
  const nav = { stepNumber: stepIndex + 1, stepCount: steps.length, onBack: () => setStepIndex((index) => Math.max(0, index - 1)) };
  const advance = (patch: Partial<OnboardingDraft> = {}): void => {
    setDraft((current) => ({ ...current, ...patch }));
    setStepIndex((index) => Math.min(steps.length - 1, index + 1));
  };

  if (isDeletingAccount) return <LoadingState label="One moment" lines={1} />;
  if (isUnderAge) return <UnderAgeStop accountDeleted={accountDeleted} onChangeDate={() => setIsUnderAge(false)} />;

  // G18: a signed-in person under 13 must not keep an account. The server deletes it; then this device is signed out.
  const stopUnderAge = async (birthDate: string): Promise<void> => {
    if (uid === null) {
      setIsUnderAge(true);
      return;
    }
    setIsDeletingAccount(true);
    setAccountDeleted(await deleteUnderAgeAccount(birthDate));
    // Signed out now: a corrected date starts over with account creation.
    setNeedsAccount(true);
    setStepIndex(0);
    setIsDeletingAccount(false);
    setIsUnderAge(true);
  };

  switch (step) {
    case "birth":
      return (
        <BirthDateStep
          stepNumber={nav.stepNumber}
          stepCount={nav.stepCount}
          defaultValue={draft.birthDate}
          onNext={(birthDate) => {
            // The 13+ gate runs before any account exists (G18); the server repeats it.
            if (isUnderMinimumAge(birthDate, clock.now())) void stopUnderAge(birthDate);
            else advance({ birthDate });
          }}
        />
      );
    case "account":
      return session.status === "user" ? (
        // Account already created (for example after Back): move on.
        <AccountCreated onContinue={() => advance()} />
      ) : (
        <AccountStep {...nav} onCreated={() => advance()} loginPath={`/login?next=${encodeURIComponent("/onboarding")}`} />
      );
    case "name":
      return <NameStep {...nav} onBack={needsAccount ? undefined : nav.onBack} defaults={{ firstName: draft.firstName, lastName: draft.lastName, phone: draft.phone }} onNext={(values) => advance(values)} />;
    case "interests":
      return <InterestsStep {...nav} defaults={draft.interests} onNext={(interests) => advance({ interests })} />;
    case "skills":
      return <SkillsStep {...nav} defaults={draft.skills ?? []} onNext={(skills) => advance({ skills })} onSkip={() => advance({ skills: null })} />;
    case "availability":
      return <AvailabilityStep {...nav} defaults={draft.availability} onNext={(availability) => advance({ availability })} onSkip={() => advance({ availability: null })} />;
    case "zip":
      return <ZipStep {...nav} defaults={draft.zip} onNext={(zip) => advance({ zip })} onSkip={() => advance({ zip: "" })} />;
    case "finish":
      return <FinishStep {...nav} draft={draft} onDone={() => setIsFinished(true)} />;
  }
};

const AccountCreated = ({ onContinue }: { onContinue: () => void }): ReactElement => (
  <section className="flex max-w-xl flex-col items-start gap-4">
    <h1 className="text-3xl font-semibold tracking-tight text-fg">Your account is ready</h1>
    <button type="button" onClick={onContinue} className={buttonClassName("primary")}>
      Continue
    </button>
  </section>
);

export default OnboardingPage;
