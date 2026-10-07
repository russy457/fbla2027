# TODOS

## Coordinator CSV roster import
- **What:** Import an existing volunteer roster (CSV) into an organization.
- **Why:** Real nonprofits already have spreadsheets; import removes onboarding friction.
- **Pros:** Faster adoption; good "maintain records" story.
- **Cons:** Validation and duplicate-matching work; privacy of imported minors.
- **Context:** Deferred in CEO review (E5) on 2026-10-06; outside the demo loop.
- **Effort:** human M / CC S
- **Priority:** P3
- **Depends on:** org membership + users model.

## Spanish UI
- **What:** Spanish translation of the volunteer-facing UI.
- **Why:** Volunteers and coordinators may prefer to use the app in Spanish.
- **Pros:** Accessibility and inclusion story for judges.
- **Cons:** Large; every string needs extraction.
- **Context:** Deferred in CEO review (E6).
- **Effort:** human L / CC M
- **Priority:** P3
- **Depends on:** string extraction pass after the new design doc.

## Training/certification prerequisites
- **What:** Opportunities can require a training or certification before signup.
- **Why:** Food handling, youth programs, and background checks are common requirements.
- **Pros:** Realistic nonprofit compliance.
- **Cons:** New domain object and coordinator verification flow.
- **Context:** Deferred in CEO review (E7).
- **Effort:** human M / CC S
- **Priority:** P3
- **Depends on:** opportunity + signup model.

## Data retention / export automation
- **What:** Automated deletion/export requests, contact-snapshot retention after shifts, avatar moderation.
- **Why:** Minor-heavy audience; privacy obligations beyond field visibility.
- **Pros:** Real compliance story.
- **Cons:** Ops work beyond demo scope.
- **Context:** Raised by Codex in eng review (2026-10-06); documented manually on the privacy page for now.
- **Effort:** human M / CC S
- **Priority:** P3
- **Depends on:** stable data model (docs/SPEC.md).

## Identity Platform blocking functions
- **What:** beforeUserCreated blocking function to enforce Turnstile/age at account creation.
- **Why:** Stronger than the profile gate.
- **Pros:** Blocks bots before any account exists.
- **Cons:** Requires upgrading to Identity Platform.
- **Context:** Eng review S1 alternative.
- **Effort:** human S / CC S
- **Priority:** P3
- **Depends on:** new Firebase project on Blaze.

## No-emulator mock mode (TD3)
- **What:** `npm run dev:ui` with in-memory mock repositories, no Java/emulators.
- **Why:** Fastest first screen for UI-only teammates.
- **Pros:** Sub-minute UI start.
- **Cons:** Second data path to maintain.
- **Context:** Declined in DX review (DX POLISH); revisit if emulator setup blocks teammates.
- **Effort:** human M / CC S
- **Priority:** P3
- **Depends on:** repository layer in src/lib/data.
