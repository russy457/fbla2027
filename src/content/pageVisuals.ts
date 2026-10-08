/** Photography for page openings. All images are illustrative, never a photo of a listed shift. */
import {
  COMMUNITY_DONATIONS_PHOTO,
  COMMUNITY_GARDEN_PHOTO,
  DONATION_CENTER_PHOTO,
  FOOD_SORTING_PHOTO,
  PACKING_DONATIONS_PHOTO,
  PARK_CLEANUP_PHOTO,
  READING_TOGETHER_PHOTO,
  SHELTER_CAT_PHOTO,
  STORYTIME_PHOTO,
  TREE_PLANTING_PHOTO,
  type EditorialPhoto
} from "./editorialMedia";

export interface PageVisual {
  readonly photo: EditorialPhoto;
  readonly position: string;
}

/** Explore uses distinct crops so its headline stays off the volunteers at both widths. */
export const EXPLORE_SCENE_PHOTOS = {
  desktop: PACKING_DONATIONS_PHOTO,
  mobile: COMMUNITY_DONATIONS_PHOTO
} as const;

/** One place to change the mood or crop of an entire route family. */
export const pageVisualFor = (pathname: string): PageVisual => {
  if (pathname.startsWith("/opportunity/")) return { photo: COMMUNITY_GARDEN_PHOTO, position: "center center" };
  if (pathname.startsWith("/organizations/")) return { photo: DONATION_CENTER_PHOTO, position: "center center" };
  if (pathname.startsWith("/collections/")) return { photo: TREE_PLANTING_PHOTO, position: "center 70%" };
  if (pathname === "/me/shifts" || pathname === "/checkin") return { photo: COMMUNITY_GARDEN_PHOTO, position: "center center" };
  if (pathname.startsWith("/impact")) return { photo: DONATION_CENTER_PHOTO, position: "center center" };
  if (pathname === "/me/saved") return { photo: SHELTER_CAT_PHOTO, position: "center 43%" };
  if (pathname === "/me/notifications") return { photo: PARK_CLEANUP_PHOTO, position: "center 48%" };
  if (pathname === "/me/profile") return { photo: READING_TOGETHER_PHOTO, position: "center 57%" };
  if (pathname.startsWith("/help")) return { photo: STORYTIME_PHOTO, position: "center 66%" };
  if (pathname.startsWith("/verify")) return { photo: READING_TOGETHER_PHOTO, position: "center 57%" };
  if (pathname === "/login" || pathname === "/onboarding") return { photo: DONATION_CENTER_PHOTO, position: "center center" };
  if (pathname.startsWith("/org/")) return { photo: DONATION_CENTER_PHOTO, position: "center center" };
  if (pathname === "/admin") return { photo: FOOD_SORTING_PHOTO, position: "center center" };
  if (pathname === "/privacy" || pathname === "/terms" || pathname === "/accessibility") return { photo: READING_TOGETHER_PHOTO, position: "center 57%" };
  return { photo: TREE_PLANTING_PHOTO, position: "center 68%" };
};
