/**
 * MyShiftsPage.tsx
 * Route "/me/shifts". The volunteer's upcoming and past signups.
 * Placeholder until the feature is built (see docs/SPEC.md for the screen spec).
 */
import type { ReactElement } from "react";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

const MyShiftsPage = (): ReactElement => (
  <ScreenPlaceholder title="My shifts">
    This screen will show the shifts you signed up for, your waitlist spots, and your check-in times.
  </ScreenPlaceholder>
);

export default MyShiftsPage;
