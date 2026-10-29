import type { CauseArea } from "@fbla/shared";
import { PACKING_DONATIONS_PHOTO, PARK_CLEANUP_PHOTO, STORYTIME_PHOTO, type EditorialPhoto } from "./editorialMedia";

export interface HomeJourneyStory {
  readonly title: string;
  readonly description: string;
  readonly linkLabel: string;
  readonly cause: CauseArea;
  readonly photo: EditorialPhoto;
}

/** The same real cause filters used by the old home gallery. */
export const HOME_JOURNEY_STORIES: readonly HomeJourneyStory[] = [
  {
    title: "Food banks",
    description: "Pack and sort essentials for neighbors.",
    linkLabel: "Find food shifts",
    cause: "hunger-food-security",
    photo: PACKING_DONATIONS_PHOTO
  },
  {
    title: "Green spaces",
    description: "Care for parks, trails, and gardens.",
    linkLabel: "Find outdoor shifts",
    cause: "environment",
    photo: PARK_CLEANUP_PHOTO
  },
  {
    title: "Youth programs",
    description: "Support reading and learning.",
    linkLabel: "Find learning shifts",
    cause: "education-youth",
    photo: STORYTIME_PHOTO
  }
];
