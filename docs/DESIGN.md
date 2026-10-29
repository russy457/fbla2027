# Tandem UI design spec

Updated 2026-10-29 from the design interview, `inspopic.jpg`, and rendered UX reviews. [SPEC.md](SPEC.md) remains the source of truth for routes, roles, data, and workflow behavior. The visual system can change without changing those rules. [UX_RESEARCH.md](UX_RESEARCH.md) records the research and review method; [the home journey review](reviews/2026-10-29-journey/README.md) records the latest scroll sequence.

## Design direction

**Warm community editorial.** The site should feel composed, human, and confident. The reference image contributes its photographic opening, broad light sections, small rounded controls, and image led browsing. Use those ideas for a volunteer platform, with real task information kept clear.

The main job is to help someone find a shift, sign up, show up, and keep a trustworthy hours record. Coordinators need fast access to rosters, check-in, approvals, and reports. Every route should feel like the same site. The home page can be expressive; task screens should be calm and efficient.

The visual anchor is a full viewport landing photograph with text in the shaded open space. The oval row of cause photos sits on the nearly white section that rises over it. Photos sit directly in the layout, without decorative boxes around editorial text. Explore opens with a full viewport photograph and words in its shaded open space. Its filters and dark schedule rise over the photograph as the visitor scrolls. The nearly white section below covers the last part of the photograph. Task routes use shorter full-width openings so controls appear sooner. Their titles sit over the opening; descriptions sit on the light section below for reliable contrast. Named shifts and organizations use a plain brown opening until they have their own approved photos.

Design feasibility check: impact 5, context fit 4, implementation 5, performance 4, consistency risk 3. DFII: **15**. The risk is photographic inconsistency, so selected assets and crops live in one manifest.

## Fixed decisions

- Pair the name **Tandem** with the original single-ink tandem bicycle mark. Use the still mark in navigation, footer, and favicon. Its moving version appears in loading states and advances with the home story scroll.
- Do not name or imply one home city. Demo organizations are fictional.
- Keep existing functionality. `/` is a distinct landing page and `/explore` is the shift finder. Restructure markup and shared components when it improves the design.
- Write short, unpretentious copy. No em dashes, invented impact numbers, hype, or robotic phrasing.
- Editorial headings use one or two words. Keep task, error, legal, and accessibility headings descriptive when clarity needs more words. Do not place tiny eyebrow labels above headings.
- Keep all visual decisions modular. Palette values belong in `src/styles/tokens.css`; semantic roles are exposed through `src/styles/app.css`. Photo metadata belongs in `src/content/editorialMedia.ts`, and route assignments belong in `src/content/pageVisuals.ts`.
- Use React Bits only for subtle motion with a purpose. Respect reduced motion.

## Color and type

The page background is `#FCFBF9`, barely different from white. Clean surfaces are white. Darkest text and the home opening use `#2C1D15`; muted copy uses `#6D594B`; links, selected states, and primary buttons use `#70482F` and `#593723` on hover. Lines and soft surfaces use `#D8CEC4` and `#F6F3EF`. Status colors keep independent semantic roles for success, warning, danger, and neutral.

Use the self hosted Besley variable face for standalone display text, Atkinson Hyperlegible Next for body, controls, and large photo headings, and JetBrains Mono only for codes and tabular values. Each heading uses one font throughout its phrase. Type needs to stay readable at 100%, 125%, and 150% text settings. A future font change should require token and font import updates, not component rewrites.

Primary actions can be rounded pills. Forms, grouped data, and lists should have clear edges and compact spacing. Use surfaces and spacing before borders; reserve lines for functional separation in dense lists and tables. Avoid gradients as decoration, glass effects, colored frames behind standalone heading and paragraph sections, excessive shadows, and identical card stacks.

## Photography

Use photographs throughout discovery and general page openings, with recognizably different activities: donations, planting, reading, animal care, and cleanup. Choose crops with clear subjects and enough room for text. Landing and Explore place words directly over shaded open space in full width photographs. Stock photos must not be assigned to a named shift or demo organization. Their detail pages use a plain opening until an organization supplies an approved photo.

The selected set and crop positions live in `src/content/editorialMedia.ts` and `src/content/pageVisuals.ts`; source pages, creators, license references, and placements live in [ASSET_CREDITS.md](ASSET_CREDITS.md). Explore uses separate desktop and mobile photos to keep text clear of people. Do not show source links or stock photo disclaimers in the interface. Cause photos link to real filters.

