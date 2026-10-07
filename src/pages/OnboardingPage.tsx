/**
 * OnboardingPage.tsx
 * Route "/onboarding". Profile setup for new volunteers (D10).
 * Placeholder until the feature is built (see docs/SPEC.md for the screen spec).
 */
import type { ReactElement } from "react";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

const OnboardingPage = (): ReactElement => (
  <ScreenPlaceholder title="Set up your profile">
    This screen will ask for your birth date, interests, and availability so we can suggest shifts that fit you.
  </ScreenPlaceholder>
);

export default OnboardingPage;
