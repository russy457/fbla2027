import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "@phosphor-icons/react";
import { PACKING_DONATIONS_PHOTO, PARK_CLEANUP_PHOTO, STORYTIME_PHOTO, type EditorialPhoto } from "@/content/editorialMedia";

interface Story {
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly cause: string;
  readonly photo: EditorialPhoto;
}

const STORIES: readonly Story[] = [
  {
    label: "Food and essentials",
    title: "Lend a hand where it's needed.",
    description: "Pack, sort, and help neighbors get the basics.",
    cause: "hunger-food-security",
    photo: PACKING_DONATIONS_PHOTO
  },
  {
    label: "Green spaces",
    title: "Take care of shared places.",
    description: "Join a cleanup or lend time outdoors.",
    cause: "environment",
    photo: PARK_CLEANUP_PHOTO
  },
  {
    label: "Young people",
    title: "Help someone learn.",
    description: "Find a way to support children and students.",
    cause: "education-youth",
    photo: STORYTIME_PHOTO
  }
];

/** Cause photography stays separate from listings so it cannot imply a stock subject works for a demo partner. */
export const EditorialGallery = (): ReactElement => (
  <section aria-labelledby="ways-title" className="home-gallery">
    <div className="home-gallery__heading">
      <div>
        <p className="home-section-eyebrow">Find your place</p>
        <h2 id="ways-title">There are many ways to help.</h2>
      </div>
      <p>Pick the work that feels right for you. Each path opens matching volunteer shifts.</p>
    </div>
    <div className="home-gallery__grid">
      {STORIES.map((story) => (
        <article key={story.cause} className="home-story">
          <Link to={`/explore?cause=${story.cause}`} className="home-story__link" aria-label={`Explore ${story.label.toLowerCase()} shifts`}>
            <span className="home-story__image-wrap">
              <img src={story.photo.src} alt={story.photo.alt} width={1000} height={800} loading="eager" fetchPriority="low" decoding="async" style={{ objectPosition: story.photo.objectPosition }} />
              <span className="home-story__arrow"><ArrowUpRight aria-hidden="true" size={20} /></span>
            </span>
            <span className="home-story__category">{story.label}</span>
            <span className="home-story__title">{story.title}</span>
          </Link>
          <p>{story.description}</p>
        </article>
      ))}
    </div>
  </section>
);
