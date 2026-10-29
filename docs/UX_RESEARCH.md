# UX research and design review playbook

Researched 2026-10-20. This is a durable working guide for Tandem, not a claim that every current screen passes. [SPEC.md](SPEC.md) defines behavior; [DESIGN.md](DESIGN.md) defines the chosen visual direction. User feedback takes priority when either guide conflicts with it.

## Product thesis

**A warm field guide to local service.** A visitor should understand the site in one screen, find a suitable shift quickly, know what commitment they are making, and trust the hours record afterward. A coordinator should move through rosters, check-in, review, and reports without marketing layout slowing work.

The `inspopic.jpg` reference gives us useful composition: photography reaching the viewport edges, type placed in quiet image space, and content layers that rise over a scene as the page scrolls. Those are layout ideas, not a template. The site's own content should show service work, scheduling, and the specific information volunteers need. The existing near-white and brown colors are deliberate user choices. Gstack's generic style detectors may flag a cream palette; that is not a reason to override the user.

## Evidence to design decisions

| Evidence | Decision for this site | Limit |
| --- | --- | --- |
| [NN/g visual hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) explains how contrast, scale, and grouping direct attention. | Give each section one dominant element and one obvious next action. Use spacing and type scale before adding surfaces or borders. | Check actual rendered composition; source code cannot prove eye order. |
| [NN/g aesthetic-usability effect](https://www.nngroup.com/articles/aesthetic-usability-effect/) describes why attractive interfaces can feel easier to use. | Polish matters, but success is measured by completed tasks and clear feedback. | Attractive screens can mask problems, so run task tests. |
| [NN/g information scent](https://www.nngroup.com/articles/information-scent/) shows that labels and surrounding context help people predict a link's destination. | Cause images must name the cause and lead to that filter. Shift rows must preview time, place, commitment, eligibility, and seat state before a click. | Exact row density needs observation with real data. |
| [NN/g scanning research](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/) and [writing for scanning](https://www.nngroup.com/articles/website-reading/) show that people often skim. | Front-load concrete nouns and dates; keep editorial headings short; use descriptive task labels and small, scannable groups. | The F pattern is not universal. Do not force all pages into it. |
| [NN/g minimalism](https://www.nngroup.com/articles/characteristics-minimalism/) warns that hidden essential information can make a clean layout harder to use. | Remove decoration and repeated copy, but keep prices if any, requirements, location, dates, eligibility, and consequences visible when a decision needs them. | Simplification must be tested against task completion. |
| [NN/g photo research](https://www.nngroup.com/articles/photos-as-web-content/) finds that relevant images draw attention while generic decoration is often ignored. | Choose photos that show an activity, people, or setting related to the nearby choice. Store creator, source, license, crop, and placement centrally. Keep stock photos separate from named organizations or shifts. | Photography is not proof of a specific event. |
| [NN/g trust guidance](https://www.nngroup.com/articles/trustworthy-design/) connects credibility to quality, honest detail, and current information. | Show verified state, role and safety rules, actual shift details, transparent hours status, and clear help. Avoid invented outcomes and testimonials. | Trust should be checked with users, not assumed from styling. |
| [NN/g's nonprofit website study](https://www.nngroup.com/reports/attracting-donors-and-volunteers-non-profit/) examined 60 charity sites with prospective donors and volunteers. | Treat volunteer discovery and organization credibility as core product work, not merely landing-page copy. | The report's detailed recommendations were not available in this research pass; do not attribute specific rules to it. |
| [Baymard applied-filter research](https://baymard.com/research-articles/how-to-design-applied-filters) found that people lose list context when selected filters disappear. | Explore should show active filter names near results, allow one-at-a-time removal, and keep Clear all. Include search and organization scopes. | Baymard studied commerce. This is a reason to test the analogous shift finder, not a proven result for volunteers. |
| [GOV.UK question-page pattern](https://design-system.service.gov.uk/patterns/question-pages/) and [error guidance](https://design-system.service.gov.uk/components/error-summary/) favor necessary questions, specific errors, retained entries, and recovery paths. | Ask for personal details only when needed; explain why. On invalid signup or profile forms, keep entered data and show field-level errors plus a summary for longer forms. | Apply proportionally to form length. |
| [GOV.UK confirmation pattern](https://design-system.service.gov.uk/patterns/confirmation-pages/) gives a clear completion state and next steps. | After signup, cancellation, check-in, hours approval, and letter issue, say what happened and what the person can do next. | Confirm only after server success. |
| [NN/g usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) cover status, language, control, consistency, error prevention, and recovery. | Every live mutation needs pending, success, error, and retry or recovery behavior. Prefer domain words like shift, roster, and hours to internal jargon. | Heuristics guide review; task testing decides severity. |

### Accessibility and performance floors

- Text contrast: at least **4.5:1** for ordinary text and **3:1** for large text, per [WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum). Check the actual photo crop and overlay, not only the token pair.
- Necessary control boundaries, icons, and selected states: **3:1** against adjacent colors under [WCAG 2.2 SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast). Removing a decorative border must not erase the only visible sign that a field is interactive.
- Keep this project's **44px** preferred touch target. [WCAG 2.2 SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) has a **24×24 CSS px** minimum with exceptions; 44px is the stronger local usability choice.
- At 320 CSS px and 150% text, preserve readable content without horizontal page scrolling except truly two-dimensional data, per [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow). Keep visible keyboard focus and full keyboard paths.
- Motion should explain a change of place or state. Do not make scroll effects necessary to understand content. Honor reduced motion; [WCAG animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions) and [MDN's media query guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion) describe the preference.
- Measure photo-led pages with field or lab data. [Core Web Vitals](https://web.dev/articles/vitals) targets at the 75th percentile are **LCP ≤2.5s**, **INP ≤200ms**, and **CLS ≤0.1**, segmented by mobile and desktop. Avoid diagnosing a slow hero without measurement.
- Keep the first-viewport hero eager and eligible for high fetch priority. Defer only images that are genuinely below the fold. [web.dev's image loading guidance](https://web.dev/articles/browser-level-image-lazy-loading) explains why eager-loading the LCP image matters and why offscreen images can be lazy.

## Aesthetic rules that resist generic AI output

The [gstack design review](https://github.com/garrytan/gstack/blob/main/design-review/SKILL.md) calls out generic card grids, stacked cards, a strong headline without action, busy imagery behind text, repeated mood sections, purposeless carousels, decorative gradients, and default section rhythm. Apply these as an audit checklist, then judge the actual page and task.

"AI-looking" is an aesthetic description, not a claim about an image's origin or user trust. A small [NN/g study of AI-generated images](https://www.nngroup.com/articles/ai-generated-images/) did not find an inherent trust penalty in its tested context. Our standard is specific, honest, useful imagery and editorial judgment, regardless of tool provenance.

1. **Use a clear visual thesis.** One photo or task surface leads each viewport. Avoid four equally loud elements competing for attention.
2. **Edit copy like a person wrote it.** Name a real task or benefit. Avoid broad promises, marketing buzzwords, fake urgency, and statistics we cannot source. Keep the user's short, unpretentious style. No em dashes.
3. **Use images for meaning.** Review multiple candidates for subject, consent/licensing, crop, color, and empty area for type. Prefer visible action and credible setting over smiling-at-camera stock imagery. Record attribution in [ASSET_CREDITS.md](ASSET_CREDITS.md). Never imply an illustrative photo depicts a listed shift.
4. **Keep a deliberate type system.** Besley for standalone display, Atkinson Hyperlegible Next for task text and large photo headings, JetBrains Mono only for codes and tabular values. One font per heading. Do not use type mixing as decoration.
5. **Let layout carry structure.** Use alignment, whitespace, column width, and typography before cards, shadows, frames, or separator lines. Keep functional grouping in forms, tables, and status lists.
6. **Vary page rhythm by content.** Photography and layered scroll make sense for landing and discovery. Roster, kiosk, and account pages need immediate work surfaces. Repeated full-height heroes on every task route should be challenged if they delay the task.
7. **Give motion a purpose.** The shrinking navigation and rising schedule can support orientation. Skip autoplay carousels and wheel interception. The owner-requested home story pins a visual stage during native scrolling and releases it after the last scene. Verify reduced motion, enlarged text, and touch scrolling.
8. **Design every state.** Search with no matches, full or cancelled shifts, auth errors, Firestore latency, kiosk failures, and successful signup should all be as intentional as the default screenshot.

### Photo selection gate

For each new candidate, write down what activity it shows and what choice it supports. Reject any image whose subject, clothes, setting, or gesture makes the adjacent copy feel staged or misleading. Inspect the original at desktop and phone crops. Place text in quiet space; verify contrast across the whole text area after the final crop and overlay, as [MDN advises for text on images](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/background-image). Prefer a stable crop over text that moves across faces at different widths. Check the image's source and allowed use, then add its metadata to the media manifest and [ASSET_CREDITS.md](ASSET_CREDITS.md). Mark meaningful photos with useful alternative text; keep truly decorative hero scenery silent to assistive technology when nearby text carries the message.

### Page modes

Gstack asks reviewers to name the user's win before judging a page. Use [its page-mode rules](https://github.com/garrytan/gstack/blob/main/design-review/SKILL.md):

| Surface | Mode | First-screen job |
| --- | --- | --- |
| Landing `/` | Persuade | Explain volunteer service and give a direct Explore path. |
| Explore `/explore` | Hybrid | Photo sets the scene; search, filters, dates, and results make choosing a shift possible. |
| Opportunity detail | Operate | Decide if a particular shift fits; sign up or save. |
| My Shifts, Impact, profile | Operate | Show current status, next action, and verifiable history. |
| Onboarding and login | Operate | Finish one step with minimal friction and recover from errors. |
| Coordinator, roster, reports, kiosk | Operate | Show task controls and data first; a large photo must not delay the work. |
| Help and legal | Read | Make answers and wayfinding easy to scan; keep reading width comfortable. |

## Gstack review sequence

The [published gstack sprint](https://github.com/garrytan/gstack/blob/main/README.md) is Think, Plan, Build, Review, Test, Ship, Reflect. Its [design-review method](https://github.com/garrytan/gstack/blob/main/design-review/SKILL.md) reviews rendered pages, records concrete findings with screenshots, prioritizes impact, fixes them, then checks before and after. Use it for every substantive UI change, even if the command-line package is unavailable.

1. State the task and page mode. Write down what the first viewport should communicate and which action it should expose.
2. Capture baseline images at **375px, 768px, and 1440px** for affected routes. Capture a scrolled state, selected filters, menu open, and relevant empty, loading, error, and success states. Wait for image decode.
3. Review hierarchy, type, spacing, contrast, interaction, responsive layout, content, AI-looking patterns, motion, and performance feel. Gstack weights hierarchy, type, and spacing most heavily; its visual score and AI-slop score are separate. Record a screenshot and exact reason for each finding. Do not assign scores from code inspection.
4. Fix the highest-impact user problem first. Re-capture the same state and width. Check the whole flow for regressions, not only the edited component.
5. Run automated checks and a real task walkthrough. For formative testing, recruit around **five people per distinct user group**, following [NN/g guidance](https://www.nngroup.com/articles/how-many-test-users/). Ask them to complete a realistic task without directing clicks; record success, wrong turns, hesitation, and spoken concerns. Five observations are for finding problems, not a population-level conversion claim.
6. Ship with a brief evidence note and add new durable decisions here. If rendered verification is unavailable, label findings as hypotheses and keep the visual audit open.

### Task scenarios to observe

- Visitor: Find a food-related shift on a weekend near home, inspect its requirements, and sign up.
- Volunteer: Find tomorrow's commitment, check in, and later locate approved hours or a verification letter.
- Coordinator: Publish a shift, inspect the roster, resolve attendance, and export the hours report.
- First-time user: Recover from an invalid form entry or service error without losing their work.
- Keyboard-only and small-screen users: Complete the same critical path without hidden controls or horizontal page scroll.

## Research hypotheses and audit status

The [October 20 rendered review](reviews/2026-10-20/README.md) tested these initial hypotheses. It includes before and after images, measurements, and remaining limits.

| Hypothesis | Rendered finding and change |
| --- | --- |
| Hidden filter values may make a narrow Explore result set confusing. | Confirmed in a 0-result state with the filter panel closed. Active filters now appear as individually removable text controls near the result count. Removing one updated the URL and revealed a shift. |
| Eager editorial photos may compete with the home hero. | Confirmed with a local throttled production run. Full and thumbnail WebP files plus early route-aware hero preloading reduced the observed mobile home LCP from about 14.7s to 5.7s under the same simulated link. This is one lab run, not field data. |
| Full-height openings may delay tasks. | Confirmed on mobile: the first login control began at page position 1,061px and Help search at 1,089px. A shared shorter scene and compact notice moved them to 542px and 570px. |
| Stock imagery near a named shift may mislead. | Confirmed: a food-packing shift appeared beneath a gardening photo. Named shift and organization pages now use a plain brown opening until an approved photo exists. |
| A fixed photo boundary can cover task descriptions when text wraps. | Confirmed on desktop Shifts, Impact, and Help: the light section began about 36px before the white description ended. Shared `PageHeader` now puts descriptions on the light section and leaves only the title on the photo. This also handles longer copy and enlarged text without changing the scene height. |
| Reusing the Impact image on the home hero weakens the landing page's identity. | Confirmed in side-by-side route screenshots. Home now uses separate garden and tree-planting photos selected for their desktop and phone text space. Its first viewport leads with the Explore action, and cause photos move to the light section that rises over the hero. |

### Current verification status

The [home and task scene review](reviews/2026-10-20-home-and-scenes/README.md) adds before and after browser evidence at 375px, 768px, and 1440px. The October reviews checked 150% text, high contrast, and automated accessibility. They did not include real-user sessions or field performance data. No formal gstack or AI-slop score is assigned because the gstack CLI is unavailable here and the audit did not cover every route.

### 2026-10-28 schedule decision

A code and rubric review found that the signup flow allowed one volunteer to book overlapping shifts. This is a product risk, not a user research finding. Explore and the shift page now show a direct link to the existing commitment when the live signup list reveals a clash. The server also checks the schedule in the signup transaction and serializes simultaneous bookings for one volunteer. Waitlist places count because they may be promoted into confirmed spots. Adjacent shifts remain available when one ends exactly as the next begins. A future usability session should check whether volunteers understand that a waitlist place holds time on their schedule.

### 2026-10-29 brand and loading decision

The owner asked for a tandem bicycle motif and a moving bike in loading states. This is a brand direction, not a finding from user research. A single-ink vector mark now appears beside the Tandem wordmark and in the footer and favicon. In loading states, its wheels turn while short road strokes pass below it. Loading text remains visible and announced, structural placeholders remain for page and query waits, and reduced-motion settings leave the bike still. The [first rendered review](reviews/2026-10-29-bike/README.md) records the initial contrast fixes and screenshots; the mark was simplified later the same day for the home journey. Future review should check whether the mark remains legible in real phone browser chrome and whether the animation helps people recognize that a slow request is still in progress.

### 2026-10-29 home journey decision

The owner requested a pinned home scroll story where new photo and text scenes appear as a tandem bike advances. This is a design direction. The three existing cause stories now share one sticky stage after the cause links, with a native-scroll progression and keyboard step controls. The bike mark uses fewer spokes and thicker strokes. Below 42rem viewport height, with 150% text, or under reduced motion, every story appears in normal flow. The [rendered review](reviews/2026-10-29-journey/README.md) records screen sizes, progression, and accessibility checks. User observation is still needed to learn whether people notice the story links and understand the three-step progression.

### 2026-10-29 open shifts decision

The owner asked for a populated, cleaner Open Shifts area. The live Firestore collection held only past finalized presentation dates, so the schedule correctly showed an empty state. A repeatable additive script now creates future instances for the existing fictional organizations; the app still reads Firestore and its normal signup state. The schedule uses one dark surface and divided rows rather than a card per shift. Each row previews the existing listing's summary and place, while the date rail exposes every available day. Repeated signed-out hints were removed from the rows; the sign-up button still routes through sign-in. The [rendered review](reviews/2026-10-29-open-shifts/README.md) records viewport and task checks. This is a design hypothesis grounded in the site's scanning and information-scent research, not a user study.
