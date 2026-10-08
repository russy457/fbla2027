/** Public and signed-in landing page. Shift discovery lives on /explore. */
import type { ReactElement } from "react";
import { EditorialGallery } from "@/components/editorial/EditorialGallery";
import { EditorialIntro } from "@/components/editorial/EditorialIntro";
import { EditorialPhotoNote } from "@/components/editorial/EditorialPhotoNote";

const LandingPage = (): ReactElement => (
  <div className="landing-page">
    <EditorialIntro />
    <EditorialGallery />
    <EditorialPhotoNote />
  </div>
);

export default LandingPage;
