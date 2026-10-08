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
  readonly eyebrow: string;
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
  if (pathname.startsWith("/opportunity/")) return { eyebrow: "A way to help", photo: COMMUNITY_GARDEN_PHOTO, position: "center center" };
  if (pathname.startsWith("/organizations/")) return { eyebrow: "Community partners", photo: DONATION_CENTER_PHOTO, position: "center center" };
  if (pathname.startsWith("/collections/")) return { eyebrow: "Picked for you", photo: TREE_PLANTING_PHOTO, position: "center 70%" };
  if (pathname === "/me/shifts" || pathname === "/checkin") return { eyebrow: "Your volunteer days", photo: COMMUNITY_GARDEN_PHOTO, position: "center center" };
  if (pathname.startsWith("/impact")) return { eyebrow: "Time well spent", photo: DONATION_CENTER_PHOTO, position: "center center" };
  if (pathname === "/me/saved") return { eyebrow: "Keep close", photo: SHELTER_CAT_PHOTO, position: "center 43%" };
  if (pathname === "/me/notifications") return { eyebrow: "Stay in the loop", photo: PARK_CLEANUP_PHOTO, position: "center 48%" };
  if (pathname === "/me/profile") return { eyebrow: "Your details", photo: READING_TOGETHER_PHOTO, position: "center 57%" };
  if (pathname.startsWith("/help")) return { eyebrow: "Here to help", photo: STORYTIME_PHOTO, position: "center 66%" };
  if (pathname.startsWith("/verify")) return { eyebrow: "A record you can share", photo: READING_TOGETHER_PHOTO, position: "center 57%" };
  if (pathname === "/login" || pathname === "/onboarding") return { eyebrow: "A place to show up", photo: DONATION_CENTER_PHOTO, position: "center center" };
  if (pathname.startsWith("/org/")) return { eyebrow: "For the people who organize", photo: DONATION_CENTER_PHOTO, position: "center center" };
  if (pathname === "/admin") return { eyebrow: "Behind the scenes", photo: FOOD_SORTING_PHOTO, position: "center center" };
  if (pathname === "/privacy" || pathname === "/terms" || pathname === "/accessibility") return { eyebrow: "Good to know", photo: READING_TOGETHER_PHOTO, position: "center 57%" };
  return { eyebrow: "fbla 2027", photo: TREE_PLANTING_PHOTO, position: "center 68%" };
};
