/**
 * HelpPage.tsx
 * Route "/help". Help Center with BM25 article search and the assistant (D7).
 * Placeholder until the feature is built (see docs/SPEC.md for the screen spec).
 */
import type { ReactElement } from "react";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

const HelpPage = (): ReactElement => (
  <ScreenPlaceholder title="Help">
    This screen will let you search help articles and ask questions about using the app.
  </ScreenPlaceholder>
);

export default HelpPage;
