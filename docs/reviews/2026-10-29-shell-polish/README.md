# Footer, recommendations, and account review

Method: manual Think, Plan, Build, Review, Test, Ship, Reflect from the published gstack sprint. The gstack CLI was unavailable, so no command run or design score is claimed. Browser evidence is from Chromium against the production-mode Vite app using the existing cloud demo volunteer.

## Think and plan

Users: visitors browsing shifts and signed-in volunteers opening their account. Explore is Hybrid; the footer and Settings page are Read/Operate. The first Explore action remains choosing a shift, and the first Settings action is changing a display preference. Visual thesis: recommendations should read like the site's shift schedule, while the footer closes the page in the same warm brown used by the hero.

The affected surfaces were the shared footer, Explore recommendations and onboarding match list, header account disclosure, notification bell, Profile's settings link, and the public Settings route. The account bug came from reusing compact header links in a dropdown, where screen-reader-only labels stayed hidden. The footer's display controls crowded navigation. The main risks were losing signed-out access to display controls, hiding role links, and overflow at 150% text.

## Rendered evidence

| Width | Account before / after | Recommended before / after | Footer before / after | Settings after |
| --- | --- | --- | --- | --- |
| 375px | [Before](before-menu-375.webp) / [After](after-menu-375.webp) | [Before](before-recommended-375.webp) / [After](after-recommended-375.webp) | [Before](before-footer-375.webp) / [After](after-footer-375.webp) | [Settings](after-settings-375.webp) |
| 768px | [Before](before-menu-768.webp) / [After](after-menu-768.webp) | [Before](before-recommended-768.webp) / [After](after-recommended-768.webp) | [Before](before-footer-768.webp) / [After](after-footer-768.webp) | [Settings](after-settings-768.webp) |
| 1440px | [Before](before-menu-1440.webp) / [After](after-menu-1440.webp) | [Before](before-recommended-1440.webp) / [After](after-recommended-1440.webp) | [Before](before-footer-1440.webp) / [After](after-footer-1440.webp) | [Settings](after-settings-1440.webp) |

The old menu showed icon-only rows with blank space where text belonged. The new rows show Profile, Saved, Settings, role links when applicable, and Sign out with icons aligned at the same x coordinate. Notifications retain their separate bell and popover. The Recommended section now has real shift links, dates, match reasons, and organizations without card frames. The footer has short routes and legal links; the display controls are on a public Settings page.

## Interaction and accessibility

- On the phone, keyboard Enter opens the account menu, Tab reaches Profile, Escape closes it and returns focus to the trigger, and an outside click closes it. The Settings row opens the Settings page. The bell opens its dialog and Escape closes it.
- Text size 150%, high contrast, and reduced motion persisted after reload. At 375px, 768px, and 1440px, Settings, the account menu, and recommendations had no page-level horizontal overflow after the footer wordmark was reduced on narrow screens. [The 150% high-contrast footer](after-footer-contrast-375-settings.webp) and [recommendations](after-recommended-contrast-375.webp) remained legible.
- Axe found no violations in the checked 375px Settings and open-menu states, or in the 375px high-contrast, 150%-text Settings and Explore states. The signed-out Settings route kept all five display controls available. The existing no-interests recommendation state still links to Profile.
- Production build, token scan, and focused Profile, legal, route-head, and recommendation tests passed. No Firebase writes or changes to signup, roster, or kiosk behavior were needed.

Next observation: watch a few volunteers use the account menu and recommendations without prompting to see whether the labels and match reasons help them reach a shift. This review has no real-user sessions or field performance data.
