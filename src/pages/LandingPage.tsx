/** Public and signed-in landing page. Shift discovery lives on /explore. */
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "@phosphor-icons/react";
import { EditorialGallery } from "@/components/editorial/EditorialGallery";
import { EditorialIntro } from "@/components/editorial/EditorialIntro";
import { EditorialPhotoNote } from "@/components/editorial/EditorialPhotoNote";

const LandingPage = (): ReactElement => (
  <div className="landing-page">
    <EditorialIntro />
    <EditorialGallery />
    <EditorialPhotoNote />
    <section className="landing-next" aria-labelledby="landing-next-title">
      <div>
        <p className="home-section-eyebrow">Ready when you are</p>
        <h2 id="landing-next-title">Find a shift that fits.</h2>
      </div>
      <Link to="/explore" className="landing-next__link">Browse open shifts <ArrowUpRight aria-hidden="true" size={19} /></Link>
    </section>
  </div>
);

export default LandingPage;
