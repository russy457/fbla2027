/**
 * testFixtures.ts
 * A small, hand-written article set for Help Center tests. Using fixtures
 * (instead of the real content) keeps ranking assertions stable when writers
 * edit the real articles. Imported only by *.test.ts(x) files.
 */
import { createHelpLibrary, type HelpLibrary } from "./helpLibrary";
import type { HelpArticle } from "./types";

const fixture = (overrides: Partial<HelpArticle> & Pick<HelpArticle, "slug" | "title">): HelpArticle => ({
  summary: `${overrides.title} summary.`,
  tags: [],
  roles: ["all"],
  related: [],
  body: "",
  ...overrides
});

export const FIXTURE_ARTICLES: readonly HelpArticle[] = Object.freeze([
  fixture({
    slug: "kiosk-check-in",
    title: "Checking in with the kiosk code",
    summary: "Type the 6-digit code from the tablet to check in.",
    tags: ["kiosk", "code", "check in"],
    roles: ["volunteer"],
    related: ["verified-letters"],
    body: "## Check in\n\nOpen **My Shifts** and press Check in. Codes change every 30 seconds."
  }),
  fixture({
    slug: "verified-letters",
    title: "Getting a verified hours letter",
    summary: "Turn approved hours into a PDF letter.",
    tags: ["letter", "pdf", "hours"],
    roles: ["volunteer"],
    body: "Open Impact and press Get verified letter. The letter lists hours. You can check in on its status at [Verify](/help/kiosk-check-in)."
  }),
  fixture({
    slug: "coordinator-start-kiosk",
    title: "Starting kiosk mode",
    summary: "Turn a tablet into a locked check-in station.",
    tags: ["tablet", "coordinator"],
    roles: ["coordinator"],
    body: "Press Start kiosk on the tablet."
  }),
  fixture({
    slug: "accessibility-settings",
    title: "Accessibility settings",
    summary: "Text size, high contrast, and reduced motion.",
    tags: ["contrast", "text size"],
    roles: ["all"],
    body: "Use the Display controls at the bottom of every page."
  })
]);

export const createFixtureLibrary = (): HelpLibrary => createHelpLibrary(FIXTURE_ARTICLES);
