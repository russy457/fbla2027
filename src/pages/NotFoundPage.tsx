/**
 * NotFoundPage.tsx
 * Shown for any URL that does not match a route. Offers one way back.
 */
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";
import { buttonClassName } from "@/components/ui/buttonStyles";

const NotFoundPage = (): ReactElement => (
  <div className="flex flex-col items-start gap-6">
    <ScreenPlaceholder title="Page not found">
      The link may be old or mistyped. You can find open shifts from the Explore screen.
    </ScreenPlaceholder>
    <Link to="/explore" className={buttonClassName("primary")}>
      Go to Explore
    </Link>
  </div>
);

export default NotFoundPage;
