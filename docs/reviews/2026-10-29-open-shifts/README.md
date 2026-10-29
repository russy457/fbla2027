# Open shifts review

Method: manual Think, Plan, Build, Review, Test, Ship, Reflect sequence from the published gstack sprint. The gstack CLI is unavailable here; no gstack command run or design score is claimed. Browser evidence is from Chromium.

## Think and plan

User: a visitor choosing a volunteer shift. Page mode: Operate within Explore's photographic Hybrid page. First schedule action: choose a date or open a shift. The visual thesis is a single calm dark timetable where time, work, place, availability, and sign-up can be scanned in order.

The existing live demo shifts had all ended, which explained the empty schedule. The change needed real Firestore instances and their kiosk records, not client-side placeholder rows. It also needed to retain Explore filtering, list and map switching, sign-up routing, saved items, and the honest empty state. We kept the schedule in the same place and used the existing eight fictional opportunities. The new command is additive and rerunnable; no prior signup or attendance documents were changed.

## Rendered evidence

| Width | Before, empty | After, populated | Scrolled rows |
| --- | --- | --- | --- |
| 375px | [Before](before-375.webp) | [After](after-375.webp) | [Rows](scrolled-375.webp) |
| 768px | [Before](before-768.webp) | [After](after-768.webp) | [Rows](scrolled-768.webp) |
| 1440px | [Before](before-1440.webp) | [After](after-1440.webp) | [Rows](scrolled-1440.webp) |

The [first phone viewport](first-375.webp) and [first desktop viewport](first-1440.webp) still show the distinct Explore opening. [320×568](short-320.webp), [150% text](large-375.webp), [high contrast](contrast-375.webp), and [reduced motion](reduced-375.webp) retain readable rows without page overflow. [No results](no-results-320.webp) still offers Clear filters.

The date chooser scrolls horizontally and includes all 17 upcoming dates. Keyboard activation of its final date narrows the list to one shift. The first shift's Sign up action sends a signed-out visitor to sign-in with the correct return path. Its detail route loads the actual title, organization, and action. The 19 new Firestore instances each have the standard instance fields and kiosk secret, and eight opportunity next-start fields were refreshed. A dry rerun reported zero new dates.

## Accessibility and tests

- The row title is a real detail link, organization is a separate link, and action labels retain the shift name. Date buttons expose their pressed state. The actual address and seat count remain text rather than icon-only information.
- Axe found no WCAG A/AA violations in the checked 375px, 768px, 1440px, 150% text, high-contrast, and reduced-motion schedule states. No browser page errors or horizontal overflow appeared in those states or at 320px.
- The shift-plan test checks stable IDs, sufficient lead time, and local Saturday timing across a daylight saving change. Typecheck, token scan, and production build passed. All 1,218 unit tests and both focused Playwright smoke tests passed.

The next useful observation is whether real visitors find the date chooser before using search. The current data is fictional presentation content; run `npm run populate:shifts` to preview fresh future dates before a later event.
