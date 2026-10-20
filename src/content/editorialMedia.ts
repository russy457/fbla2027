/** Illustrative editorial photos. Named shifts only use photos supplied by their organization. */
export interface EditorialPhoto {
  readonly src: string;
  readonly alt: string;
  readonly attribution: string;
  readonly sourceUrl: string;
  readonly objectPosition: string;
}

/** The image pipeline writes a 640px thumbnail beside each full photo. */
export const editorialThumbnailSrc = (photo: EditorialPhoto): string => photo.src.replace(/\.webp$/, "-thumb.webp");

export const FOOD_SORTING_PHOTO: EditorialPhoto = {
  src: "/images/food-sorting-joel-muniz.webp",
  alt: "Volunteers sorting donated food together",
  attribution: "Joel Muniz / Unsplash. Illustrative photo.",
  sourceUrl: "https://unsplash.com/photos/volunteers-sorting-canned-food-donations-3k3l2brxmwQ",
  objectPosition: "center center"
};

export const COMMUNITY_DONATIONS_PHOTO: EditorialPhoto = {
  src: "/images/community-donations.webp",
  alt: "Volunteers sorting clothes and food donations together",
  attribution: "Julia M Cameron / Pexels. Illustrative photo.",
  sourceUrl: "https://www.pexels.com/photo/people-sorting-donations-6994963/",
  objectPosition: "center 92%"
};

export const TREE_PLANTING_PHOTO: EditorialPhoto = {
  src: "/images/tree-planting.webp",
  alt: "A group planting a young tree together",
  attribution: "Anna Shvets / Pexels. Illustrative photo.",
  sourceUrl: "https://www.pexels.com/photo/people-planting-plant-together-5029923/",
  objectPosition: "center 62%"
};

export const HOME_GARDEN_PHOTO: EditorialPhoto = {
  src: "/images/home-garden.webp",
  alt: "A volunteer tending a community garden among spring flowers",
  attribution: "Zack Gilbert / Pexels. Illustrative photo.",
  sourceUrl: "https://www.pexels.com/photo/volunteering-in-a-vibrant-community-garden-39779050/",
  objectPosition: "center 54%"
};

export const HOME_PLANTING_PHOTO: EditorialPhoto = {
  src: "/images/home-planting.webp",
  alt: "Two volunteers tending a young tree in an open field",
  attribution: "Thirdman / Pexels. Illustrative photo.",
  sourceUrl: "https://www.pexels.com/photo/volunteers-on-tree-planting-7656721/",
  objectPosition: "46% center"
};

export const READING_TOGETHER_PHOTO: EditorialPhoto = {
  src: "/images/reading-together.webp",
  alt: "An adult helping a child read a book",
  attribution: "Anastasia Shuraeva / Pexels. Illustrative photo.",
  sourceUrl: "https://www.pexels.com/photo/man-helping-girl-turning-book-pages-8466772/",
  objectPosition: "center center"
};

export const PARK_CLEANUP_PHOTO: EditorialPhoto = {
  src: "/images/park-cleanup.webp",
  alt: "Two people collecting litter in a park",
  attribution: "Galib Rahman Nadim / Pexels. Illustrative photo.",
  sourceUrl: "https://www.pexels.com/photo/volunteers-clean-up-park-environmental-awareness-39038090/",
  objectPosition: "center center"
};

export const SHELTER_CAT_PHOTO: EditorialPhoto = {
  src: "/images/shelter-cat.webp",
  alt: "A shelter cat being held and cared for",
  attribution: "Judy Beth Morris / Unsplash. Illustrative photo.",
  sourceUrl: "https://unsplash.com/photos/a-man-holding-a-white-cat-in-his-arms-9BHdzgNltZ8",
  objectPosition: "center center"
};

export const PACKING_DONATIONS_PHOTO: EditorialPhoto = {
  src: "/images/packing-donations.webp",
  alt: "A volunteer organizing food donations on a table",
  attribution: "Julia M Cameron / Pexels. Illustrative photo.",
  sourceUrl: "https://www.pexels.com/photo/a-volunteer-wearing-a-face-mask-preparing-donations-6995213/",
  objectPosition: "center center"
};

export const STORYTIME_PHOTO: EditorialPhoto = {
  src: "/images/storytime.webp",
  alt: "An adult reading a picture book with children",
  attribution: "Ksenia Chernaya / Pexels. Illustrative photo.",
  sourceUrl: "https://www.pexels.com/photo/children-in-the-school-reading-a-book-with-a-teacher-8535177/",
  objectPosition: "center 64%"
};

export const DONATION_CENTER_PHOTO: EditorialPhoto = {
  src: "/images/donation-center.webp",
  alt: "Volunteers sorting clothing and food donations together",
  attribution: "Gustavo Fring / Pexels",
  sourceUrl: "https://www.pexels.com/photo/people-packing-donations-7156163/",
  objectPosition: "center center"
};

export const COMMUNITY_GARDEN_PHOTO: EditorialPhoto = {
  src: "/images/community-garden.webp",
  alt: "Volunteers moving soil in a community garden",
  attribution: "Zack Gilbert / Pexels",
  sourceUrl: "https://www.pexels.com/photo/volunteers-working-in-bloomington-community-garden-39778154/",
  objectPosition: "center center"
};

export const SENIORS_VOLUNTEERS_PHOTO: EditorialPhoto = {
  src: "/images/seniors-volunteers.webp",
  alt: "Two volunteers looking through a photo album with an older adult",
  attribution: "RDNE Stock project / Pexels",
  sourceUrl: "https://www.pexels.com/photo/volunteer-men-having-conversation-to-an-elderly-man-6647035/",
  objectPosition: "center center"
};

export const HOUSING_BUILD_PHOTO: EditorialPhoto = {
  src: "/images/housing-build.webp",
  alt: "Volunteers building a home together",
  attribution: "Brad Weaver / Pexels",
  sourceUrl: "https://www.pexels.com/photo/team-of-volunteers-building-a-house-frame-32881356/",
  objectPosition: "center center"
};

export const COMMUNITY_MURAL_PHOTO: EditorialPhoto = {
  src: "/images/community-mural.webp",
  alt: "An artist painting a colorful community mural",
  attribution: "Tanha Tamanna Syed / Pexels",
  sourceUrl: "https://www.pexels.com/photo/artist-painting-colorful-mural-on-wall-in-dhaka-37000709/",
  objectPosition: "center center"
};
