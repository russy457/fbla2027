# Project guidance for future agents

Read [docs/SPEC.md](docs/SPEC.md) for behavior, [docs/DESIGN.md](docs/DESIGN.md) for the visual direction, and [docs/UX_RESEARCH.md](docs/UX_RESEARCH.md) for the evidence and review method before UI work. User instructions take precedence over these files.

## Design contract

- Make Tandem feel like a warm, photographic field guide to local service. Keep its barely off-white and brown palette, real contextual photos, and clear space for text in image crops.
- Use one or two word editorial headings. Give task, error, legal, and accessibility headings the words needed for clarity. Keep the single-ink tandem bike mark with the Tandem wordmark; do not add other logo treatments, tiny eyebrow headings, mixed fonts within a heading, em dashes, fake impact figures, or city-specific branding.
- Keep `/` distinct from `/explore`. Preserve the full-width photo scenes, layered scrolling, and shrinking icon navigation. Keep controls, schedules, and role workflows easy to find.
- Remove decorative cards, frames, shadows, borders, and animation when they do no work. Keep boundaries, labels, focus, and contrast needed to recognize controls and states.
- Store reusable visual choices in tokens, media metadata, shared components, or page configuration. Do not scatter hard-coded colors, crops, or one-off spacing across routes.
- Keep existing Firebase, volunteer, coordinator, kiosk, verification, and demo behavior working. A visual change must not invent or hide operational facts.

## Gstack-informed workflow for UI changes

Use the published [gstack sprint](https://github.com/garrytan/gstack/blob/main/README.md): Think, Plan, Build, Review, Test, Ship, Reflect. If gstack commands are unavailable, follow the method manually and state that limitation. Do not claim a gstack run or design score without one.

1. **Think:** Identify the user, their task, the page mode (Persuade, Operate, Read, or Hybrid), and the one action the first screen should support. Separate research evidence from a design hypothesis. State the visual thesis in one sentence.
2. **Plan:** Write the content order and the purpose of each section. Name any motion that helps orientation. Identify affected routes, shared components, content states, accessibility needs, and risks. Keep the existing design spec and rubric in view.
3. **Build:** Make the smallest coherent change to the shared system. Preserve real data and state transitions. Write text that says what a person can do.
4. **Review:** Inspect rendered pages and interactions, not code alone. Capture before and after evidence at 375px, 768px, and 1440px for affected surfaces. Include 150% text, keyboard focus, high contrast, reduced motion, loading, empty, error, and success states where applicable. Check both first viewport and scrolled content. Use the [gstack design review criteria](https://github.com/garrytan/gstack/blob/main/design-review/SKILL.md) without treating aesthetic detectors as a substitute for judgment. Do not assign a visual score without screenshots.
5. **Test:** Run relevant typecheck, build, unit or e2e checks, accessibility checks, and live task walkthroughs. Prefer real volunteer and coordinator tasks over tests that only mirror implementation.
6. **Ship and reflect:** Report what changed, evidence, unresolved risk, and the next highest-value fix. Push or deploy when the user has authorized it and tools allow it.

Prioritize the user completing a task over a decorative effect. Photo composition may lead on landing pages; task content leads on signup, schedules, rosters, kiosk, verification, and forms. Use [docs/UX_RESEARCH.md](docs/UX_RESEARCH.md) as the persistent decision record and update it when research or observed behavior changes the rules.