## Layout and navigation

- `/` shows the same photographic landing page to signed-in and signed-out visitors. Its distinct garden hero leaves the first viewport to the title and primary Explore action. A rising white section holds oval images linked to real cause filters. A full-width dark story stage then stays in view while three cause scenes change and the bike moves along a road. Scrolling normally releases the stage after the third scene. Short viewports, 150% text, and reduced motion show all three stories in normal flow. A final full-width photograph follows.
- `/explore` is the scheduling page. Its full viewport photo stays in place as the visitor scrolls into search, filters, and a dark schedule with date choices and shift rows. A nearly white section with four cause photographs, personal recommendations, and collections covers the scene below. The live list remains the default; the map remains available with a public Mapbox token. `PageHeader` serves task routes in a shared shorter scene. Named shift, organization, and coordinator scenes use a plain brown field rather than unrelated stock photography. Onboarding uses a shorter full width photo opening so form steps remain quick to use. Kiosk access has a full width photo opening; the active kiosk keeps its code and arrivals prominent.
- The shift finder keeps search, filters, map or list switch, live states, dates, signup, and save behavior. Cause links open `/explore?cause=...`, using the existing filter parser.
- The top navigation starts as a full row with the bike and Tandem wordmark, four volunteer routes, search, quick help, and account access. After 132px of scroll, the same four route links become a centered icon pill. Accessible names and 44px targets remain. On phones, the full header uses a second row for the four routes; the account menu stays in the first row. The fixed bottom tab bar is removed.
- Account controls, role routes, alerts, and sign out stay in the account menu. Coordinator and admin workflows remain reachable. The full header returns when the user scrolls to the top.
- Task pages, coordinator tables, kiosk, verification, and forms inherit the near white and brown tokens and rounded action controls while remaining information first. Short photographic openings are used where the photo gives honest context. Keep feedback, errors, and statuses visible in text as well as color.

## Interaction and accessibility

Preserve keyboard focus, skip link, route focus, meaningful image alt text, text size and high contrast controls, reduced motion, and a clear loading or retry state. A cause photo's text label stays in HTML. No essential information is baked into an image. Text that sits on the dark hero uses the solid brown field; small photo labels use a dark image shade. Keep photo subject and text apart at 375px and 1440px.

Check the home, Explore, Opportunity, coordinator dashboard, kiosk, and phone check-in at 375px, 768px, and 1440px where useful. Check 150% text for overflow. Run typecheck, build, token scan, functional tests, and axe on stable screens. Browser snapshots must wait for image decoding before judging blank lazy image slots.

## Implementation record

- Near white and brown tokens replace the prior green and clay palette throughout the shared shell.
- `LandingPage` owns `/` and uses `EditorialIntro`, `EditorialJourney`, and `EditorialPhotoNote` for all session states. The cause images are links to valid existing filters. The journey story data lives in `homeJourney.ts`; the shared bike SVG has thicker, simpler geometry. `ExplorePage` owns `/explore`, with the sticky full width scene, `ScheduleBoard`, and `ExploreCauseRibbon`.
- `AppLayout` draws each general route photo and crop from `pageVisuals.ts`. `PageHeader` places the title over that scene and the description on the light section below. The shared route content rises over the shorter opening on scroll. Named shift, organization, and coordinator routes use a plain opening. Help and legal pages use the same layout without changes to their feature screens.
- Onboarding and kiosk screens carry the same photography and brown accents without compromising form, check-in, or code legibility.
- The header now morphs into a four icon pill after scrolling, while retaining its route and account behavior.
- The original tandem bike SVG anchors the header wordmark and footer. A motion version replaces generic loading pulse in shared data and route states, the kiosk code wait, help answer wait, and onboarding human check. CSS movement uses only transforms and stops for reduced motion.
- The photo set was chosen after reviewing multiple candidates from Pexels and Unsplash. Individual credits and license references are recorded in [ASSET_CREDITS.md](ASSET_CREDITS.md).
- Full and thumbnail WebP files are generated from retained source photos with `npm run images:optimize`. A small route-aware preload script requests the home or Explore hero before React mounts.
- Browser review covered the landing, login, help, and onboarding openings at 1440px and 390px, including the point where light content covers the photo. Captures should wait for image decoding before judging blank lazy image slots.

The Firebase plan is Blaze. This visual change does not add any billable service.
