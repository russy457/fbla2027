import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "@phosphor-icons/react";
import {
  FOOD_SORTING_PHOTO,
  READING_TOGETHER_PHOTO,
  SHELTER_CAT_PHOTO,
  TREE_PLANTING_PHOTO
} from "@/content/editorialMedia";

const causes = [
  { name: "Food", slug: "hunger-food-security", photo: FOOD_SORTING_PHOTO },
  { name: "Outdoors", slug: "environment", photo: TREE_PLANTING_PHOTO },
  { name: "Learning", slug: "education-youth", photo: READING_TOGETHER_PHOTO },
  { name: "Animals", slug: "animal-welfare", photo: SHELTER_CAT_PHOTO }
] as const;

export const ExploreCauseRibbon = (): ReactElement => (
  <section aria-labelledby="explore-causes-title" className="explore-cause-section">
    <div className="explore-cause-heading">
      <p className="home-section-eyebrow">Browse by cause</p>
      <h2 id="explore-causes-title">Start with what matters to you.</h2>
    </div>
    <nav aria-label="Browse shifts by cause" className="explore-cause-grid">
      {causes.map(({ name, slug, photo }) => (
        <Link key={slug} to={`/explore?cause=${slug}`} className="explore-cause-tile">
          <img src={photo.src} alt="" loading="eager" decoding="async" style={{ objectPosition: photo.objectPosition }} />
          <span className="explore-cause-tile__shade" aria-hidden="true" />
          <span className="explore-cause-tile__label">{name}<ArrowUpRight aria-hidden="true" size={17} /></span>
        </Link>
      ))}
    </nav>
  </section>
);
