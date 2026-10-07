# fbla 2027 UI design spec

Updated 2026-10-07 from the design interview and `inspopic.jpg`. [SPEC.md](SPEC.md) remains the source of truth for routes, roles, data, and workflow behavior. The visual system can change without changing those rules.

## Design direction

**Warm community editorial.** The site should feel composed, human, and confident. The reference image contributes its photographic opening, broad light sections, contrast between plain and italic type, small rounded controls, and image led browsing. Use those ideas for a volunteer platform, with real task information kept clear.

The main job is to help someone find a shift, sign up, show up, and keep a trustworthy hours record. Coordinators need fast access to rosters, check-in, approvals, and reports. Every route should feel like the same site. The home page can be expressive; task screens should be calm and efficient.

The visual anchor is a dark brown landing opening with one large activity photo and an oval row of cause photos. Below it, the page is almost white, with photos sitting directly in the layout and no decorative boxes around editorial text. Explore opens with a full viewport photograph and words in its shaded open space. Its filters and dark schedule rise over the photograph as the visitor scrolls. The nearly white section below covers the last part of the photograph. Other routes open with a shorter photographic masthead, with titles away from the subject.

Design feasibility check: impact 5, context fit 4, implementation 5, performance 4, consistency risk 3. DFII: **15**. The risk is photographic inconsistency, so selected assets and crops live in one manifest.

## Fixed decisions

- Keep the name **fbla 2027** as text. Do not make a logo yet.
- Do not name or imply one home city. Demo organizations are fictional.
- Keep existing functionality. `/` is a distinct landing page and `/explore` is the shift finder. Restructure markup and shared components when it improves the design.
- Write short, unpretentious copy. No em dashes, invented impact numbers, hype, or robotic phrasing.
- Keep all visual decisions modular. Palette values belong in `src/styles/tokens.css`; semantic roles are exposed through `src/styles/app.css`. Photo metadata belongs in `src/content/editorialMedia.ts`, and route assignments belong in `src/content/pageVisuals.ts`.
- Use React Bits only for subtle motion with a purpose. Respect reduced motion.

## Color and type

The page background is `#FCFBF9`, barely different from white. Clean surfaces are white. Darkest text and the home opening use `#2C1D15`; muted copy uses `#6D594B`; links, selected states, and primary buttons use `#70482F` and `#593723` on hover. Lines and soft surfaces use `#D8CEC4` and `#F6F3EF`. Status colors keep independent semantic roles for success, warning, danger, and neutral.

Use the self hosted Besley variable face for display text and italic emphasis, Atkinson Hyperlegible Next for body and controls, and JetBrains Mono only for codes and tabular values. The home title pairs large, light sans text with one italic serif line. Type needs to stay readable at 100%, 125%, and 150% text settings. A future font change should require token and font import updates, not component rewrites.

Primary actions can be rounded pills. Forms, grouped data, and lists should have clear edges and compact spacing. Avoid gradients as decoration, glass effects, colored frames behind standalone heading and paragraph sections, excessive shadows, and identical card stacks.

## Photography

Use photographs throughout discovery and the page openings, with recognizably different activities: donations, planting, reading, animal care, and cleanup. Choose crops with clear subjects and enough room for text. The landing hero uses separate text and image columns. Explore and the second landing photo section place words directly over shaded open space in full width photographs. Other route mastheads shade the text side. Stock photos must not be assigned to a named shift or demo organization. Organization supplied and approved photos can be added later through their own data field.

The selected set and crop positions live in `src/content/editorialMedia.ts` and `src/content/pageVisuals.ts`; source pages, creators, license references, and placements live in [ASSET_CREDITS.md](ASSET_CREDITS.md). Explore uses separate desktop and mobile photos to keep text clear of people. Do not show source links or stock photo disclaimers in the interface. Cause photos link to real filters.

## Layout and navigation

- `/` shows the same photographic landing page to signed-in and signed-out visitors. A row of oval images links to real cause filters. A white section shows three further cause stories, followed by a full width photograph with text in its open space and a link to the shift finder.
- `/explore` is the scheduling page. Its full viewport photo stays in place as the visitor scrolls into search, filters, and a dark schedule with date choices and shift rows. A nearly white section with four cause photographs, personal recommendations, and collections covers the scene below. The live list remains the default; the map remains available with a public Mapbox token. `PageHeader` serves volunteer, account, help, legal, organization, and coordinator routes. Onboarding and kiosk use quieter photographic accents that leave forms and codes easy to read.
- The shift finder keeps search, filters, map or list switch, live states, dates, signup, and save behavior. Cause links open `/explore?cause=...`, using the existing filter parser.
- The top navigation starts as a full row with brand text, four volunteer routes, search, quick help, and account access. After 132px of scroll, the same four route links become a centered icon pill. Accessible names and 44px targets remain. On phones, the full header uses a second row for the four routes; the account menu stays in the first row. The fixed bottom tab bar is removed.
- Account controls, role routes, alerts, and sign out stay in the account menu. Coordinator and admin workflows remain reachable. The full header returns when the user scrolls to the top.
- Task pages, coordinator tables, kiosk, verification, and forms inherit the near white and brown tokens, photographic openings, and rounded action controls while remaining information first. Keep feedback, errors, and statuses visible in text as well as color.

## Interaction and accessibility

Preserve keyboard focus, skip link, route focus, meaningful image alt text, text size and high contrast controls, reduced motion, and a clear loading or retry state. A cause photo's text label stays in HTML. No essential information is baked into an image. Text that sits on the dark hero uses the solid brown field; small photo labels use a dark image shade. Keep photo subject and text apart at 375px and 1440px.

Check the home, Explore, Opportunity, coordinator dashboard, kiosk, and phone check-in at 375px, 768px, and 1440px where useful. Check 150% text for overflow. Run typecheck, build, token scan, functional tests, and axe on stable screens. Browser snapshots must wait for image decoding before judging blank lazy image slots.

## Implementation record

- Near white and brown tokens replace the prior green and clay palette throughout the shared shell.
- `LandingPage` owns `/` and uses `EditorialIntro`, `EditorialGallery`, and `EditorialPhotoNote` for all session states. The cause images are links to valid existing filters. `ExplorePage` owns `/explore`, with the sticky full width scene, `ScheduleBoard`, and `ExploreCauseRibbon`.
- `PageHeader` draws its photo and crop from `pageVisuals.ts`, so route photography can be changed without editing feature screens. The help and legal screens use it too. Coordinator pages place the header above their sidebar and work area.
- Onboarding and kiosk screens carry the same photography and brown accents without compromising form, check-in, or code legibility.
- The header now morphs into a four icon pill after scrolling, while retaining its route and account behavior.
- The photo set was chosen after reviewing multiple candidates from Pexels and Unsplash. Individual credits and license references are recorded in [ASSET_CREDITS.md](ASSET_CREDITS.md).
- Earlier browser review covered 1440px, 768px, and 375px for the shared header and original photographic pages. The new layered Explore scene still needs live viewport review on the presentation machine; browser automation was unavailable in the current sandbox.
- `npm run typecheck`, `npm run check:tokens`, `npm run build`, and all 1,200 unit tests passed after separating landing and Explore. The browser review should wait for image decoding because a full-page capture can show unloaded image slots before they are painted.

Firebase remains on the free Spark plan. This visual change does not require a plan upgrade.
