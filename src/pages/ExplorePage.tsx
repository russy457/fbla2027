/**
 * ExplorePage.tsx
 * Route "/". Volunteer home: discover organizations and shifts (D1, D2).
 * Placeholder until the feature is built (see docs/SPEC.md for the screen spec).
 */
import type { ReactElement } from "react";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

const ExplorePage = (): ReactElement => (
  <ScreenPlaceholder title="Explore">
    This screen will list upcoming volunteer shifts from local nonprofits, with search, filters, and shifts recommended for you.
  </ScreenPlaceholder>
);

export default ExplorePage;
