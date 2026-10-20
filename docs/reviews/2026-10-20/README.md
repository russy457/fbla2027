# Rendered UX review, 2026-10-20

Method: manual application of the [gstack sprint and design review](https://github.com/garrytan/gstack/blob/main/design-review/SKILL.md). Gstack's CLI was not installed, so this is not a claim of a gstack command run or formal score. Baselines came from Chromium at 375px and 1440px. Changes were also checked at 768px, with 150% text and high contrast on task pages.

## Design intent

Visual thesis: **warm service photography leads discovery; task controls lead operations.** Landing is Persuade, Explore is Hybrid, and login, Help, shift details, and organization pages are Operate or Read. The first viewport should tell each visitor what they can do next.

## Findings and fixes

### Task controls started below the phone viewport

[Login before](login-mobile-before.jpg) and [after](login-mobile-after.jpg). [Help before](help-mobile-before.jpg) and [after](help-mobile-after.jpg).

At 375×812, the first login control began 1,061px down the page. Help search began at 1,089px. A full-height interior photo and a 181px storage notice caused the delay. The shared task scene now uses `--task-scene-height`, and the notice keeps the same facts in less space. The first controls now begin at 542px and 570px. The notice is 125px tall. The short photo scene still lets the content layer rise over it on scroll.

### Hidden filters obscured the result context

[Explore mobile before](explore-filters-375-before.jpg) and [after](explore-filters-375-after.jpg). [Desktop before](explore-filters-1440-before.jpg) and [after](explore-filters-1440-after.jpg).

With Cause: Environment, Day: Saturday, and Seats available set, closing the panel left only “Filters (3)” above a zero-result schedule. Active values now stay visible as removable text controls. Removing Saturday changed the URL from `?cause=environment&day=sat&seats=1` to `?cause=environment&seats=1` and revealed one shift in this demo dataset. This adapts [Baymard's applied-filter finding](https://baymard.com/research-articles/how-to-design-applied-filters) to volunteer search; a real-user test is still needed.

### Stock photo implied the wrong shift

[Opportunity before](opportunity-mobile-before.jpg) and [after](opportunity-mobile-after.jpg). The food-packing shift used a gardening photo as its opening. Named shifts and organizations now use a plain brown opening until an approved photo exists. The [organization example](organization-mobile-after.jpg) keeps its verified state, mission, and next-shift action visible.

### Home hero waited on image traffic

One cold local production run at 375×812, 150ms simulated latency, 200 KiB/s download, and disabled cache observed home hero LCP at about **14.7s**. Converting licensed source images to WebP and using small cause thumbnails brought it to about **9.0s**. A route-aware preload script generated from the central photo manifest brought it to about **5.7s**. The script does not preload the home image on task routes. These numbers are directional lab observations from one run per stage, not field Web Vitals or a guarantee for the deployed site.

Original JPEGs remain in `assets/source-images/`. `npm run images:optimize` recreates public WebP assets. Credits and sources remain in [ASSET_CREDITS.md](../../ASSET_CREDITS.md).

## Verification

- Production build and TypeScript check passed after the changes.
- `npm run check:tokens` passed.
- Existing Playwright smoke tests passed, 2 of 2.
- Unit suite passed, 1,207 of 1,207 tests. Seeded Tier 0 end-to-end flow passed, 3 of 3, after its sign-in helper was updated to check the current account menu.
- Axe returned no WCAG A/AA violations on home, Explore, login, or Help at 375px.
- Home, Explore, login, and Help had no horizontal overflow at 375px, 768px, or 1440px. The sampled public images loaded without browser errors.
- Login and Help at 150% text and high contrast had no horizontal overflow. Their larger content extends farther down the page as expected.

## Next evidence needed

Run volunteer and coordinator task sessions with real people. Inspect signed-in coordinator flows and measured mobile field performance. Do not assign a whole-site design or AI-slop grade from this focused review.
