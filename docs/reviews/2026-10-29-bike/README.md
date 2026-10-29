# Tandem bike brand review

Method: manual Think, Plan, Build, Review, Test, Ship, Reflect sequence from the published gstack sprint. The gstack CLI was unavailable, so this is not a gstack command run or a design score. Screenshots came from local Chromium with image decoding and fonts settled for the home comparison. The local Firebase services were offline; the developer notice in the home captures is local only.

## Think and plan

The owner asked for a tandem bicycle motif, a single-color logo, and a moving loading symbol. The home page persuades; Explore is a hybrid scheduling screen; the kiosk and help assistant are task screens. The first action on home stays **Explore shifts**. The bike should identify Tandem and signal a wait, without competing with tasks or photos.

Visual thesis: one precise brown or white silhouette carries the wordmark; two turning wheels, two cranks, and a short moving road signal progress while data loads.

Affected surfaces: header, footer, favicon, shared route and query waits, Explore schedule loading, kiosk code wait, help assistant wait, and onboarding human check. The wordmark remains HTML text. Loading labels remain visible and announced. The mark is decorative to assistive technology. CSS animations use transforms and stop for system or site reduced-motion settings; offscreen loops pause.

## Rendered evidence

| Width | Before | After |
| --- | --- | --- |
| 375px | [Home before](before-375.webp) | [Home after](after-375.webp) |
| 768px | [Home before](before-768.webp) | [Home after](after-768.webp) |
| 1440px | [Home before](before-1440.webp) | [Home after](after-1440.webp) |

The [shared loading state](loading.webp) shows the moving mark with a visible label and static structural placeholders. The [interior route wait](route-loading.webp) shows the light bike over the darkened photograph; the footer remains below the viewport while a route chunk loads. [150% text with high contrast](large-text-high-contrast.webp) fits the expanded wordmark and sign-in control at 375px.

The initial browser pass exposed two contrast problems: the short interior route wait inherited brown text over a photo, and Explore's dark schedule inherited brown loading text. Both now use light scene text. The 375px, 768px, and 1440px home captures have no horizontal page overflow. A scrolled header still collapses to four named icon routes. Browser checks found no serious axe violations on the settled home and Explore screens. The loader's animation name becomes `none` under reduced motion.

## Test and limits

- Typecheck, production build, token scan, and the 1,216 unit tests passed after rebasing onto the Google sign-in update.
- Targeted browser tests for brand motion, home and Explore smoke, and legal routes passed. The signed-in assistant checks require Firebase emulators and were skipped in this local browser run.
- This review covers the shared shell and loading surfaces. It does not claim real-user feedback or a formal performance score. The favicon should be checked in phone browser tabs after deployment because desktop Chromium does not show that chrome in screenshots.
