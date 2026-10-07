/**
 * causeAreas.ts
 * Plain-English labels for the CauseArea enum (SPEC 3.1). The enum values
 * stay kebab-case in data; people only ever see these labels.
 */
import type { CauseArea } from "@fbla/shared";

export const CAUSE_AREA_LABELS: Readonly<Record<CauseArea, string>> = {
  "hunger-food-security": "Hunger and food",
  "education-youth": "Education and youth",
  "health-wellness": "Health and wellness",
  environment: "Environment",
  "animal-welfare": "Animals",
  "housing-homelessness": "Housing and homelessness",
  seniors: "Seniors",
  "arts-culture": "Arts and culture",
  "disaster-relief": "Disaster relief",
  "community-development": "Community building"
};
