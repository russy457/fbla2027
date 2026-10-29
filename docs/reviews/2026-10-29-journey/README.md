# Home journey review

Method: manual Think, Plan, Build, Review, Test, Ship, Reflect sequence from the published gstack sprint. The gstack CLI is unavailable here, so this is not a gstack command run or a design score. Browser evidence is from Chromium. The local Firebase notice visible in the first-viewport captures is a development-only notice.

## Think and plan

User: a visitor considering local service. Page mode: Persuade. First-screen action: **Explore shifts**. The owner wanted the tandem bike motif to drive a pinned scroll sequence with changing photo and text information. The visual thesis is a dark, full-width story stage where real cause photography leads and one single-ink bike moves along a restrained road.

The home order remains: photographic opening and Explore action, cause links, three story stops, then the full-width reading photo. The three existing gallery stories became the scroll stops, so the page does not repeat them. Each stop links to its existing Explore filter. The section stays in view through native scrolling and releases after the third stop; no wheel events are captured or prevented. Keyboard step buttons choose a stop. Short viewports, 150% text, and reduced motion show all three stories in normal flow.

## Rendered evidence

| Width | Previous gallery | New sequence, middle stop |
| --- | --- | --- |
| 375px | [Before](before-375.webp) | [After](after-375.webp) |
| 768px | [Before](before-768.webp) | [After](after-768.webp) |
| 1440px | [Before](before-1440.webp) | [After](after-1440.webp) |

The [first](phone-first.webp) and [last](phone-last.webp) phone stops show the photo, heading, link, and bike position changing. The [release view](release.webp) shows the next full-width photograph after the pinned stage. [Home at 375px](header-375.webp) and [home at 1440px](header-1440.webp) show the simplified, thicker bike in the wordmark without changing the first-screen Explore action. [Reduced motion](reduced.webp), [150% text](large.webp), and a [320×568 viewport](short-viewport.webp) show the normal-flow fallback.

The first rendered pass had too much vertical separation between phone story text and the bike, and a small visible section label read like an eyebrow. The final layout tightened that spacing and leaves the story title as the visible heading. At 320px, 375px, 768px, and 1440px there was no horizontal page overflow. The first, middle, and last stops show the intended story order and monotonically increasing bike position. A physical mouse-wheel gesture advanced the first stop to the second. The wheel spokes rotate with scroll progress. At the end, normal page scrolling reaches the next photograph.

## Accessibility and tests

- Each active photo has meaningful alternative text and a real filter link. Inactive stops are hidden from assistive technology and keyboard focus; the three numbered step controls have descriptive names and expose the current step. A polite text update announces the active story.
- Reduced motion, 150% text, and short-height layouts expose all three stories as ordinary content. High contrast preserves white text on the dark stage. The browser axe scan found no violations in the checked 320px, 375px, and 1440px states.
- The production build, token scan, and all 1,216 unit tests passed. Seven focused browser tests passed, including scroll progression, keyboard step selection, reduced motion, home and Explore smoke, and the shared bike loader.

This review is rendered and automated evidence, not a real-user study. A future session should check whether visitors notice the three step controls and understand that the story links lead to filtered shifts.
