import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "@phosphor-icons/react";
import { PACKING_DONATIONS_PHOTO, PARK_CLEANUP_PHOTO, STORYTIME_PHOTO, type EditorialPhoto } from "@/content/editorialMedia";

interface Story {
  readonly title: string;
  readonly description: string;
  readonly cause: string;
  readonly photo: EditorialPhoto;
}

const STORIES: readonly Story[] = [
  {
    title: "Food banks",
    description: "Pack and sort essentials for neighbors.",
    cause: "hunger-food-security",
    photo: PACKING_DONATIONS_PHOTO
  },
  {
    title: "Green spaces",
    description: "Care for parks, trails, and gardens.",
    cause: "environment",
    photo: PARK_CLEANUP_PHOTO
  },
  {
    title: "Youth programs",
    description: "Support reading and learning.",
    cause: "education-youth",
    photo: STORYTIME_PHOTO
  }
];

/** Cause photography stays separate from listings so it cannot imply a stock subject works for a demo partner. */
export const EditorialGallery = (): ReactElement => (
  <section aria-labelledby="ways-title" className="home-gallery">
    <div className="home-gallery__heading"><h2 id="ways-title">In action</h2></div>
    <div className="home-gallery__grid">
      {STORIES.map((story) => (
        <article key={story.cause} className="home-story">
          <Link to={`/explore?cause=${story.cause}`} className="home-story__link" aria-label={`Explore ${story.title.toLowerCase()} shifts`}>
            <span className="home-story__image-wrap">
              <img src={story.photo.src} alt={story.photo.alt} width={1000} height={800} loading="eager" fetchPriority="low" decoding="async" style={{ objectPosition: story.photo.objectPosition }} />
              <span className="home-story__arrow"><ArrowUpRight aria-hidden="true" size={20} /></span>
            </span>
            <span className="home-story__title">{story.title}</span>
          </Link>
          <p>{story.description}</p>
        </article>
      ))}
    </div>
  </section>
);
