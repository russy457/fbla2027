import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "@phosphor-icons/react";
import type { CauseArea } from "@fbla/shared";
import {
  COMMUNITY_MURAL_PHOTO,
  DONATION_CENTER_PHOTO,
  FOOD_SORTING_PHOTO,
  HOUSING_BUILD_PHOTO,
  READING_TOGETHER_PHOTO,
  SENIORS_VOLUNTEERS_PHOTO,
  SHELTER_CAT_PHOTO,
  TREE_PLANTING_PHOTO,
  type EditorialPhoto
} from "@/content/editorialMedia";

interface CauseLink {
  readonly label: string;
  readonly cause: CauseArea;
  readonly photo: EditorialPhoto;
}

const CAUSES: readonly CauseLink[] = [
  { label: "Food", cause: "hunger-food-security", photo: FOOD_SORTING_PHOTO },
  { label: "Outdoors", cause: "environment", photo: TREE_PLANTING_PHOTO },
  { label: "Learning", cause: "education-youth", photo: READING_TOGETHER_PHOTO },
  { label: "Animals", cause: "animal-welfare", photo: SHELTER_CAT_PHOTO },
  { label: "Housing", cause: "housing-homelessness", photo: HOUSING_BUILD_PHOTO },
  { label: "Seniors", cause: "seniors", photo: SENIORS_VOLUNTEERS_PHOTO },
  { label: "Arts", cause: "arts-culture", photo: COMMUNITY_MURAL_PHOTO }
];

/** The public home opens with one strong image and direct paths into real filters. */
export const EditorialIntro = (): ReactElement => (
  <section aria-labelledby="home-title" className="home-hero">
    <div className="home-hero__media" aria-hidden="true">
      <img src={DONATION_CENTER_PHOTO.src} alt="" fetchPriority="high" decoding="async" />
    </div>
    <div className="home-hero__flow">
      <div className="home-hero__copy">
        <p className="home-hero__eyebrow">A place to show up</p>
        <h1 id="home-title" tabIndex={-1} className="home-hero__title outline-none">
          Make time for <span>good work.</span>
        </h1>
        <p className="home-hero__description">Find a cause, choose a shift, and keep your hours in one place.</p>
        <div className="home-hero__actions">
          <Link to="/explore" className="home-hero__primary">
            Explore shifts <ArrowUpRight aria-hidden="true" size={19} />
          </Link>
          <Link to="/org/register" className="home-hero__secondary">
            For nonprofits
          </Link>
        </div>
      </div>
      <div className="home-causes-wrap">
        <p className="home-causes-heading">Start with what matters to you</p>
        <nav aria-label="Explore by cause" className="home-causes">
          {CAUSES.map(({ label, cause, photo }) => (
            <Link key={cause} to={`/explore?cause=${cause}`} className="home-cause">
              <span className="home-cause__image-wrap">
                <img src={photo.src} alt="" width={300} height={360} loading="eager" fetchPriority="low" decoding="sync" style={{ objectPosition: photo.objectPosition }} />
                <span aria-hidden="true" className="home-cause__shade" />
                <span className="home-cause__label">{label}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  </section>
);
