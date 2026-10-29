/** Public and signed-in landing page. Shift discovery lives on /explore. */
import type { ReactElement } from "react";
import { EditorialJourney } from "@/components/editorial/EditorialJourney";
import { EditorialIntro } from "@/components/editorial/EditorialIntro";
import { EditorialPhotoNote } from "@/components/editorial/EditorialPhotoNote";

const LandingPage = (): ReactElement => (
  <div className="landing-page">
    <EditorialIntro />
    <EditorialJourney />
    <EditorialPhotoNote />
  </div>
);

export default LandingPage;
