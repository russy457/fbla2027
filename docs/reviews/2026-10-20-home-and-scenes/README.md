# Home and task scene review, 2026-10-20

This review manually follows the published [gstack sprint and design review](https://github.com/garrytan/gstack/blob/main/design-review/SKILL.md). The gstack CLI was unavailable. No formal score is claimed.

## Think and plan

The home page is Persuade: its first screen should show local service and offer a clear route to open shifts. My Shifts and Impact are Operate: a volunteer should find their current work or verified record quickly. Help is Read: search and answers should be easy to scan. The visual thesis is that a distinct, warm home photograph leads discovery while task descriptions read on light paper below short photo openings.

The content order remains: home title and Explore action, cause links, three activity stories, final shift-finder link. Task routes keep title, description, then live content. The light section rises over the photo on scroll. This change affects the shared `PageHeader`, home media manifest and preload, responsive scene styles, and the Impact letter preview's keyboard path. It does not change Firebase reads or actions.

## Rendered findings

At 1440px, the light section began about 36px before the description ended on [My Shifts](before-shifts-1440.jpg), [Impact](before-impact-1440.jpg), and [Help](before-help-1440.jpg). The white text lost contrast where it crossed the light section. The [new Shifts](after-shifts-1440.jpg), [Impact](after-impact-1440.jpg), and [Help](after-help-1440.jpg) views place descriptions inside that section in dark text. At 375px, the same shared change preserves the first control and reading order: [Shifts](after-shifts-375.jpg), [Impact](after-impact-375.jpg), [Help](after-help-375.jpg).

The [previous home](before-home-1440.jpg) reused Impact's donation-center image and placed the cause row over the opening. The [new desktop](after-home-1440.jpg) and [phone](after-home-375.jpg) openings use distinct garden photos with room for text. The cause row now starts on the rising light section. [Desktop scroll](after-home-scrolled-1440.jpg) and [phone scroll](after-home-scrolled-375.jpg) show the layer transition and compact icon navigation.

Before and after first-viewport captures for all four routes at **375px, 768px, and 1440px** are in this folder. Original Pexels source pages and licenses are recorded in [asset credits](../../ASSET_CREDITS.md). Images remain illustrative and are not assigned to a named shift.

## Review and test

- No horizontal page overflow was observed on the four routes at 375px, 768px, or 1440px. My Shifts, Impact, and Help also fit at 150% text and high contrast.
- The shared description begins after the photo title area at all three widths. It stays on the light section when text expands.
- The home hero loaded its phone and desktop sources at the intended breakpoints. The compact navigation and cause links remained usable after scrolling.
- Axe checked the affected routes at phone width. Its scroll-region finding in the Impact letter preview led to a named, keyboard-focusable table region. A repeat check at 150% text and high contrast found no WCAG A/AA violations on Impact.
- Production build and token scan passed. The unit suite passed 1,207 of 1,207 tests. Playwright smoke passed 2 of 2, and the seeded volunteer/coordinator end-to-end flow passed 3 of 3.

## Remaining evidence

Watch real volunteers find a shift and locate their hours. Measure live home LCP after deployment; image size alone does not prove field speed.
