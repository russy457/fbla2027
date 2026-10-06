<!-- /autoplan restore point: "C:\\Users\\jingd\\.gstack\\projects\\jingd\\main-autoplan-restore-20261006-170233.md" -->
## Implementation plan
# Port Plan: Trove (2025-26) → Volunteer Management App (2026-27)

> Source of truth for product behavior: `docs/designs/volunteer-management-port.md` (APPROVED
> 2026-10-06). It defines the domain mapping, the four headline features (live 3-device
> check-in kiosk, AI shift planner, verified hours letters + `/verify`, waitlist + reliability),
> roles + rules matrix, privacy for minors, AI key placement, demo topology, and 26 recorded
> reviewer concerns that this plan must resolve.

## Goal
Port every feature and the code structure of last year's app (`russy457/fblaslc2026`, "Trove",
a local-business discovery site) into this repo, re-targeted at the 2026-27 FBLA Coding &
Programming topic **"Serving the Community: Nonprofit Volunteer Management"**. Fix any
existing errors while porting.

### Constraints (from the team)
- **No old design.** Drop the cork-board/Trove visual system (board/, storefront/, home/ hero
  components, tokens.css, board.css, storefront.css, motion.css, Sora/Inter brand).
- **React Bits + taste-skill now, tokens for later.** Build screens with React Bits (TS +
  Tailwind variants via shadcn CLI; CountUp, AnimatedList, SpotlightCard,
  AnimatedContent/FadeContent) following taste-skill rules. Every color/font/radius/motion
  value lives in `src/styles/tokens.css`; `tailwind.config` reads those CSS variables, so the
  team's later design doc reskins without component changes.
- **No Firebase initialization (until the new project exists).** Web config comes from
  `VITE_FIREBASE_*` env vars; no `.firebaserc`, no `firebase init`, no deploy yet. Local dev
  uses emulators (Auth, Firestore, Functions, Storage) under project id `demo-fbla2027`.
  Deploy to the new project (Blaze) must happen before the first competition round.
- **No secrets.** Old repo had a hardcoded Firebase config and a Mapbox `sk.` token in
  `migrate.ts`/`update-mock-addresses.ts`; those files are not ported; all keys go to env.
- Working product name is a single constant (`src/lib/brand.ts`) so it can be renamed.

## Stack (unchanged — rubric: "language selection")
React 18 + TypeScript + Vite, React Router, TanStack Query, Zustand, react-hook-form + zod,
Firebase (Auth, Firestore, Storage, Cloud Functions) on the Blaze plan (free quota): callable
Functions for trusted flows (org registration, signup/waitlist, kiosk check-in/out, hours
letters, AI) plus the PDF report pipeline and Turnstile verification. Tailwind 3 + React Bits
(TS-TW variants), Vitest + Playwright, Recharts, Mapbox GL (public token, optional).

## Domain mapping
| Trove concept | New concept | Notes |
|---|---|---|
| Business | **Organization** (nonprofit) | name, mission, cause category, city/address, coords, photos, contact, verified 501(c)(3) EIN (validated format) |
| BusinessCategory | **CauseArea** | Hunger & Food Security, Education & Youth, Health & Wellness, Environment, Animal Welfare, Housing & Homelessness, Seniors, Arts & Culture, Disaster Relief, Community Development |
| Deal | **Opportunity / Shift** | title, description, date/start/end, location, capacity (`maxClaims`→`capacity`), `claimedCount`→`signupCount`, required skills, min age, type (One-time, Recurring, Virtual, Skilled) |
| DealClaim (token) | **Signup** (check-in code) | status: confirmed, waitlisted, checked-in, completed, no-show, excused, cancelled (lateCancel flag); check-in via rotating kiosk code |
| — (new) | **HoursLog** | volunteer-submitted or coordinator-recorded hours; coordinator approves/rejects; feeds reports |
| Review | **Experience review** of an organization | rating + tags (Well Organized, Welcoming, Meaningful Impact, Good Communication, Accessible), coordinator response |
| Favorites / Wishlist / Lists | Saved orgs / saved opportunities / curated lists | |
| Top Lists | **Curated collections** ("Weekend opportunities for students") | |
| Feed posts | **Impact stories** feed | |
| Support (daily) / Impact page | **Impact dashboard**: hours, orgs helped, streaks, milestone badges (25/50/100 hrs) | |
| Business owner / portal / dashboard | **Organization coordinator** portal: register org, manage opportunities, roster, check-in, approve hours, analytics | |
| Organic discovery score | **Opportunity match score** (skills, interests, availability, distance) | Intelligent feature |
| Search engine (BM25/trie/geohash/Levenshtein) | Same engine over orgs + opportunities | Kept verbatim; adapter changes |
| Report builder (client + Functions PDF) | **Volunteer hours report** (service-hour verification letter) and **Organization participation report** (signups, attendance rate, hours by opportunity/month, top volunteers) with section/date-range/color customization + CSV export | Rubric "customizable reports" |
| Help Center + TroveChat AI | Help Center + AI Q&A assistant (system prompt rewritten for volunteering) with offline FAQ fallback | Rubric "interactive Q&A" |
| Turnstile gate | Kept (bot protection on signup/auth) | |
| Onboarding tour + onboarding page | Kept; onboarding collects interests (cause areas), skills, availability, birth date (stored privately; 13+ enforced) | |
| Command palette, cookie consent, legal pages, SEO, error boundary, 404, lazyWithReload | Kept, re-texted | |

## Headline features (from the approved design)
1. Live 3-device check-in kiosk (rotating HMAC code, `checkIn`/`checkOut` Functions, locked kiosk route, live roster).
2. AI shift planner (deterministic parser + match ranking always; Claude via Function when a key exists).
3. Verified hours letters (PDF) + public `/verify` page (128-bit code, minimal public fields, superseded status).
4. Waitlist (transactional, auto-promote, 2 h cutoff) + reliability score (defined formula, cold start).
Plus in-app notifications, recurring series/instances, roles/membership/admin claim, minor privacy.

## Phases
1. **Scaffold** — package.json (renamed, deps pruned of dataconnect/lenis/fuse/gemini), Vite/TS
   configs, `.gitignore`, `.env.example`, CI workflow, env-driven `firebase.ts`, Tailwind + shadcn `components.json` +
   `styles/tokens.css`, brand constant. (git init + remote already done.)
2. **Core domain layer** — `src/lib/types.ts`, `firestore.ts` (split by domain into
   `src/lib/data/*.ts` to fix the 1,335-line file), `api.ts`, `appStore.ts`, mock/seed data
   (San Antonio nonprofits), search adapter, match score, validation schemas (zod) in
   `src/lib/validation/`.
3. **Tier 1 demo loop (parallel agents, gated by the Tier 1 e2e test)** —
   A. Volunteer: auth + onboarding, Explore (orgs + opportunities, smart filters), Organization
      page, Opportunity detail + signup/waitlist, Profile, Impact dashboard (E4), .ics (E2).
   B. Coordinator: org registration, Dashboard (opportunities + series CRUD, roster, kiosk mode,
      hours approval, attendance overrides, analytics), Report builders (volunteer + org).
   C. Help: Help Center + Q&A (BM25 fallback), onboarding tour, accessibility controls (E3),
      deterministic shift planner, legal pages.
   D. Backend Functions: registerOrganization, redeemInvite, completeProfile, signup,
      cancelSignup, issueKioskCode, checkIn, checkOut, finalizeShift (scheduled + callable),
      setAttendance (coordinator override), approveHours, issueLetter, revokeLetter,
      extendSeries (scheduled + callable), shiftPlannerParse/askAssistant (AI), resetDemoData
      (admin + DEMO_MODE), reports PDF, turnstileVerify, health. Firestore + Storage rules for the
      full matrix, rules tests, indexes, seed:demo (E1).
4. **Tier 2** — shift planner AI enhancement, reliability charts, collections, impact stories,
   public profiles/follow, saved items, command palette, notifications bell, cookie consent.
   **Tier 3** — SEO polish.
5. **Quality** — `tsc -b`, `vite build`, vitest (ported pure-logic tests + new unit tests),
   emulator rules tests, Functions tests, Playwright e2e (Tier 1 loop, keyboard-only path),
   axe checks, gitleaks in CI; fix errors; code review.
6. **Docs** — README (setup, features mapped to rubric, libraries + licenses, attributions,
   cited stats), `docs/RUBRIC_MAP.md`, `docs/DEMO.md`, help articles, `TODOS.md`.

## Known issues in old repo to fix during port
- Hardcoded Firebase config + Mapbox secret token in tracked files.
- 1,000–1,500-line files (firestore.ts, ExplorePage, BusinessDetailPage, AuthPage,
  DashboardPage, functions/index.ts) — split to <800 lines.
- Hardcoded admin uid in firestore.rules → Firebase custom claim `admin`, set by a script.
- Express endpoints in functions/index.ts served in-memory mock data (dead code) — drop.
- `@dataconnect/generated` local dependency (unused) — drop.

## Out of scope
- Final visual identity (new design doc), Firebase project creation (team action), mobile app.
  Deploy happens once the new project exists, before the first competition round.

<!-- autoplan-accepted:ceo -->
- Priority tiers and build order: Tier 1 (must ship) = scaffold, domain layer, auth/onboarding, org registration, opportunities + signup/waitlist, kiosk check-in/out + live roster, hours + approval, verified letters + /verify, reports, help center + Q&A, input validation, rules + rules tests. Tier 2 = shift planner AI enhancement, reliability charts, collections, impact stories feed, public profiles/follow, command palette. Tier 3 = SEO polish. Build the Tier 1 demo loop (signup -> kiosk check-in/out -> live roster -> hours -> letter) before secondary ported pages. Verify: Tier 1 e2e test passes before Tier 2 work merges.
- Reminders are ephemeral UI computed client-side from the user's confirmed signups (never stored); notifications/{uid}/items stays Function-write-only. Verify: rules test denies client create on notifications.
- Org registration runs in a `registerOrganization` callable Function that writes the org doc and the owner's members doc in one transaction. Verify: rules test denies client create of organizations and members; Function test creates both.
- users/{uid} (public) holds only allowlisted public fields (displayName as first name + last initial for under-18, avatarUrl, badges, totalApprovedHours, orgsHelpedCount, bio for 18+, streakWeeks); all other fields live in users/{uid}/private. Rules reject any key outside the allowlist and reject adult-only fields when private.isMinor is true. Verify: rules tests for allowed, extra-field, and minor cases.
- The signup Function copies a contact snapshot (fullName, email, phone if given) into the signup doc, readable only by the volunteer and that org's coordinators. Verify: rules test that another volunteer cannot read it.
- Birth date is set once by a `completeProfile` Function that enforces age >= 13 and derives isMinor; birthDate is immutable to clients afterwards (admin-only correction). Verify: rules test denies client update of birthDate; Function test rejects age 12.
- Waitlist promotions within 24 h of start are auto-excused from reliability if the promoted volunteer does not attend (status `excused`, excuseReason `late-promotion`). Verify: unit test on reliability calculation.
- Check-out is a separate explicit action (`checkOut` Function and its own button), accepted from 15 minutes after check-in until scheduled end + 30 minutes; outside that window it returns a clear error. Verify: Function tests for early, valid, and late check-out.
- Rules matrix is extended to every persisted collection: invites (owner read/create via Function, redeem via Function), series (public read, coordinator write), instance secrets in `instanceSecrets/{id}` (no client access), impactStories (public read, signed-in create, author update/delete, admin delete), follows (public read, self create/delete), savedItems under users/{uid}/saved (self only), collections (public read if published, owner write), reports metadata (owner only). Verify: rules tests cover every row including denied cases.
- AI Function callers: shift planner requires org coordinator membership; Q&A requires a signed-in user. Per-user limit 20 calls/hour and 100/day stored in `aiUsage/{uid}`, input max 2,000 chars, output max 1,024 tokens. App Check enforced on the deployed demo. Team sets a Blaze budget alert at $5. Verify: Function tests for unauthorized, over-limit, and oversized input.
- Whole-series signup covers the current 8-week materialized window only, and a scheduled Function extends instances weekly. Verify: unit test of materialization window.
- Constraint wording: no init or deploy until the new project exists; deploy before the first competition round. Verify: doc text.
- Full status set: confirmed, waitlisted, checked-in, completed, no-show, excused, cancelled (with lateCancel boolean). Transitions: waitlisted->confirmed, confirmed->checked-in->completed, confirmed->no-show->excused, confirmed|waitlisted->cancelled. Verify: state-machine unit test rejects all other transitions.
- Reliability excludes excused, early-cancelled, and promotion-excused signups from both the 20-signup window and the formula. Verify: unit tests.
- A full waitlist rejects signup with "This shift and its waitlist are full." Remaining waitlisted signups are cancelled (not counted) at shift start with a notification. Verify: Function tests.
- Letters can be revoked by the org owner or an admin via a `revokeLetter` Function with a required reason. Verify: Function test.
- Billing owner is a team adult (adviser or parent); LAN emulator fallback rehearsed. Verify: DEMO.md checklist.
- Scaffold includes Tailwind 3 + shadcn components.json; tailwind.config maps colors/fonts/radii to CSS variables in src/styles/tokens.css. Verify: build passes and changing one token changes React Bits components.
- Onboarding collects birth date (stored privately) instead of an age band. Verify: onboarding form test.
- Kiosk code relay limitation documented; coordinator's live arrivals list supports spot checks. Verify: DEMO.md + help article.
- Reviews carry signupId; rules check that signup belongs to the author, is completed, and its instance's orgId matches. Verify: rules tests.
- Changing an org's name or EIN resets verified to false; orgs with signups, hours, or letters can only be archived, not deleted. Verify: rules tests.
- Cite sources for the 1-in-4 no-show and 30% churn stats in README/presentation notes and quote the guidelines line "no more than three personal devices". Verify: README text.
- Local/emulator runs use Cloudflare's published Turnstile test keys. Verify: .env.example and emulator test.
- Repo license is MIT; README notes React Bits source is MIT + Commons Clause (no selling the components) and is attributed in README and file headers. Verify: LICENSE + README.
- E1 demo dataset: `npm run seed:demo` seeds the emulator, and an admin-only "Reset demo data" button reseeds. Verify: seed test + manual run.
- E2 .ics export for confirmed shifts. Verify: unit test on .ics output.
- E3 accessibility controls (text size, high contrast, keyboard path through signup and kiosk). Verify: Playwright keyboard-only test + axe check.
- E4 milestone celebration + badge card at 25/50/100 approved hours. Verify: unit test on milestone thresholds.
- Baseline edits (recorded above): stack line updated to Blaze + callable Functions + Tailwind/React Bits; onboarding collects birth date; signup status set updated; scaffold uses Tailwind + components.json + tokens.css; out-of-scope line clarifies deploy timing. Verify: Implementation plan text.
- Concern map (design doc R2-x to obligation): R2-1 reminders; R2-2 registerOrganization; R2-3 public/private split; R2-4 contact snapshot; R2-5 birth date; R2-6 late-promotion excuse; R2-7 check-out window; R2-8 rules matrix; R2-9 AI limits; R2-10 series window; R2-11 constraint wording; R2-12 status set; R2-13 reliability exclusions; R2-14 full waitlist; R2-15 revocation; R2-16 billing owner; R2-17 Tailwind tokens; R2-18 onboarding birth date; R2-19 kiosk relay; R2-20 reviews signupId; R2-21 org verify reset/archive; R2-22 priority tiers; R2-23 cited stats; R2-24 design-doc wording only (no code); R2-25 Turnstile test keys; R2-26 license. Verify: each maps to one bullet in this block.
- Shift finalization: finalizeShift runs at scheduled end + 30 min (scheduled; also callable by coordinators and tests). It sets confirmed to no-show (or excused with excuseReason late-promotion when promoted within 24 h), and checked-in without check-out to completed with hours capped at the scheduled end and the HoursLog flagged needsReview. Verify: Function tests for each branch.
- Hours lifecycle: checkOut and finalizeShift create one HoursLog per signup with minutes = min(actual, scheduled + 30), rounded to 15 min. Kiosk-verified logs are auto-approved; needsReview and volunteer-submitted manual logs start pending and need coordinator approval via approveHours. Only approved logs feed totalApprovedHours, badges, reports, and letters. Verify: Function tests + aggregation unit test.
- Coordinator attendance override: setAttendance lets an org coordinator set no-show to completed (with hours) or completed to no-show, with a required note and audit fields (by, at). Verify: Function test + rules deny for non-coordinators.
- Server-owned stats: totalApprovedHours, orgsHelpedCount, badges, and reliability on users/{uid} are written only by Functions; rules deny client writes to those keys. Verify: rules test.
- Rules matrix additions: aiUsage/{uid} (no client access); letterVerifications/{code} (public get by exact id only, list denied, holds only the minimal public projection, written by issueLetter/revokeLetter and the supersede trigger); letters/{id} full record (volunteer and issuing-org coordinators read, Function write only). Kiosk codes are never stored; issueKioskCode derives them from instanceSecrets. Verify: rules tests.
- Kiosk code issuance: issueKioskCode (coordinator of the instance's org only) returns the current 6-digit HMAC code and seconds remaining. Verify: Function test for non-coordinator denial and code rotation.
- Letter statuses: valid, superseded, revoked. /verify shows a valid state, a superseded state with the newer letter's issue date, and a revoked state with the reason category. Verify: component tests for all three.
- Waitlist cutoff: at start minus 2 h, remaining waitlisted signups are cancelled (not counted against reliability) with a notification; no promotion happens after that point. This replaces the earlier "cancelled at shift start" wording. Verify: Function test.
- Late cancel threshold: cancellations less than 24 h before start set lateCancel = true; earlier ones are early cancels and are excluded from reliability. Verify: unit test.
- Under-13 path: completeProfile rejects with "You must be 13 or older to use this app" and deletes the just-created Auth user; the onboarding form validates the date client-side first. Verify: Function test + form test.
- displayName is derived by completeProfile and other Functions (first name + last initial when isMinor) and is never client-written. Verify: rules test.
- Reports metadata owner is the creating user. Verify: rules test.
- E1 reset safety: resetDemoData is a callable Function requiring the admin claim AND env DEMO_MODE=true; it refuses otherwise. Verify: Function tests for both refusals.
- E2 .ics: per-shift download (no subscribed feed), TZID America/Chicago with VTIMEZONE, stable UID = signupId@app, cancelled signups export METHOD:CANCEL. Verify: unit test on output.
- E3 storage and scope: text-size and contrast preferences stored in localStorage, copied to users/{uid}/private when signed in; tokens.css defines a [data-contrast=high] token set; axe reports zero serious/critical issues on Explore, Opportunity, Dashboard, Kiosk, and Verify. Verify: Playwright + axe.
- React Bits vendoring: each installed component is edited to use token-mapped Tailwind classes (no hardcoded hex) before use. Verify: CI grep check fails on hex colors in src/components/bits.
- Whole-series signup does not auto-extend into newly materialized weeks; the volunteer sees a "Series signup covers through DATE" note and a one-click extend action. Verify: unit test.
- Tier assignment: Tier 1 also includes E1, E2, E3, E4, the deterministic shift planner, reliability score, admin claim, and recurring series. Tier 2 also includes the notifications bell, saved items, and cookie consent. Verify: Phases section.
- Cited sources: VolunteerHub "Volunteer No-Shows" (about 1 in 4) and Zeffy volunteer retention guide (about 30%), plus the FBLA guideline quote. Verify: README links.
- PWA is removed from Tier 3 (not approved). Verify: plan text.
- Baseline edits (second batch): Phase 3 rewritten as a tiered build with the full Functions list; Quality and Docs phases extended (DEMO.md, TODOS.md, rules/Function/e2e/axe tests, gitleaks); admin uid line uses the custom claim. Verify: Implementation plan text.
- Check-in window: checkIn is accepted from start minus 30 min until scheduled end; otherwise it returns "Check-in for this shift is not open right now." Both checkIn and checkOut require the current kiosk code. Kiosk codes rotate every 30 s; the current and previous window are accepted. Verify: Function tests for early, valid, late, and stale-code cases.
- Complete Function and trigger ownership (Tier 1 unless noted): createInvite (owner); redeemInvite; supersedeLetters (Firestore trigger on hoursLogs writes); runDueJobs (scheduled every 5 min, also admin-callable) which idempotently runs waitlist cutoff, finalizeShift, and extendSeries for due instances; recomputeVolunteerStats (trigger on hoursLogs/signups writes) owns totalApprovedHours, orgsHelpedCount, badges, streak, and reliability; extendSeriesSignup (volunteer callable); submitManualHours (volunteer callable, creates pending log); createInstance/updateInstance (coordinator callables that also create instanceSecrets, so clients never write instances directly). Verify: each has a Function test; Phase 3 D list matches.
- Rules rows added: opportunities/series/instances (public read; writes only via coordinator Functions); hoursLogs (volunteer and org coordinators read; Function write only); users/{uid}/lists (owner read/write; public read when published); reviews coordinator response (org coordinator may update only the response field). Verify: rules tests incl. denied cases.
- users/{uid}/private client writes are limited to allowlisted preference keys (textSize, contrast, notificationPrefs, milestonesSeen); birthDate, isMinor, fullName, and reliability are Function-only. Verify: rules test denies client write of isMinor.
- Reliability lives in users/{uid}/private (visible to the volunteer) and is copied into each signup's contact snapshot for that org's coordinators; it is never public. This replaces the earlier "reliability on users/{uid}" wording. Verify: rules test + Function test.
- Signup enforces opportunity minAge against the volunteer's private birth date ("You must be at least N to join this shift."). Verify: Function test.
- Coordinator shift changes: cancelling a shift cancels all signups with cancelReason org-cancelled (excluded from reliability), notifies volunteers, and .ics exports METHOD:CANCEL with STATUS:CANCELLED and SEQUENCE+1. Reducing capacity below signupCount is rejected ("Remove volunteers first"). Editing time after signups exists bumps SEQUENCE, notifies volunteers, and recomputes cutoff/finalize times. Verify: Function tests.
- Letters: issueLetter is volunteer-callable with scope (orgId or all orgs, date range). A newer letter with the same volunteer + scope supersedes the older one; supersedeLetters also marks letters superseded when a counted log changes. Verify: Function tests.
- R2-24 bullet: the design doc's coaching section wording ("took all four add-ons") is a doc-only fix with no code. Verify: design doc text.
- TODOS.md contains the three CEO deferrals: coordinator CSV roster import, Spanish UI, training/certification prerequisites. Verify: file contents.
- State machine (supersedes the earlier transition list): waitlisted->confirmed (signup/cancel Functions), waitlisted->cancelled (volunteer, runDueJobs cutoff), confirmed->cancelled (volunteer, org cancel), confirmed->checked-in (checkIn), checked-in->completed (checkOut, finalizeShift), confirmed->no-show (finalizeShift), confirmed->excused (finalizeShift late-promotion), no-show->excused (coordinator), no-show->completed and completed->no-show (setAttendance, coordinator). All others rejected. Verify: state-machine unit test enumerating allowed and rejected pairs with actors.
- System cancellations (cancelReason waitlist-cutoff or org-cancelled) keep lateCancel = false and are excluded from reliability. Verify: unit test.
- Tier 1 notification surface: a minimal in-app notifications list on Profile plus a header badge count (Tier 1); the richer bell menu with AnimatedList stays Tier 2. Verify: e2e test sees a promotion notification.
- shiftPlannerParse (AI) is Tier 2; Tier 1 ships the deterministic parser client-side plus askAssistant. Verify: Phase list.
- Letter revocation reason is an enum (issued-in-error, hours-disputed, duplicate, other) plus an optional private note; /verify shows the enum label only. Verify: Function + component test.
- Hours formula (supersedes earlier wording): minutes = min(checkOutAt, scheduledEnd + 30 min) minus max(checkInAt, scheduledStart minus 30 min), floored at 0, rounded to the nearest 15 min. For finalizeShift auto-completion, checkOutAt = scheduledEnd. Verify: table-driven unit test.
- Reliability formula (restated): over the volunteer's last 20 finished signups excluding excused, early-cancelled, and system-cancelled ones, reliability = attended / (attended + noShows + 0.5 x lateCancels); under 3 finished signups shows "New volunteer" and ranking uses 0.8. Verify: unit tests.
- Org verification: only an admin (custom claim) sets verified = true via a verifyOrganization Function on an admin page; rules require verified == false on any non-admin update that changes name or EIN. Verify: rules + Function tests.
- E4 and streaks: milestones seen are stored in users/{uid}/private.milestonesSeen so each celebration shows once; streak = consecutive weeks with at least one approved hours log, computed by recomputeVolunteerStats. Verify: unit tests.
- E2 cancel: cancelled signups keep a "Download cancellation" link that exports METHOD:CANCEL, STATUS:CANCELLED, SEQUENCE+1. Verify: unit test.
- Emulator scheduling: scheduled triggers do not fire on the emulator, so DEMO.md and the admin page include a "Run due jobs now" action that calls runDueJobs; the LAN fallback rehearsal uses it. Verify: DEMO.md + Function test.
- Tailwind 4 (supersedes Tailwind 3 wording): use Tailwind CSS v4 with `@theme` variables defined from src/styles/tokens.css, matching the shadcn/React Bits registry. Verify: build passes and a token change restyles a vendored React Bits component.
- health Function is kept from Trove (used by DEMO.md pre-flight check). Verify: Function test.
- Authoritative Phase 3 D Functions list (supersedes the D list in Phases): registerOrganization, verifyOrganization (admin), createInvite, redeemInvite, completeProfile, updateProfile, upsertOpportunity, upsertSeries, createInstance, updateInstance, cancelInstance, signup, cancelSignup, extendSeriesSignup, issueKioskCode, checkIn, checkOut, finalizeShift (callable), setAttendance, approveHours, rejectHours, submitManualHours, issueLetter, revokeLetter, supersedeLetters (trigger), recomputeVolunteerStats (trigger), runDueJobs (the ONLY scheduled Function, every 5 min, also admin-callable; it calls the cutoff, finalizeShift, and extendSeries handlers), extendSeries (callable), rankVolunteers, markNotificationsRead, askAssistant (Tier 1), shiftPlannerParse (Tier 2), resetDemoData, reports PDF, turnstileVerify, health. Verify: Functions index exports exactly this list; one test file per Function.
- Series and opportunity writes go only through upsertOpportunity/upsertSeries/createInstance/updateInstance/cancelInstance (supersedes "series coordinator write" in the earlier rules bullet); rules deny all client writes to opportunities, series, and instances. Verify: rules tests.
- Profile fields: interests, skills, availability, phone, and fullName live in users/{uid}/private and are written by completeProfile and updateProfile (validated with zod: interests from the CauseArea enum, skills max 20 items of 40 chars, availability as weekday + time-block flags, phone E.164). Verify: Function tests for valid and invalid input.
- Streak is stored on the public users/{uid} doc as streakWeeks (added to the public allowlist) and written only by recomputeVolunteerStats. Verify: rules test denies client write.
- isMinor is recomputed by recomputeVolunteerStats and by runDueJobs daily, so it flips on the 18th birthday. Verify: unit test with a birthday boundary.
- Signup window: signup and confirmed booking are allowed until the 2 h cutoff; after the cutoff, signup is allowed only if seats remain (walk-up) until start; never after start. Whole-series signup confirms where seats exist, waitlists where the waitlist has room, and skips full ones, then reports a per-date summary. Verify: Function tests.
- setAttendance covers no-show to excused, no-show to completed (creates an approved HoursLog with coordinator-entered minutes), and completed to no-show (marks the HoursLog rejected, which triggers supersedeLetters). Verify: Function tests.
- approveHours and rejectHours (reason required) are coordinator-only; rejected logs never count. Verify: Function tests.
- Unverified orgs can publish shifts (marked "Unverified" in UI), but their hours are excluded from letters and /verify shows only hours from verified orgs. Verify: Function test for issueLetter excluding unverified-org hours.
- Notifications read state: markNotificationsRead (owner callable) sets read = true; clients never write notifications directly. Verify: Function test + rules deny.
- Late cancels by waitlisted volunteers do not count toward reliability (only confirmed signups can be late-cancelled). Verify: unit test.
- checkIn/checkOut attempts are limited to 10 per user per 10 minutes; excess returns "Too many attempts, wait a minute." Verify: Function test.
- Org cancellation transitions (supersede the state machine actors): waitlisted->cancelled and confirmed->cancelled include actor cancelInstance; checked-in->completed includes cancelInstance mid-shift (hours to the cancel time, needsReview). Verify: state-machine test.
- finalizeShift and extendSeries are callable handlers only; runDueJobs is the only scheduler (supersedes "scheduled + callable" wording). Verify: Functions index.
- All-orgs letters: "issuing-org coordinators" means coordinators of every org whose hours the letter counts; any of those orgs' owners or an admin may revoke. Same scope means exact match of orgId (or ALL) and date range; overlapping different ranges are separate letters. Verify: Function tests.
- Contact snapshots on open (future) signups are refreshed by recomputeVolunteerStats; past signups keep their snapshot frozen. Verify: Function test.
- Org archive rule: recomputeVolunteerStats and the signup/letter Functions maintain organizations/{id}.hasActivity = true; rules deny delete when hasActivity is true and allow setting archived = true instead. Verify: rules tests.
- Emulator config: Phase 1 hand-writes firebase.json with emulator ports (auth 9099, firestore 8080, functions 5001, storage 9199, ui 4000), rules/index paths, and functions source, with no .firebaserc; scripts pass --project demo-fbla2027. Verify: npm run emulators starts.
- Kiosk lock: the kiosk route hides the app shell and nav, intercepts browser back with a confirm, and exits only through re-authentication. Verify: e2e test.
- Signed-out Help: BM25 article search only; the "Ask" box prompts sign-in. Verify: component test.
- Reviews use doc id = signupId, so there is one review per signup. Verify: rules test denies a second create.
- Ranking: rankVolunteers (coordinator callable, Tier 1) ranks the coordinator's org's past volunteers plus volunteers who opted into discovery (notificationPrefs.discoverable) using match score + reliability server-side and returns display names only; the client-side deterministic parser only drafts the opportunity. Volunteers' own "recommended shifts" are ranked client-side from their private profile (no reliability needed). Verify: Function test.
- .ics cancellation is best-effort: documented in DEMO.md and the help article as not reliably applied by Google Calendar imports; the UI tells users to delete the event if their calendar does not. Verify: help article text.
- CEO summary Reviewer Concerns updated with the round-3 findings and their resolution bullets. Verify: CEO summary text.
- Consolidated spec: before Phase 3 starts, write docs/SPEC.md as one contradiction-free spec (no "supersedes" lines), with an appendix mapping R2-x concerns and CEO/spec-review batches to sections. Plan bullets marked "supersedes" are resolved in SPEC.md in favor of the later bullet. Verify: grep finds no "supersedes" in docs/SPEC.md; Eng review reads SPEC.md.
- Shared domain module: a repo-root shared/ TypeScript folder holds zod schemas, the state machine, hours/reliability/ics math, and an injectable clock; both the client and Functions import it. Verify: no duplicate schema definitions (grep) and unit tests live in shared/.
- Competitor positioning: README/RUBRIC_MAP include a table vs SignUpGenius, VolunteerHub, Galaxy Digital, and paper logs, plus a rehearsed 20-second "why not SignUpGenius" answer in DEMO.md. Verify: doc text.
- Human explainers: DEMO.md assigns each Tier 1 Function and the kiosk HMAC, waitlist transaction, and letter verification to a named team member who can explain it. Verify: DEMO.md table.
- T1 kiosk QR: the kiosk shows a QR encoding the same rotating HMAC code (plus instanceId) next to the typed code; the volunteer phone scans it with the in-app scanner; typed entry stays as fallback. Verify: e2e test using the typed path; component test renders QR.
- T2 promotion release: the promotion notification has a one-tap "Can't make it" that cancels without lateCancel and promotes the next person if before cutoff. Verify: Function test.
- T3 reliability guardrails: coordinator-only, shown with its inputs, records older than 12 months dropped, never used to block signup, and volunteers can request review. Verify: unit + rules tests.
- T4 org trust: coordinators of unverified orgs see display names only (no contact snapshot) for minors until verified. Verify: Function test on signup snapshot.
- T5 Tier 0: inside Tier 1, build order starts with the demo loop only (signup/waitlist, kiosk code/QR, check-in/out, finalizeShift, hours, issueLetter + /verify, one report, Q&A with BM25) and its rules; the rest of Tier 1 follows. Build order only, no cuts. Verify: Tier 0 e2e passes first.
- Indexes: signups(instanceId,status), hoursLogs(uid,status,date), instances(orgId,start), letters(uid,issuedAt) in firestore.indexes.json. Verify: emulator queries succeed without index errors.
- Observability: Functions log structured JSON {fn, uid, instanceId, outcome, ms, requestId}; jobRuns collection (admin read) shows runDueJobs history; client error toasts show requestId; shared toUserError maps HttpsError codes. Verify: unit test on toUserError + log shape test.
- Feature flags AI_ENABLED and DEMO_MODE via Functions env; deploy order rules+indexes, Functions, Hosting; post-deploy smoke checklist in DEMO.md. Verify: DEMO.md.
<!-- /autoplan-accepted:ceo -->

<!-- autoplan-accepted:design -->
- D1 Screens: docs/SPEC.md gains a Screens section; each Tier 0/1 screen lists its job, above-the-fold content in order, one primary action, and secondary content. Leads: Explore = promotion/upcoming banner, Recommended (one-line why), search + filters, orgs; Opportunity = date/time/place/seats, signup button, description, org; Coordinator Dashboard = Today/next shift with Start kiosk, Needs attention, upcoming, analytics. Phase 3 is gated on this section. Verify: SPEC.md review checklist.
- D2 Navigation shell: volunteer bottom tab bar on mobile (Explore, My Shifts, Impact, Help) and top nav on desktop; coordinator routes under /org/:orgId/* with an org switcher shown only when the user has a membership; admin under /admin gated by claim; kiosk at /org/:orgId/kiosk/:instanceId. Verify: e2e navigation test per role.
- D3 /verify hierarchy: status band first (valid/superseded/revoked with icon + text, never color alone), then display name, total verified hours, date range, orgs, then issue date + code, then "What this means". Verify: component test for all three states.
- D4 Kiosk + phone check-in states: SPEC.md state tables. Kiosk: loading code, 30 s countdown ring, code change announced, offline = dim code + "Reconnecting, codes paused" (never shows an expired code as live), denied, shift not open/ended, empty roster "No arrivals yet", arrival animation, row styles for checked-in/checked-out/no-show/walk-up. Phone: camera denied -> typed entry, QR unreadable, success "Checked in at 9:02, check-out opens 9:17", every Function error string, disabled check-out with available-at time. Verify: e2e for offline, stale code, camera denied.
- D5 Signup button state matrix: Sign up; Join waitlist (#N); Full (disabled); Ages N+ (disabled with reason); Signed up (Cancel, Add to calendar); Waitlisted #N of M; Shift started (disabled); Cancelled by organization. Waitlist position is shown. Whole-series result is a date list with confirmed/waitlisted/skipped chips. No optimistic UI for trusted writes: the button shows pending until the Function returns. Verify: component test per state.
- D6 Empty states, each with one line + one action: Impact at 0 hours shows progress to the first milestone (0/25) not zeros; My Shifts empty -> Find shifts; org with no opportunities; Coordinator Dashboard after registration -> Create your first shift; no pending hours; no notifications; filtered Explore empty -> Clear filters; recommendations with no interests -> Add interests; help search no results -> Ask (signed in) or Sign in; map unavailable -> list only. Verify: component tests.
- D7 Assistant panel: one panel, each answer labeled "From Help Center" or "AI answer, may be wrong"; over-limit copy "You've reached today's assistant limit; here are matching help articles."; character counter at 2,000; signed-out shows article results + Sign in to ask. Verify: component test.
- D8 Letter flow: preview then issue; inline "Hours excluded: N from unverified orgs"; generating/failed (retry)/ready states; one-page PDF layout (header, volunteer, table of orgs and hours, verify URL + QR, issue date) sketched in SPEC.md. Verify: Function + component tests.
- D9 Needs attention queue: one list on the coordinator Dashboard grouped by shift for needsReview logs, pending manual logs, and attendance disputes; approve/reject inline; reject opens a required reason; bulk approve for kiosk-verified rows. Verify: e2e.
- D10 Onboarding: birth date first (under-13 never creates an account where possible) with kind copy pointing to a parent or guardian; skills and availability skippable; progress indicator; ends on "3 shifts that match you". Verify: e2e.
- D11 Demo arc: after checkOut the phone shows "N hours logged at ORG", animated milestone progress, primary CTA "Get verified letter"; "Run due jobs" appears only when DEMO_MODE is on, labeled as a demo control. DEMO.md scripts the arc screen by screen. Verify: e2e + DEMO.md.
- D12 Reliability display: neutral text "Attended 8 of 10 recent shifts", never a colored score badge; "New volunteer" tag; volunteer view titled "Your track record" with Request review; never shown in discovery, public profiles, or kiosk. Verify: component test.
- D13 Promotion visibility: promoted/upcoming signups appear as a banner on Explore ("You're in! Saturday 9 AM: Confirm / Can't make it"); the header badge opens the notification list directly; help text states alerts are in-app only. Verify: e2e.
- D14 Semantic status tokens (interim, neutral; TD1): success = verified/completed, warning = waitlisted/needsReview, danger = revoked/no-show, neutral = cancelled/excused; every status also has an icon + text label. Verify: grep test that status components use status tokens.
- D15 React Bits placement: AnimatedList only for live roster arrivals and notifications; CountUp only for the Impact total and milestone moment (not on every revisit); SpotlightCard only for recommended shift cards; FadeContent only for route transitions. Verify: grep test on component usage locations.
- D16 Report themes: 4-6 preset accent themes from tokens, contrast-checked; no free hex input (replaces Trove ColorPicker). Verify: unit test that every preset passes 4.5:1.
- D17 Shift planner UI: text box with example placeholder; parse fills the structured form inline with parsed fields highlighted and editable; ranked volunteers in a side panel with "why" chips; display names only. Verify: component test.
- D18 Reduced motion: motion tokens with zero durations under prefers-reduced-motion and an in-app toggle stored with E3 preferences; static milestone variant. Verify: Playwright with reducedMotion: reduce.
- D19 Breakpoints: volunteer screens mobile-first at 375px; coordinator desktop-first and responsive (tables become stacked rows under 768px); kiosk landscape at 1024px+ with the code at least 120px tall. Verify: Playwright screenshots at 375/768/1440.
- D20 Accessibility contract: 44x44px minimum touch targets; visible focus states themed from tokens; focus restored after modals, signup submit, scanner failure, and route changes; aria-live announcements for kiosk code changes, waitlist promotion, form errors, roster arrivals, and toasts; status never by color alone; plain, age-appropriate copy. Verify: Playwright keyboard path + axe + aria-live assertions.
- D21 Text scale: 100/125/150% via a root font-size token; Tier 0 screens tested at 150% + high contrast without overflow. Verify: Playwright.
- D22 Error presentation: toUserError returns friendly copy plus a collapsed "Details" with a copyable requestId; expanded by default for coordinators/admins. Verify: component test.
- D23 Unverified org UI: "Unverified" chip with tooltip ("Hours here won't appear on verified letters until this organization is verified") on org and opportunity pages before signup; coordinator roster shows "Contact hidden until your organization is verified" for minors. Verify: component tests.
- D24 Time display: all shift times in the org time zone with a zone label; the signup confirmation and phone check-in screen show "Check-in opens H:MM". Verify: unit test on formatter.
- TD1 interim visual direction: neutral token set only (no named brand direction) pending the team's design doc. TD2 mockups skipped for the same reason. Verify: tokens.css contains no brand palette beyond one accent.
<!-- /autoplan-accepted:design -->

<!-- autoplan-accepted:dx -->
- X1 One-command demo: `npm run demo` (via firebase emulators:exec + concurrently) starts emulators, seeds demo data with a shift starting 10 minutes from now, starts Vite on --host, and prints coordinator/kiosk/volunteer links, the demo credentials table, and the LAN URL as a terminal QR. README quickstart is exactly: prerequisites, `npm ci`, `copy .env.example .env.local`, `npm run demo`. Verify: CI times clone-to-ready under 5 minutes after prerequisites.
- X2 Prerequisites pinned: .nvmrc and package.json engines (Node 22, matching the Functions runtime); firebase-tools as a devDependency used via npx (no global install); README lists JDK 21+ for emulators. Verify: doctor checks versions.
- X3 Doctor: `npm run doctor` checks Node version, Java present, ports 9099/8080/5001/9199/4000/5173 free, .env.local present and valid, workspace deps installed, repo not inside a synced OneDrive folder (warn); each failure prints problem, cause, fix. Verify: unit tests on each check.
- X4 Zero-edit env: .env.example ships emulator-safe defaults (VITE_FIREBASE_PROJECT_ID=demo-fbla2027 with dummy apiKey/appId, VITE_USE_EMULATORS=true, Turnstile test keys); Mapbox and AI keys optional and blank; firebase.ts validates env with zod and fails naming the missing variable and pointing to .env.example. Verify: unit test on env validation.
- X5 Demo accounts: seed creates admin, owner/coordinator, adult volunteer, minor volunteer with fixed demo passwords, sets the admin custom claim, and prints them; DEMO_MODE-only "Sign in as..." role switcher on the login screen. Verify: e2e logs in as each role.
- X6 Workspaces + bundled Functions: npm workspaces (root, functions, shared); functions build bundles shared/ with esbuild into functions/lib/index.js so deploy never imports ../shared; CI runs the functions build and an emulators:exec smoke test against the bundle. Verify: CI job.
- X7 Canonical scripts: dev, demo, demo:reset, emulators, seed:demo, doctor, typecheck, lint, test, test:rules, test:functions, test:e2e, check:tokens, check:functions-index, check:spec, verify (runs all; CI calls verify), deploy. All scripts cross-platform (cross-env, rimraf or node scripts; no rm -rf or inline VAR=x). Verify: CI runs on windows-latest and ubuntu-latest.
- X8 defineCallable wrapper: functions/src/lib/defineCallable({name, input: zod schema, auth: signedIn | coordinator(orgId) | admin, rateLimit?, handler}) centralizes auth, validation, rate limits, structured logs, and error mapping; docs include an "Add a new Function" recipe (schema in shared, handler, export, rules row, test). Verify: check:functions-index asserts every export uses the wrapper and matches the authoritative list and the typed client map in src/lib/api.ts.
- X9 Error catalog: shared/errors.ts holds {code, httpsCode, message(params), fix, helpSlug}; Functions throw by code; toUserError maps code to copy + help link; messages carry params (opensAt, retryAfterSec, excess). Verify: unit test that every entry has a message, a fix, and a helpSlug or explicit null.
- X10 Developer failure UX: in dev, firebase.ts probes emulator reachability and shows a banner ("Emulators not reachable on :8080, run npm run demo"); Functions log one clear line when AI_ENABLED is true but the secret is missing, then fall back. docs/DEMO.md has a troubleshooting table (symptom, cause, diagnostic command, fix, when to run demo:reset) covering ports, Java, missing claim, rules denial, missing index, scheduler not running, LAN unreachable/firewall, wrong env keys. Verify: doc review + banner component test.
- X11 App Check in dev/e2e: debug provider via FIREBASE_APPCHECK_DEBUG_TOKEN in dev and Playwright; DEMO.md step registers debug tokens for the 3 demo devices; APPCHECK_ENFORCE and TURNSTILE_ENABLED flags with documented LAN-fallback values. Verify: e2e runs with debug provider.
- X12 Demo clock: DEMO_MODE-only server clock offset (demoClock/global, admin-set) read by shared/clock.ts; admin page "Advance clock 15 min"; seed supports --shift-starts-in. e2e uses the same hook. Verify: e2e walks check-in then check-out via clock advance.
- X13 Config in one place: shared/config.ts holds limits (AI 20/hr 100/day, check-in 10 per 10 min, 2,000 chars, 1,024 tokens, 30 s rotation, 8-week window) with Functions env overrides; DEMO_MODE "Reset rate limits" control. Verify: unit test reads overrides.
- X14 Org time zone: organizations.timeZone (default America/Chicago) used by .ics TZID and all display formatting (supersedes the hardcoded TZID wording). Verify: unit test with a non-Chicago org.
- X15 Kiosk session expiry: a "Kiosk session expired, coordinator sign-in" screen returns to the same instance after re-auth. Verify: e2e with forced token expiry.
- X16 Docs early: Phase 1 ships README quickstart, docs/ARCHITECTURE.md (folder map, one trusted write end to end, tokens, how to add a Function/screen/rules row), and .env.example comments; SPEC.md gets a table of contents, stable anchors (#fn-signup, #rules-signups), and API (callable inputs/outputs/errors/auth/idempotency) and Data Model sections; code comments and tests reference anchors. Help articles live in src/content/help/*.md with slug/tags front matter and are indexed for BM25 at build time. Verify: check:spec and doc review.
- X17 Deploy runbook: DEMO.md "First deploy" and "Competition day" sections with copy-paste commands (project creation, firebase use --add, functions:secrets:set ANTHROPIC_API_KEY, admin-claim script, App Check registration, deploy order, rollback via hosting:rollback and previous Functions commit), rehearsed once before Round 1 with a named owner. Verify: rehearsal log entry in DEMO.md.
- X18 Upgrade policy: lockfile committed; Dependabot weekly for npm and GitHub Actions; React Bits vendored components record their source URL and date in a file header; Tailwind 4 is the only Tailwind version (check:spec greps for "Tailwind 3"); seed data carries a schemaVersion and demo:reset rebuilds it. Verify: CI + check:spec.
- X19 DX measurement: CI records the duration of `npm run demo` readiness on a clean runner and fails over 5 minutes; DEMO.md keeps a rehearsal log (date, devices, issues). Verify: CI job output.
- X20 License and contributing: MIT LICENSE and a short CONTRIBUTING.md (branching, verify before push, how to add a Function). Verify: files exist.
- TD3 no-emulator mock mode declined for now (recorded in NOT in scope).
<!-- /autoplan-accepted:dx -->

<!-- autoplan-accepted:eng -->
- G1 Stats trigger bounded (A1, critical): recomputeVolunteerStats triggers only on hoursLogs writes and on signups writes whose status changed (before/after compare); it writes users docs and refreshes open-signup contact snapshots only when a field value actually differs; snapshot refresh is limited to signups starting within the 8-week window. Verify: emulator test that one signup write causes a bounded number of Function executions and no self-retrigger.
- G2 Resource-derived authorization (A2, critical, IDOR): defineCallable auth resolvers load the target resource (instance, signup, hoursLog, letter, org) and derive orgId from it; orgId is never accepted as a free input when a resource id exists; every coordinator operation has a cross-org denial test. Rules do not bind Admin-SDK Functions, so each operation enforces its own authorization, idempotency, schema, allowed transitions, and audit event, listed in a per-operation table in docs/SPEC.md. Verify: cross-org denial tests + SPEC table review.
- G3 Deploy artifact (A3): the predeploy step emits a standalone functions deploy directory (bundled lib/index.js, package.json with runtime deps only and no shared/workspace entry, its own lockfile); CI runs npm ci in a clean copy of that directory; one real `firebase deploy --only functions` rehearsal happens as soon as the team's Blaze project exists, not on first-deploy day. Verify: CI job + rehearsal log in DEMO.md.
- G4 Domain-grouped callables (A4, taste TE1): operations are grouped into five callable endpoints (volunteer, coordinator, kiosk, admin, ai), each dispatching on an `op` field through defineCallable, with one handler file and one test per operation; kiosk endpoint gets minInstances 1 on competition day only; check:functions-index checks the operation list. Triggers (supersedeLetters, recomputeVolunteerStats) and the runDueJobs scheduler stay separate exports. Verify: functions index test.
- G5 Tier re-sequencing (A6 + Codex 3, taste TE2; no features cut): Tier 0 = seeded users, one shift instance, typed kiosk code check-in/out, finalizeShift, auto-approved hours, one letter template + /verify, BM25 help, and the rules for those collections. Tier 1 adds waitlist, QR scanning, reports, onboarding/Explore polish, E1-E4. Recurring series, rankVolunteers, and shiftPlannerParse move to Tier 2. Nothing outside Tier 0 starts until the Tier 0 e2e passes. Verify: Tier 0 e2e gate in CI.
- G6 Single clock (E1): Functions write explicit clock.now() timestamps (never FieldValue.serverTimestamp, enforced by a lint rule in functions/src); kiosk code windows, check-in/out windows, finalizeShift, runDueJobs, and age checks all read shared/clock.ts; the demo clock offset can only be non-zero when DEMO_MODE is true and the project id starts with "demo-" or a DEMO_MODE env flag is set on a non-production project. Verify: lint rule + e2e that advances the clock and asserts stored hours.
- G7 Races (E2): signup and cancel-promote run in one Admin-SDK transaction over the instance doc (counters + ordered waitlist array + monotonic waitlistSeq); waitlist position derives from waitlistSeq, not createdAt. Verify: emulator tests with N concurrent signups at the last seat (exactly one confirmed) and a cancel racing a signup.
- G8 Idempotency (E3 + Codex 5): HoursLog id = signupId; letter id = hash(uid, scopeKey, requestNonce); per-instance markers cutoffDoneAt and finalizedAt set inside transactions; runDueJobs takes a lease doc (jobLeases/runDueJobs with expiry) so overlapping scheduled/admin runs do not double-process; due work is found via nextActionAt per instance with pagination (200 per tick). Verify: retry tests for checkOut, finalizeShift, issueLetter; concurrent runDueJobs test.
- G9 Indexes from a query catalogue (E4): docs/SPEC.md lists every query; firestore.indexes.json is derived from it, including instances(nextActionAt), hoursLogs(orgId,status), signups(uid,start), letters(uid,scopeKey,status), notifications(createdAt). Verify: emulator runs with index enforcement and no missing-index errors.
- G10 Time zones (E5): use date-fns-tz for all zone math; table tests cross the March and November DST changes with a non-Chicago org for materialization, thresholds, display, and .ics. Verify: unit tests.
- G11 Profile gate (E6): defineCallable rejects every volunteer/coordinator operation until the profile is complete; the client routes such users to onboarding. Age (minor or not) is computed at each server decision from the private birth date; the public display projection is refreshed by completeProfile/updateProfile and on the next stats recompute (no scheduled birthday scan). Verify: Function tests.
- G12 Hours clamp (E7, supersedes the earlier hours formula): minutes = min(checkOutAt, scheduledEnd) minus max(checkInAt, scheduledStart), floored at 0, rounded to the nearest 15 min; coordinators adjust via setAttendance. Verified letters never credit time outside the scheduled window. Verify: table-driven unit test.
- G13 Turnstile bound to profile (S1 + Codex 8): completeProfile requires a Turnstile token verified server-side and consumed once (stored hash with expiry); every useful action requires a completed profile (G11). When TURNSTILE_ENABLED is false (emulator/LAN), this is logged at startup. Verify: Function tests for missing, invalid, and replayed tokens.
- G14 Minor safety (S2): registerOrganization requires an adult; minors cannot sign up for shifts of unverified orgs; coordinators who are minors cannot see adult contact snapshots. Verify: Function tests.
- G15 Kiosk custom token (S3 + Codex 7): startKiosk (coordinator) mints a custom token with claim kioskInstanceId and a 12-hour expiry; with it the kiosk device can only call kiosk ops for that instance and read that instance's roster; the coordinator's own session is not left on the device. Verify: Function + rules tests that the kiosk token cannot approve hours or read other instances.
- G16 AI caps (S4): a global daily counter aiUsage/_global trips AI off when exceeded; AI answers render as plain text (or sanitized markdown), never HTML; the system prompt contains no private data and the model has no tools. Verify: Function test + component test.
- G17 Org updates via Function (A5/S5): updateOrganization callable handles all org edits (rules deny client writes to organizations); verified, hasActivity, archived (one-way), ownerUid stay server-controlled. Storage rules restrict content type (image/* for photos, application/pdf for letters/reports), size under 5 MB, and owner-only paths for letters/reports. Verify: rules tests.
- G18 Under-13 before account (S6): the birth-date gate always runs before Firebase account creation; under-13 users never create an account; if an account somehow exists, deletion also removes any Firestore/Storage data and logs no PII. Verify: e2e + Function test.
- G19 Letter evidence snapshot (Codex 10): issueLetter snapshots the included approved log ids, per-org verification state, totals, date range, renderer version, and PDF object path into the letter doc at issuance; corrections create a new letter version and atomically mark the prior verification projection superseded. Verify: Function test that a later log change does not alter an issued letter's snapshot.
- G20 QR is progressive enhancement (H3 + Codex 7): typed code is the rehearsed primary path; QR scanning is enabled only in a secure context (deployed HTTPS or mkcert TLS on LAN, documented in DEMO.md). Verify: e2e typed path; QR component hidden when not secure.
- G21 HMAC details (S7): compare codes with timingSafeEqual; derive per-instance kiosk secrets with HKDF from a master secret in Secret Manager; force a client token refresh after admin claims are set. Verify: unit tests.
- G22 PDF Function sizing (H2): letters/reports use pdfkit (ported) with embedded fonts and server-side QR; the Function runs with at least 512 MB memory. Verify: Function test renders a letter under the emulator.
- G23 Job alerting (T1): a Cloud Monitoring log-based alert fires on runDueJobs outcome:error or no run in 15 minutes; the admin page and health show the last job run time. Verify: DEMO.md setup step + health test.
- G24 CI timing as a tracked target (T3 + Codex 12): the clone-to-ready timer runs on ubuntu only and reports (does not fail) until rehearsals establish a baseline; the functional suite runs on ubuntu and windows. This replaces the X19 hard-fail wording. Verify: CI config.
- G25 Port disposition ledger (Codex 13): pin the source repo commit (russy457/fblaslc2026 @ f9f6793) and write docs/PORT_LEDGER.md listing every old module/page with port, rewrite, or drop and the reason. Verify: ledger covers every file under src/ and functions/src of the old repo.
- G26 Plan cleanup (Codex 14 + H6): docs/SPEC.md (requirements), TODOS.md (backlog), and the decision log are the build inputs; PORT_PLAN.md's review record is history only and not handed to build agents. Verify: build-agent prompts reference SPEC.md only.
- G27 Test focus (T4): coverage target 100% lines/branches for shared/ (state machine, hours, reliability, ics, clock) instead of counting test files. Verify: vitest coverage threshold in shared.
- TE3 (taste, user environment): recommend moving the repo out of OneDrive before Phase 1 (A7); not applied without the user's say-so.
<!-- /autoplan-accepted:eng -->
## Review record

### CEO Step 0 (autoplan, SELECTIVE EXPANSION)

**Pre-review system audit.** New repo: 2 commits (CLAUDE.md routing, approved design doc + this
plan). No code, no stashes, no TODOS.md, no TODO/FIXME markers. Source to port is the read-only
clone `../fblaslc2026_old` (~35k lines). Design doc `docs/designs/volunteer-management-port.md`
(APPROVED) is the behavior source of truth; its 26 recorded reviewer concerns are inputs here.
Retrospective: last year's own audit (SECURITY_AUDIT_2026-06-18) shows recurring problems in
Firestore rules ownership checks and client-held keys; treat rules + key placement as
architectural risk, not polish.

**Taste calibration.** Good references to copy: `src/lib/search/*` (small pure modules, each
with a test), `src/lib/lazyWithReload.ts` (+test), `src/lib/consent.ts` (+test),
`functions/src/reports/pdf/sections/*` (one file per PDF section). Patterns to avoid:
`src/lib/firestore.ts` (1,335-line grab bag), `functions/src/index.ts` (Express routes over
in-memory mock data), hardcoded keys/uids in `firebase.ts`, `TurnstileGate.tsx`, `firestore.rules`.

**Landscape.** Reused from office hours (2026-10-06 search): incumbents (VolunteerHub, Galaxy
Digital, Better Impact, Bloomerang) all ship scheduling, check-in, hours, skills matching,
exports. Gaps: signup friction, ~1 in 4 no-show/cancel, ~30% first-year churn, unverifiable
paper hours. Layer 3: incumbents treat hours as an admin record; students treat them as a
credential. Building verification as a public, checkable credential is the differentiator.

**0A Premise challenge.** Real problem: win the FBLA rubric by credibly solving nonprofit
volunteer coordination for both volunteers and leaders. The plan attacks it directly (the
headline loop is the prompt's "coordinate, manage, maintain records, monitor participation").
Do-nothing cost: rebuilding 35k lines of rubric machinery from scratch. Premises held from the
design doc; no clearly-wrong premise found. Risk noted: scope is large for a team that must
also present; mitigated by the priority tiers obligation below.

**0B Existing code leverage.**
| Sub-problem | Reuse from old repo | Treatment |
|---|---|---|
| Search/autocomplete/typo/geo | `src/lib/search/*` + tests | copy verbatim, new adapter |
| Recommendations | `src/lib/discovery/organicScore.ts`, `sentiment.ts` | rework into match score |
| PDF reports | `functions/src/reports/**` | keep pipeline, rewrite sections |
| Report builder UI | `src/components/ReportBuilder/*`, `useReportGenerator.ts` | keep, new section keys |
| Help center + AI chat | `HelpCenter/`, `TroveChat.tsx`, `helpArticles.ts`, `helpRouteContext.ts`, `chatSystemPrompt.ts` | keep structure, AI moves server-side |
| Bot check | `TurnstileGate.tsx`, functions turnstile verify | keep, env keys |
| Auth | `lib/auth.ts`, `AuthPage.tsx` | keep, split file |
| Onboarding | `OnboardingPage.tsx`, `onboarding/OnboardingTour.tsx`, `tourSteps.ts` | keep, new steps |
| Lists/feed/profiles/follow | `lib/lists.ts`, `lib/feed.ts`, `lib/social.ts`, pages | rename domain |
| Infra | `ErrorBoundary`, `LoadingState`, `ErrorState`, `SeoMeta`, `CookieConsent`, `CommandPalette`, `lazyWithReload`, legal pages | keep, re-text |
| Rules + tests | `firestore.rules`, `firestore.rules.test.ts`, `vitest.rules.config.mjs` | rewrite for new matrix, keep harness |
| CI | `.github/workflows/ci.yml` | keep + gitleaks |
Rebuild (no reuse): kiosk, waitlist, reliability, hours/letters, notifications, recurring
series. Reason: no Trove equivalent exists.

**0C Dream state.**
```
  CURRENT STATE                THIS PLAN                          12-MONTH IDEAL
  empty repo + design   --->   full volunteer platform: port   --->  multi-org platform used by
  doc; old Trove code          + kiosk loop + verifiable hours       local nonprofits + schools;
  with leaked keys             + waitlist/reliability, tokens        school-counselor portal for
                               ready for new design                  hour requirements; email/SMS
```
The plan moves directly toward the ideal; nothing here blocks the school-portal or messaging
expansions later (notifications collection and verification records are the seams).

**0D.** No new approach decision needed (approach B approved in office hours, D2).

**0E Mode.** SELECTIVE EXPANSION (autoplan override; auto-decided). Provenance: autoplan rule.

**0F/0G HOLD checks.** (1) Complexity: far above 8 files / 2 services. Challenged; justified
because the port's file count is reuse, and the new services map 1:1 to approved features.
(2) Minimum change set: the four headline features + port of rubric machinery. Deferrable
without blocking: social extras (follow, impact-story comments). Kept: the team explicitly
asked for all features. (3) Invariants kept: no Firebase init, no secrets, tokens-only styling.

**10x check.** 10x is not more features; it is the 20-second judge demo working flawlessly
on three devices with real-looking data, plus a code walkthrough that maps every rubric row
to a file. Platform potential: the verification record is reusable by any school.

**Delight scan / cherry-picks (auto-decided per P1/P2/P3/P4):**
| # | Proposal | Effort | Decision | Reasoning |
|---|---|---|---|---|
| E1 | One-click demo dataset: seed script + "Reset demo" admin button that loads orgs, shifts, signups, hours | S | ACCEPTED | P2: in blast radius (seed already planned), <1d; makes the 3-min setup reliable |
| E2 | Calendar export (.ics) for confirmed shifts | S | ACCEPTED | P1/P2: small, directly attacks no-shows |
| E3 | Accessibility controls: text-size + high-contrast toggle, full keyboard path through signup and kiosk | S | ACCEPTED | P1: rubric UX row explicitly scores accessibility features |
| E4 | Milestone celebration + shareable badge card at 25/50/100 approved hours | S | ACCEPTED | P2: impact dashboard already planned; CountUp reuse |
| E5 | Coordinator CSV import of an existing volunteer roster | M | DEFERRED | P3: outside the demo loop; TODOS.md |
| E6 | Spanish UI (San Antonio audience) | L | DEFERRED | P3: large, outside blast radius; TODOS.md |
| E7 | Training/certification prerequisites per opportunity | M | DEFERRED | P3: new domain object; TODOS.md |
| E8 | Public org "impact this month" chart | S | SKIPPED | P4: duplicates org participation report |

**Decision ledger (CEO)**
| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| CEO-MODE (Step 0E) | autoplan override | SELECTIVE EXPANSION | — | approved | autoplan auto-decide rule |
| CEO-E1..E4 (0G) | delight scan above | — | add | approved | autoplan P1/P2 auto-decide |
| CEO-E5..E7 (0G) | delight scan above | — | defer | deferred | autoplan P3 auto-decide |
| CEO-E8 (0G) | delight scan above | — | skip | declined | autoplan P4 auto-decide |
| CEO-SPEC26 (0A) | design doc Reviewer Concerns R2-1..R2-26 | recorded | resolve as obligations | approved | autoplan P1/P2: in blast radius, mechanical |


**0H.** CEO plan saved at ~/.gstack/projects/jingd/ceo-plans/2026-10-06-volunteer-management-port.md. Spec review: 3 launches (cap), 6/10 each; round-3 findings resolved by batch-4 obligations after the cap (not reviewer-confirmed). Document approval: A (autoplan auto-decide).

**0I Temporal interrogation.**
```
  HOUR 1 (foundations):  emulator firebase.json + demo project id, env shape, Tailwind 4 @theme
                         from tokens.css, Functions TS project layout, shared zod schemas used by
                         BOTH client and Functions (one package path), test harness for rules.
  HOUR 2-3 (core logic): signup transaction + waitlist array, state machine module, hours formula,
                         reliability formula, kiosk HMAC window math. Ambiguity risks: time zones
                         (store UTC + org IANA zone), Firestore transactions cannot query (use
                         deterministic doc ids + arrays).
  HOUR 4-5 (integration): callable auth context in emulator, custom claims in emulator, live
                         onSnapshot roster across 3 devices on LAN, PDF pipeline fonts on Windows.
  HOUR 6+ (polish/tests): axe on kiosk, keyboard-only e2e, rules test matrix size, demo reset,
                         DEMO.md rehearsal, README rubric map.
```
Effort: human team ~6-8 weeks / CC + gstack ~1-2 days of agent time across parallel workers.
Feasibility blockers: none blocking; shared-schema package path is decided in Eng review.

### CEO dual voices

Native (Claude subagent, input ceo b1c0a58f, full read 1-223): 14 findings (F1-F14). Outside
(Codex gpt-5.6-terra, completed): 14 findings. Both full outputs were presented in chat.

```
CEO DUAL VOICES — CONSENSUS TABLE:
  Dimension                             Claude   Codex    Consensus
  1. Premises valid?                    No (F3,F5,F6)  No (no partner validation, Blaze owner)  CONFIRMED: premises under-validated
  2. Right problem to solve?            Reframe to verified hours (F1,F2)  Reframe to verified hours + attendance  CONFIRMED (USER CHALLENGE)
  3. Scope calibration correct?         No, Tier 1 = whole product (F4,F9)  No, catalogue not workflow  CONFIRMED (USER CHALLENGE)
  4. Alternatives sufficiently explored? No (QR vs code, fresh build, age attest)  No (manual waitlist, partner import)  CONFIRMED: taste items
  5. Competitive/market risks covered?  No (F14 SignUpGenius etc.)  No (nonprofit adoption, org trust)  CONFIRMED
  6. 6-month trajectory sound?          No (F8 contradictions)  No (design churn, supersedes)  CONFIRMED
```

Classification of voice findings:
- USER CHALLENGE UC1 (both): replace "port every Trove feature" with "verified student hours +
  attendance workflow", cutting discovery/social features (impact stories, follows, public
  profiles, collections, lists, Mapbox, command palette). Contradicts the user's explicit
  instruction. Not auto-decided; goes to final gate. Plan keeps current scope until answered.
- USER CHALLENGE UC2 (both): demo topology. User premise: "we will have wifi" (cloud primary).
  Claude: make offline LAN the default; Codex: kiosk fragile on venue network. Final gate.
- Mechanical, accepted: consolidate the plan into one contradiction-free `docs/SPEC.md` before
  Phase 3 (both voices, F8). Accepted: competitor table + "why not SignUpGenius" answer (F14).
  Accepted: check guidelines for AI/originality rule and assign a human explainer per Tier 1
  Function (F5). The pasted 2026-27 guidelines contain no AI-use clause; "Competitor
  Responsibility: Only registered competitors are permitted to plan, research, prepare" is the
  nearest rule, so the explainer requirement stays.
- Taste (auto-decided, surfaced at gate): T1 QR code that wraps the same HMAC on the kiosk,
  typed code kept as fallback (Claude F11) -> ACCEPT (faster on stage; judges never scan, the
  team's phone does). T2 waitlist auto-confirm vs accept/decline window (Codex) -> keep
  auto-confirm + late-promotion excuse (simpler, already specified) but add a "Can't make it"
  one-tap release on the promotion notification. T3 reliability score ethics (Codex) -> keep
  score but coordinator-only, shown with its inputs, excuse path, and expiry (window of last 20,
  older than 12 months dropped); never used to block signup. T4 org trust (Codex) -> unverified
  orgs cannot see contact snapshots of minors (display name only) until verified. T5 Tier 0
  sizing (Claude F4) -> adopt a Tier 0 = demo loop inside Tier 1 (build order only, no cuts).
  T6 dated schedule (Claude F3) -> needs the competition date from the user; asked at gate.

### Section 1: Architecture Review

Current scope: mode SELECTIVE EXPANSION (auto). Accepted: approach B (office hours D2), four
headline features, E1-E4, 26 concerns, spec-review batches 1-4, voice items above. Deferred:
E5-E7 (TODOS.md). Declined: E8, PWA. Pending: UC1, UC2, T6.

```
                         +--------------------------- Browser (React SPA) ---------------------------+
  Volunteer phone  ----> | pages/ (feature folders)  hooks/  store (zustand)  TanStack Query         |
  Kiosk tablet     ----> | lib/search (ported)  lib/domain (state machine, hours, reliability, ics)  |
  Coordinator laptop --> | lib/validation (zod, shared)  lib/data/* (repositories, read-only)       |
                         +----------+---------------------------+----------------------------------+
                                    | onSnapshot reads          | httpsCallable writes
                                    v                           v
                         +-------------------+      +--------------------------------------------+
                         | Firestore (rules) |<---->| Cloud Functions (callables + 2 triggers +  |
                         | Storage (rules)   |      | runDueJobs scheduler)                       |
                         +-------------------+      |  shared/ (zod schemas, state machine, math) |
                                                    |  reports/ (ported PDF pipeline)             |
                                                    |  ai/ (Claude, rate-limited)  turnstile/     |
                                                    +---------------------+----------------------+
                                                                          | secrets
                                                                Anthropic API, Cloudflare Turnstile
```
Findings: (1) Shared logic (zod schemas, state machine, hours/reliability math) must be ONE
source compiled into both client and Functions, or the two will drift. Decision: a `shared/`
TypeScript folder at repo root, imported by both via path alias and copied into the Functions
build. Auto-decided P4 (DRY). (2) Single points of failure: Firestore availability, the
runDueJobs scheduler, venue network (UC2). (3) Security boundary: every mutation is a callable
with auth context; clients only read. (4) Rollback: Hosting rollback via previous release;
Functions redeploy previous commit; no schema migrations (new project). Scaling: 10x is fine;
100x hits the per-instance waitlist array (bounded by capacity, max 200) and onSnapshot fan-out
on rosters (bounded per instance).

Signup state machine (authoritative, consolidated):
```
                 signup(full)            signup(seat)
   (none) ---------------------> WAITLISTED ----promote----> CONFIRMED ----checkIn----> CHECKED-IN
                                   |   cutoff/volunteer/org      |  \                      |
                                   v                             |   \ finalize(late-promo) | checkOut / finalize / org-cancel
                               CANCELLED <----volunteer/org------+    v                     v
                                   ^                             |  EXCUSED <--coord--  COMPLETED
                                   |                             | finalize                ^  |
                                   +-----------------------------+--> NO-SHOW --setAttendance-+  |
                                                                       ^------setAttendance-------+
   Invalid (rejected): any -> WAITLISTED except initial; COMPLETED -> CHECKED-IN; CANCELLED -> *;
   EXCUSED -> *; CHECKED-IN -> NO-SHOW. Enforced in shared/stateMachine.ts used by every Function.
```

### Section 2: Error & Rescue Map
```
  CODEPATH                 | WHAT CAN GO WRONG                    | ERROR CLASS (HttpsError code)
  signup                   | full + waitlist full                 | resource-exhausted
                           | under minAge / profile incomplete    | failed-precondition
                           | transaction contention               | aborted (retried 3x)
  checkIn / checkOut       | stale/wrong code                     | invalid-argument
                           | outside window                       | failed-precondition
                           | rate limit                           | resource-exhausted
  issueKioskCode           | not coordinator                      | permission-denied
  issueLetter              | no approved hours in scope           | failed-precondition
  askAssistant/planner AI  | key missing                          | unavailable -> BM25/parser fallback
                           | 429 / timeout                        | unavailable -> fallback
                           | malformed / refusal / invalid JSON   | internal -> fallback + log
  reports PDF              | image fetch fails / font missing     | internal -> section omitted note
  runDueJobs               | partial batch failure                | logged, idempotent retry next tick
  registerOrganization     | EIN format invalid                   | invalid-argument
  client network           | offline / Functions unreachable      | toast + retry, no silent loss

  ERROR                    | RESCUED? | ACTION                         | USER SEES
  resource-exhausted       | Y        | message from Function          | "This shift and its waitlist are full."
  failed-precondition      | Y        | message from Function          | specific reason text
  aborted                  | Y        | retry 3x with backoff          | spinner, then "Try again"
  permission-denied        | Y        | log + redirect                 | "You don't have access to that."
  unavailable (AI)         | Y        | deterministic fallback         | answer from help articles / parsed form
  internal (AI JSON)       | Y        | zod-validate model output, fallback | same as above
  internal (other)         | Y        | log with requestId             | "Something went wrong (ref: id)"
```
No catch-alls: a shared `toUserError()` maps HttpsError codes; unknown errors show the ref id.

### Section 3: Security & Threat Model
| Threat | Likelihood | Impact | Mitigated? |
|---|---|---|---|
| Forged hours/badges via client writes | High | High | Yes: server-owned fields, rules tests |
| Enumerating /verify codes | Low | Med | Yes: 128-bit ids, list denied |
| Fake org harvesting minors' contacts | Med | High | Yes (T4): unverified orgs see display names only |
| Kiosk code relay | Med | Low | Partly: 30 s rotation, live arrivals spot check |
| AI cost abuse | Med | Med | Yes: auth, per-user limits, size caps, budget alert |
| Prompt injection via help question | Med | Low | Yes: model output zod-validated, no tool use, no data access beyond help articles |
| Leaked keys (old repo) | High | Med | Team action: revoke/rotate; gitleaks in CI |
| XSS via user text (bios, stories, reviews) | Med | Med | Yes: React escaping, no dangerouslySetInnerHTML, length limits |
Audit fields (by, at, note) on setAttendance, approve/rejectHours, revokeLetter, verifyOrganization.

### Section 4: Data Flow & Interaction Edge Cases
```
 signup:  INPUT(instanceId) -> VALIDATE(auth, profile, minAge, window) -> TXN(read instance,
          count, waitlist) -> PERSIST(signup doc id instanceId_uid, counters) -> OUTPUT(status)
   shadows: nil instance -> not-found; dup click -> same doc id, idempotent; contention -> aborted retry;
            stale UI -> server is truth, UI re-renders from snapshot
```
Async ordering: two volunteers race for the last seat. Invariant: signupCount <= capacity.
Schedule A: T1 reads count=9/10, T2 reads 9/10, T1 commits 10, T2 commit fails (Firestore
optimistic transaction detects read change) -> T2 retries, reads 10/10 -> waitlisted. Schedule
B mirrored. Mechanism: transaction read set on the instance doc. Regression proof: emulator
test firing two signups with Promise.all and asserting one confirmed, one waitlisted.
| Interaction | Edge case | Handled | How |
|---|---|---|---|
| Signup button | double click | Y | deterministic doc id + disabled while pending |
| Kiosk | code rotates mid-typing | Y | previous window accepted |
| Roster | 0 / 200 volunteers | Y | empty state / virtualized list |
| Letter | navigate away during PDF | Y | job result stored, retrievable later |

### Section 5: Code Quality Review
Ported search modules fit; firestore.ts split into repositories. Risk: duplicated validation
between client and Functions -> shared/ (Section 1). Over-engineering risk: separate Functions
per tiny action; acceptable because each is a security boundary. Complexity watch: signup and
finalizeShift; each delegates branching to shared/stateMachine. No new findings beyond these.

### Section 6: Test Review
```
 NEW THING                 | TYPE          | HAPPY                    | FAILURE                 | EDGE
 state machine             | unit          | allowed pairs            | rejected pairs          | all statuses
 hours formula             | unit (table)  | normal shift             | no check-out            | early/late, rounding
 reliability               | unit          | mixed history            | <3 history              | excused/system cancels
 signup/waitlist           | emulator fn   | seat available           | full + waitlist full    | race (Promise.all)
 checkIn/checkOut          | emulator fn   | valid code               | stale code, window      | rate limit
 letters + verify          | emulator fn + component | issue, verify  | revoked, superseded     | unverified org hours
 rules matrix              | rules tests   | allowed reads/writes     | every denied case       | minor fields
 AI fallback               | unit (mocked) | key present              | 429/timeout/bad JSON    | refusal
 Tier 1 loop               | Playwright e2e| 3-context demo loop      | kiosk wrong code        | keyboard-only
```
2am-Friday test: the 3-browser-context Playwright test of the full demo loop. Hostile QA: race
signups, replay old kiosk codes, write isMinor from client. Flakiness: time-based tests use an
injected clock (shared/clock.ts), never real time.

### Section 7: Performance Review
Reads: Explore uses the ported paginated query + search index; roster listens per instance
only. Indexes needed: signups(instanceId,status), hoursLogs(uid,status,date),
instances(orgId,start), letters(uid,issuedAt). Slow paths: PDF generation (2-5 s, async with
progress), runDueJobs over many instances (batched 200/tick), first search index load.

### Section 8: Observability & Debuggability Review
Functions log structured JSON {fn, uid, instanceId, outcome, ms, requestId}. Admin page shows
last runDueJobs run, counts processed, and recent errors (from a `jobRuns` collection, admin
read). Client shows requestId on errors. Runbook lines go in DEMO.md (kiosk not updating,
jobs not running, AI unavailable).

### Section 9: Deployment & Rollout Review
No migrations (new project). Order: rules + indexes, Functions, Hosting. Feature flags via
env: AI_ENABLED, DEMO_MODE. Post-deploy smoke: health, seed demo, run due jobs, full demo loop
on 3 devices. Rollback: `firebase hosting:rollback`, redeploy previous Functions commit.

### Section 10: Long-Term Trajectory Review
Reversibility 4/5 (new project, no external integrations). Debt: plan churn (fixed by
docs/SPEC.md), React Bits vendoring edits, the 30+ Function surface. The verification record
and shared/ domain module are the platform pieces a school portal could build on. Retrospective
on cherry-picks: E1 (demo reset) is load-bearing for the demo; E5 (roster import) is the item
both outside voices called more credible than social features, which feeds UC1.

### Section 11: Design & UX Review
```
 Landing -> Explore (filters, recommended) -> Opportunity -> [Sign up | Join waitlist]
    -> Profile (my shifts, notifications) -> [shift day] Kiosk code entry on phone -> Checked in
    -> Check out -> Hours (auto-approved) -> Letter builder -> PDF + verify code -> /verify
 Coordinator: Dashboard -> Create shift (planner text -> prefilled form) -> Roster (live)
    -> Kiosk mode (locked) -> Hours approval -> Reports
```
| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| Explore | skeleton | "No shifts match" + clear filters | retry | list | some orgs missing coords: hide distance |
| Kiosk | code spinner | "No one checked in yet" | "Code service offline" + retry | arrivals animate in | — |
| Letter | progress | "No approved hours yet" + how to earn | requestId | download + code | unverified-org hours excluded note |
AI slop risk: high for generic dashboard cards; taste-skill rules apply. Accessibility: E3.
Recommend /plan-design-review (runs next as Phase 2).

### CEO required outputs

**NOT in scope**
- Deferred (TODOS.md): E5 coordinator CSV roster import; E6 Spanish UI; E7 training/certification prerequisites. Reason: outside the demo loop (autoplan P3).
- Rejected: E8 public org monthly impact chart (duplicates org report, P4); PWA (never approved).
- Pending user decision: UC1 (cut discovery/social features), UC2 (offline-first demo), T6 schedule.
- Out of scope by constraint: final visual identity, Firebase project creation, mobile app.

**What already exists** — see 0B table (search engine, PDF pipeline, report builder UI, help center/chat, Turnstile, auth, onboarding, lists/feed/profiles, infra components, rules harness, CI). All reused; kiosk, waitlist, reliability, letters, notifications, and series are new.

**Dream state delta.** After this plan: a working volunteer platform with a fraud-resistant
hours record and a live kiosk, on a token system ready for the new design. Still missing vs
the 12-month ideal: school-side requirement tracking, email/SMS reminders, roster import,
multi-language, real nonprofit partners.

**Error & Rescue Registry** — Section 2 tables (11 codepaths, 7 error classes, 0 unrescued).

**Failure Modes Registry**
```
  CODEPATH        | FAILURE MODE              | RESCUED? | TEST? | USER SEES?             | LOGGED?
  signup          | last-seat race            | Y        | Y     | waitlisted status      | Y
  signup          | waitlist full             | Y        | Y     | clear message          | Y
  checkIn         | stale code                | Y        | Y     | "code expired"         | Y
  checkIn         | venue network down        | Y (UC2)  | manual| retry toast            | client only
  finalizeShift   | scheduler not firing (emu)| Y        | Y     | coordinator "Run jobs" | Y
  issueLetter     | unverified-org hours      | Y        | Y     | note in letter builder | Y
  AI              | key missing/429/bad JSON  | Y        | Y     | fallback answer        | Y
  reports PDF     | image fetch fails         | Y        | Y     | section note           | Y
  rules           | client forges stats       | Y        | Y     | permission error       | Y
  runDueJobs      | partial batch failure     | Y        | Y     | none (retries)         | Y (jobRuns)
```
0 CRITICAL GAPS (no row with RESCUED=N, TEST=N, silent).

**Scope Expansion Decisions.** Accepted: E1, E2, E3, E4, spec-review batches 1-4, voice items
(SPEC.md, shared/, competitor table, explainers, T1-T5). Deferred: E5, E6, E7. Skipped: E8, PWA.

**Stale Diagram Audit.** No diagrams exist in the repo yet (no code). Old-repo README
"Target data flow" diagram is not ported (Trove-specific).

**Decision Audit Trail**
| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | Mode SELECTIVE EXPANSION | Mechanical | override | autoplan rule | other modes |
| 2 | CEO | Accept E1-E4 | Mechanical | P2 | in blast radius, <1d | — |
| 3 | CEO | Defer E5-E7 | Mechanical | P3 | outside blast radius | add now |
| 4 | CEO | Skip E8 | Mechanical | P4 | duplicate | add |
| 5 | CEO | Resolve 26 design concerns | Mechanical | P1 | completeness | leave open |
| 6 | CEO | Spec batches 1-4 | Mechanical | P1/P5 | correctness | — |
| 7 | CEO | Tailwind 4 over 3 | Taste | P3/P5 | native @theme tokens, registry fit | Tailwind 3 pinned shadcn |
| 8 | CEO | Consolidated docs/SPEC.md | Mechanical | P5 | both voices | keep supersedes chain |
| 9 | CEO | shared/ domain module | Mechanical | P4 | DRY | duplicate schemas |
| 10 | CEO | Kiosk QR + typed fallback (T1) | Taste | P1 | faster stage demo | typed only |
| 11 | CEO | Keep auto-confirm + one-tap release (T2) | Taste | P5 | simpler, already specified | accept/decline window |
| 12 | CEO | Reliability guardrails (T3) | Taste | P1 | fairness | drop score |
| 13 | CEO | Unverified orgs see names only for minors (T4) | Taste | P1 | safety | full snapshot |
| 14 | CEO | Tier 0 build order (T5) | Taste | P6 | ship the loop first | cut features |
| 15 | CEO | UC1 cut discovery features | User Challenge | — | both voices | — (user decides) |
| 16 | CEO | UC2 offline-first demo | User Challenge | — | both voices | — (user decides) |
| 17 | CEO | T6 dated schedule | Taste (needs input) | P1 | needs competition date | — |

**Implementation Tasks (CEO)**
- [ ] **T1 (P1, human: ~4h / CC: ~20min)** — docs — Write consolidated docs/SPEC.md
  - Surfaced by: dual voices F8 — plan contradicts itself via "supersedes" lines
  - Files: docs/SPEC.md
  - Verify: grep -c supersedes docs/SPEC.md returns 0
- [ ] **T2 (P1, human: ~3h / CC: ~10min)** — shared — Create shared/ domain module (schemas, state machine, hours, reliability, ics, clock)
  - Surfaced by: Section 1 — shared logic must not drift
  - Files: shared/*
  - Verify: vitest shared/ passes
- [ ] **T3 (P1, human: ~2h / CC: ~10min)** — docs — DEMO.md with explainers table, smoke checklist, runbook, competitor answer
  - Surfaced by: F5, F14, Section 8/9
  - Files: docs/DEMO.md
  - Verify: checklist reviewed by team
- [ ] **T4 (P2, human: ~2h / CC: ~10min)** — kiosk — QR rendering of the rotating code + in-app scanner
  - Surfaced by: T1 taste decision (Claude F11)
  - Files: to be determined
  - Verify: component test + typed-path e2e
- [ ] **T5 (P1, human: ~1h / CC: ~5min)** — team — Revoke old Mapbox sk. token; rotate OpenRouter and Turnstile secrets
  - Surfaced by: Section 3 threat table
  - Files: none (account action)
  - Verify: old token returns 401

**Completion Summary**
```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | empty repo, approved design doc, old repo   |
  |                      | has leaked keys + oversized files           |
  | Step 0               | SELECTIVE EXPANSION; E1-E4 in, E5-E7 out    |
  | Section 1  (Arch)    | 2 issues found (shared module, SPOFs)       |
  | Section 2  (Errors)  | 11 error paths mapped, 0 GAPS               |
  | Section 3  (Security)| 8 issues found, 3 High severity             |
  | Section 4  (Data/UX) | 4 edge cases mapped, 0 unhandled            |
  | Section 5  (Quality) | 1 issue found                               |
  | Section 6  (Tests)   | Diagram produced, 0 gaps                    |
  | Section 7  (Perf)    | 4 indexes required, 3 slow paths noted      |
  | Section 8  (Observ)  | 3 gaps found (now obligations)              |
  | Section 9  (Deploy)  | 2 risks flagged (venue network, Blaze owner)|
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 3           |
  | Section 11 (Design)  | 3 issues (slop risk, states, a11y)          |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (6 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 11 rows, 0 CRITICAL GAPS                    |
  | Failure modes        | 10 total, 0 CRITICAL GAPS                   |
  | TODOS.md updates     | 3 items proposed                            |
  | Scope proposals      | 8 proposed, 4 accepted (EXP + SEL)          |
  | CEO plan             | written                                     |
  | Outside voice        | codex completed                             |
  | Lake Score           | N/A (no scored coverage questions)          |
  | Diagrams produced    | 4 (architecture, state machine, data flow,  |
  |                      | user flow)                                  |
  | Stale diagrams found | 0                                           |
  | Unresolved decisions | 3 (UC1, UC2, T6 — final gate)               |
  +====================================================================+
```
Approval readiness: PASS — rows CEO-MODE, CEO-E1..E8, CEO-SPEC26 carry autoplan auto-decide
authority; UC1, UC2, T6 remain unresolved for the final gate.

<!-- autoplan-baseline-edits:ceo {"sourceSha256":"2a358b511ebc4c7208be54ef6e6a8045b69045f811125d78df0f2b74174dcd92","replacements":[{"oldText":"Firebase (Auth, Firestore, Storage) on the free Spark tier, Cloud Functions (Express) for the\nPDF report pipeline + Turnstile verification, Vitest + Playwright, Recharts, Mapbox GL.","newText":"Firebase (Auth, Firestore, Storage, Cloud Functions) on the Blaze plan (free quota): callable\nFunctions for trusted flows (org registration, signup/waitlist, kiosk check-in/out, hours\nletters, AI) plus the PDF report pipeline and Turnstile verification. Tailwind 3 + React Bits\n(TS-TW variants), Vitest + Playwright, Recharts, Mapbox GL (public token, optional)."},{"oldText":"availability, age band |","newText":"availability, birth date (stored privately; 13+ enforced) |"},{"oldText":"status: signed-up → checked-in → completed / no-show / cancelled; token = check-in code","newText":"status: confirmed, waitlisted, checked-in, completed, no-show, excused, cancelled (lateCancel flag); check-in via rotating kiosk code"},{"oldText":"env-driven `firebase.ts`, neutral\n   `styles/base.css`, brand constant. `git init`, remote `russy457/fbla2027`.","newText":"env-driven `firebase.ts`, Tailwind + shadcn `components.json` +\n   `styles/tokens.css`, brand constant. (git init + remote already done.)"},{"oldText":"- Visual design (new design doc), Firebase project creation/deploy, mobile app.","newText":"- Final visual identity (new design doc), Firebase project creation (team action), mobile app.\n  Deploy happens once the new project exists, before the first competition round."},{"oldText":"3. **Pages & components (parallel agents)** —\n   A. Volunteer side: Home, Explore (orgs + opportunities, smart filters), Organization detail,\n      Opportunity detail/signup, Saved, Profile, Impact, Onboarding.\n   B. Coordinator side: Org auth/portal/register, Dashboard (opportunities CRUD, roster,\n      check-in by code, hours approval, analytics), Report builders (user + org).\n   C. Community + help: Collections (lists), Impact stories feed, public profiles, Help Center,\n      AI chat, command palette, onboarding tour, legal pages.\n   D. Backend: Cloud Functions (reports PDF sections rewritten, Turnstile verify, health),\n      Firestore + Storage rules for new collections, rules tests, indexes.\n4. **Quality** — `tsc -b`, `vite build`, vitest (port all existing pure-logic tests + new tests\n   for validation, match score, hours aggregation, report aggregation), fix errors, review.\n5. **Docs** — README (setup, features mapped to rubric, libraries + licenses, attributions),\n   `docs/RUBRIC_MAP.md`.","newText":"3. **Tier 1 demo loop (parallel agents, gated by the Tier 1 e2e test)** —\n   A. Volunteer: auth + onboarding, Explore (orgs + opportunities, smart filters), Organization\n      page, Opportunity detail + signup/waitlist, Profile, Impact dashboard (E4), .ics (E2).\n   B. Coordinator: org registration, Dashboard (opportunities + series CRUD, roster, kiosk mode,\n      hours approval, attendance overrides, analytics), Report builders (volunteer + org).\n   C. Help: Help Center + Q&A (BM25 fallback), onboarding tour, accessibility controls (E3),\n      deterministic shift planner, legal pages.\n   D. Backend Functions: registerOrganization, redeemInvite, completeProfile, signup,\n      cancelSignup, issueKioskCode, checkIn, checkOut, finalizeShift (scheduled + callable),\n      setAttendance (coordinator override), approveHours, issueLetter, revokeLetter,\n      extendSeries (scheduled + callable), shiftPlannerParse/askAssistant (AI), resetDemoData\n      (admin + DEMO_MODE), reports PDF, turnstileVerify, health. Firestore + Storage rules for the\n      full matrix, rules tests, indexes, seed:demo (E1).\n4. **Tier 2** — shift planner AI enhancement, reliability charts, collections, impact stories,\n   public profiles/follow, saved items, command palette, notifications bell, cookie consent.\n   **Tier 3** — SEO polish.\n5. **Quality** — `tsc -b`, `vite build`, vitest (ported pure-logic tests + new unit tests),\n   emulator rules tests, Functions tests, Playwright e2e (Tier 1 loop, keyboard-only path),\n   axe checks, gitleaks in CI; fix errors; code review.\n6. **Docs** — README (setup, features mapped to rubric, libraries + licenses, attributions,\n   cited stats), `docs/RUBRIC_MAP.md`, `docs/DEMO.md`, help articles, `TODOS.md`."},{"oldText":"- Hardcoded admin uid in firestore.rules → env/config placeholder.","newText":"- Hardcoded admin uid in firestore.rules → Firebase custom claim `admin`, set by a script."}]} -->

<!-- autoplan-accepted:ceo -->
- Priority tiers and build order: Tier 1 (must ship) = scaffold, domain layer, auth/onboarding, org registration, opportunities + signup/waitlist, kiosk check-in/out + live roster, hours + approval, verified letters + /verify, reports, help center + Q&A, input validation, rules + rules tests. Tier 2 = shift planner AI enhancement, reliability charts, collections, impact stories feed, public profiles/follow, command palette. Tier 3 = SEO polish. Build the Tier 1 demo loop (signup -> kiosk check-in/out -> live roster -> hours -> letter) before secondary ported pages. Verify: Tier 1 e2e test passes before Tier 2 work merges.
- Reminders are ephemeral UI computed client-side from the user's confirmed signups (never stored); notifications/{uid}/items stays Function-write-only. Verify: rules test denies client create on notifications.
- Org registration runs in a `registerOrganization` callable Function that writes the org doc and the owner's members doc in one transaction. Verify: rules test denies client create of organizations and members; Function test creates both.
- users/{uid} (public) holds only allowlisted public fields (displayName as first name + last initial for under-18, avatarUrl, badges, totalApprovedHours, orgsHelpedCount, bio for 18+, streakWeeks); all other fields live in users/{uid}/private. Rules reject any key outside the allowlist and reject adult-only fields when private.isMinor is true. Verify: rules tests for allowed, extra-field, and minor cases.
- The signup Function copies a contact snapshot (fullName, email, phone if given) into the signup doc, readable only by the volunteer and that org's coordinators. Verify: rules test that another volunteer cannot read it.
- Birth date is set once by a `completeProfile` Function that enforces age >= 13 and derives isMinor; birthDate is immutable to clients afterwards (admin-only correction). Verify: rules test denies client update of birthDate; Function test rejects age 12.
- Waitlist promotions within 24 h of start are auto-excused from reliability if the promoted volunteer does not attend (status `excused`, excuseReason `late-promotion`). Verify: unit test on reliability calculation.
- Check-out is a separate explicit action (`checkOut` Function and its own button), accepted from 15 minutes after check-in until scheduled end + 30 minutes; outside that window it returns a clear error. Verify: Function tests for early, valid, and late check-out.
- Rules matrix is extended to every persisted collection: invites (owner read/create via Function, redeem via Function), series (public read, coordinator write), instance secrets in `instanceSecrets/{id}` (no client access), impactStories (public read, signed-in create, author update/delete, admin delete), follows (public read, self create/delete), savedItems under users/{uid}/saved (self only), collections (public read if published, owner write), reports metadata (owner only). Verify: rules tests cover every row including denied cases.
- AI Function callers: shift planner requires org coordinator membership; Q&A requires a signed-in user. Per-user limit 20 calls/hour and 100/day stored in `aiUsage/{uid}`, input max 2,000 chars, output max 1,024 tokens. App Check enforced on the deployed demo. Team sets a Blaze budget alert at $5. Verify: Function tests for unauthorized, over-limit, and oversized input.
- Whole-series signup covers the current 8-week materialized window only, and a scheduled Function extends instances weekly. Verify: unit test of materialization window.
- Constraint wording: no init or deploy until the new project exists; deploy before the first competition round. Verify: doc text.
- Full status set: confirmed, waitlisted, checked-in, completed, no-show, excused, cancelled (with lateCancel boolean). Transitions: waitlisted->confirmed, confirmed->checked-in->completed, confirmed->no-show->excused, confirmed|waitlisted->cancelled. Verify: state-machine unit test rejects all other transitions.
- Reliability excludes excused, early-cancelled, and promotion-excused signups from both the 20-signup window and the formula. Verify: unit tests.
- A full waitlist rejects signup with "This shift and its waitlist are full." Remaining waitlisted signups are cancelled (not counted) at shift start with a notification. Verify: Function tests.
- Letters can be revoked by the org owner or an admin via a `revokeLetter` Function with a required reason. Verify: Function test.
- Billing owner is a team adult (adviser or parent); LAN emulator fallback rehearsed. Verify: DEMO.md checklist.
- Scaffold includes Tailwind 3 + shadcn components.json; tailwind.config maps colors/fonts/radii to CSS variables in src/styles/tokens.css. Verify: build passes and changing one token changes React Bits components.
- Onboarding collects birth date (stored privately) instead of an age band. Verify: onboarding form test.
- Kiosk code relay limitation documented; coordinator's live arrivals list supports spot checks. Verify: DEMO.md + help article.
- Reviews carry signupId; rules check that signup belongs to the author, is completed, and its instance's orgId matches. Verify: rules tests.
- Changing an org's name or EIN resets verified to false; orgs with signups, hours, or letters can only be archived, not deleted. Verify: rules tests.
- Cite sources for the 1-in-4 no-show and 30% churn stats in README/presentation notes and quote the guidelines line "no more than three personal devices". Verify: README text.
- Local/emulator runs use Cloudflare's published Turnstile test keys. Verify: .env.example and emulator test.
- Repo license is MIT; README notes React Bits source is MIT + Commons Clause (no selling the components) and is attributed in README and file headers. Verify: LICENSE + README.
- E1 demo dataset: `npm run seed:demo` seeds the emulator, and an admin-only "Reset demo data" button reseeds. Verify: seed test + manual run.
- E2 .ics export for confirmed shifts. Verify: unit test on .ics output.
- E3 accessibility controls (text size, high contrast, keyboard path through signup and kiosk). Verify: Playwright keyboard-only test + axe check.
- E4 milestone celebration + badge card at 25/50/100 approved hours. Verify: unit test on milestone thresholds.
- Baseline edits (recorded above): stack line updated to Blaze + callable Functions + Tailwind/React Bits; onboarding collects birth date; signup status set updated; scaffold uses Tailwind + components.json + tokens.css; out-of-scope line clarifies deploy timing. Verify: Implementation plan text.
- Concern map (design doc R2-x to obligation): R2-1 reminders; R2-2 registerOrganization; R2-3 public/private split; R2-4 contact snapshot; R2-5 birth date; R2-6 late-promotion excuse; R2-7 check-out window; R2-8 rules matrix; R2-9 AI limits; R2-10 series window; R2-11 constraint wording; R2-12 status set; R2-13 reliability exclusions; R2-14 full waitlist; R2-15 revocation; R2-16 billing owner; R2-17 Tailwind tokens; R2-18 onboarding birth date; R2-19 kiosk relay; R2-20 reviews signupId; R2-21 org verify reset/archive; R2-22 priority tiers; R2-23 cited stats; R2-24 design-doc wording only (no code); R2-25 Turnstile test keys; R2-26 license. Verify: each maps to one bullet in this block.
- Shift finalization: finalizeShift runs at scheduled end + 30 min (scheduled; also callable by coordinators and tests). It sets confirmed to no-show (or excused with excuseReason late-promotion when promoted within 24 h), and checked-in without check-out to completed with hours capped at the scheduled end and the HoursLog flagged needsReview. Verify: Function tests for each branch.
- Hours lifecycle: checkOut and finalizeShift create one HoursLog per signup with minutes = min(actual, scheduled + 30), rounded to 15 min. Kiosk-verified logs are auto-approved; needsReview and volunteer-submitted manual logs start pending and need coordinator approval via approveHours. Only approved logs feed totalApprovedHours, badges, reports, and letters. Verify: Function tests + aggregation unit test.
- Coordinator attendance override: setAttendance lets an org coordinator set no-show to completed (with hours) or completed to no-show, with a required note and audit fields (by, at). Verify: Function test + rules deny for non-coordinators.
- Server-owned stats: totalApprovedHours, orgsHelpedCount, badges, and reliability on users/{uid} are written only by Functions; rules deny client writes to those keys. Verify: rules test.
- Rules matrix additions: aiUsage/{uid} (no client access); letterVerifications/{code} (public get by exact id only, list denied, holds only the minimal public projection, written by issueLetter/revokeLetter and the supersede trigger); letters/{id} full record (volunteer and issuing-org coordinators read, Function write only). Kiosk codes are never stored; issueKioskCode derives them from instanceSecrets. Verify: rules tests.
- Kiosk code issuance: issueKioskCode (coordinator of the instance's org only) returns the current 6-digit HMAC code and seconds remaining. Verify: Function test for non-coordinator denial and code rotation.
- Letter statuses: valid, superseded, revoked. /verify shows a valid state, a superseded state with the newer letter's issue date, and a revoked state with the reason category. Verify: component tests for all three.
- Waitlist cutoff: at start minus 2 h, remaining waitlisted signups are cancelled (not counted against reliability) with a notification; no promotion happens after that point. This replaces the earlier "cancelled at shift start" wording. Verify: Function test.
- Late cancel threshold: cancellations less than 24 h before start set lateCancel = true; earlier ones are early cancels and are excluded from reliability. Verify: unit test.
- Under-13 path: completeProfile rejects with "You must be 13 or older to use this app" and deletes the just-created Auth user; the onboarding form validates the date client-side first. Verify: Function test + form test.
- displayName is derived by completeProfile and other Functions (first name + last initial when isMinor) and is never client-written. Verify: rules test.
- Reports metadata owner is the creating user. Verify: rules test.
- E1 reset safety: resetDemoData is a callable Function requiring the admin claim AND env DEMO_MODE=true; it refuses otherwise. Verify: Function tests for both refusals.
- E2 .ics: per-shift download (no subscribed feed), TZID America/Chicago with VTIMEZONE, stable UID = signupId@app, cancelled signups export METHOD:CANCEL. Verify: unit test on output.
- E3 storage and scope: text-size and contrast preferences stored in localStorage, copied to users/{uid}/private when signed in; tokens.css defines a [data-contrast=high] token set; axe reports zero serious/critical issues on Explore, Opportunity, Dashboard, Kiosk, and Verify. Verify: Playwright + axe.
- React Bits vendoring: each installed component is edited to use token-mapped Tailwind classes (no hardcoded hex) before use. Verify: CI grep check fails on hex colors in src/components/bits.
- Whole-series signup does not auto-extend into newly materialized weeks; the volunteer sees a "Series signup covers through DATE" note and a one-click extend action. Verify: unit test.
- Tier assignment: Tier 1 also includes E1, E2, E3, E4, the deterministic shift planner, reliability score, admin claim, and recurring series. Tier 2 also includes the notifications bell, saved items, and cookie consent. Verify: Phases section.
- Cited sources: VolunteerHub "Volunteer No-Shows" (about 1 in 4) and Zeffy volunteer retention guide (about 30%), plus the FBLA guideline quote. Verify: README links.
- PWA is removed from Tier 3 (not approved). Verify: plan text.
- Baseline edits (second batch): Phase 3 rewritten as a tiered build with the full Functions list; Quality and Docs phases extended (DEMO.md, TODOS.md, rules/Function/e2e/axe tests, gitleaks); admin uid line uses the custom claim. Verify: Implementation plan text.
- Check-in window: checkIn is accepted from start minus 30 min until scheduled end; otherwise it returns "Check-in for this shift is not open right now." Both checkIn and checkOut require the current kiosk code. Kiosk codes rotate every 30 s; the current and previous window are accepted. Verify: Function tests for early, valid, late, and stale-code cases.
- Complete Function and trigger ownership (Tier 1 unless noted): createInvite (owner); redeemInvite; supersedeLetters (Firestore trigger on hoursLogs writes); runDueJobs (scheduled every 5 min, also admin-callable) which idempotently runs waitlist cutoff, finalizeShift, and extendSeries for due instances; recomputeVolunteerStats (trigger on hoursLogs/signups writes) owns totalApprovedHours, orgsHelpedCount, badges, streak, and reliability; extendSeriesSignup (volunteer callable); submitManualHours (volunteer callable, creates pending log); createInstance/updateInstance (coordinator callables that also create instanceSecrets, so clients never write instances directly). Verify: each has a Function test; Phase 3 D list matches.
- Rules rows added: opportunities/series/instances (public read; writes only via coordinator Functions); hoursLogs (volunteer and org coordinators read; Function write only); users/{uid}/lists (owner read/write; public read when published); reviews coordinator response (org coordinator may update only the response field). Verify: rules tests incl. denied cases.
- users/{uid}/private client writes are limited to allowlisted preference keys (textSize, contrast, notificationPrefs, milestonesSeen); birthDate, isMinor, fullName, and reliability are Function-only. Verify: rules test denies client write of isMinor.
- Reliability lives in users/{uid}/private (visible to the volunteer) and is copied into each signup's contact snapshot for that org's coordinators; it is never public. This replaces the earlier "reliability on users/{uid}" wording. Verify: rules test + Function test.
- Signup enforces opportunity minAge against the volunteer's private birth date ("You must be at least N to join this shift."). Verify: Function test.
- Coordinator shift changes: cancelling a shift cancels all signups with cancelReason org-cancelled (excluded from reliability), notifies volunteers, and .ics exports METHOD:CANCEL with STATUS:CANCELLED and SEQUENCE+1. Reducing capacity below signupCount is rejected ("Remove volunteers first"). Editing time after signups exists bumps SEQUENCE, notifies volunteers, and recomputes cutoff/finalize times. Verify: Function tests.
- Letters: issueLetter is volunteer-callable with scope (orgId or all orgs, date range). A newer letter with the same volunteer + scope supersedes the older one; supersedeLetters also marks letters superseded when a counted log changes. Verify: Function tests.
- R2-24 bullet: the design doc's coaching section wording ("took all four add-ons") is a doc-only fix with no code. Verify: design doc text.
- TODOS.md contains the three CEO deferrals: coordinator CSV roster import, Spanish UI, training/certification prerequisites. Verify: file contents.
- State machine (supersedes the earlier transition list): waitlisted->confirmed (signup/cancel Functions), waitlisted->cancelled (volunteer, runDueJobs cutoff), confirmed->cancelled (volunteer, org cancel), confirmed->checked-in (checkIn), checked-in->completed (checkOut, finalizeShift), confirmed->no-show (finalizeShift), confirmed->excused (finalizeShift late-promotion), no-show->excused (coordinator), no-show->completed and completed->no-show (setAttendance, coordinator). All others rejected. Verify: state-machine unit test enumerating allowed and rejected pairs with actors.
- System cancellations (cancelReason waitlist-cutoff or org-cancelled) keep lateCancel = false and are excluded from reliability. Verify: unit test.
- Tier 1 notification surface: a minimal in-app notifications list on Profile plus a header badge count (Tier 1); the richer bell menu with AnimatedList stays Tier 2. Verify: e2e test sees a promotion notification.
- shiftPlannerParse (AI) is Tier 2; Tier 1 ships the deterministic parser client-side plus askAssistant. Verify: Phase list.
- Letter revocation reason is an enum (issued-in-error, hours-disputed, duplicate, other) plus an optional private note; /verify shows the enum label only. Verify: Function + component test.
- Hours formula (supersedes earlier wording): minutes = min(checkOutAt, scheduledEnd + 30 min) minus max(checkInAt, scheduledStart minus 30 min), floored at 0, rounded to the nearest 15 min. For finalizeShift auto-completion, checkOutAt = scheduledEnd. Verify: table-driven unit test.
- Reliability formula (restated): over the volunteer's last 20 finished signups excluding excused, early-cancelled, and system-cancelled ones, reliability = attended / (attended + noShows + 0.5 x lateCancels); under 3 finished signups shows "New volunteer" and ranking uses 0.8. Verify: unit tests.
- Org verification: only an admin (custom claim) sets verified = true via a verifyOrganization Function on an admin page; rules require verified == false on any non-admin update that changes name or EIN. Verify: rules + Function tests.
- E4 and streaks: milestones seen are stored in users/{uid}/private.milestonesSeen so each celebration shows once; streak = consecutive weeks with at least one approved hours log, computed by recomputeVolunteerStats. Verify: unit tests.
- E2 cancel: cancelled signups keep a "Download cancellation" link that exports METHOD:CANCEL, STATUS:CANCELLED, SEQUENCE+1. Verify: unit test.
- Emulator scheduling: scheduled triggers do not fire on the emulator, so DEMO.md and the admin page include a "Run due jobs now" action that calls runDueJobs; the LAN fallback rehearsal uses it. Verify: DEMO.md + Function test.
- Tailwind 4 (supersedes Tailwind 3 wording): use Tailwind CSS v4 with `@theme` variables defined from src/styles/tokens.css, matching the shadcn/React Bits registry. Verify: build passes and a token change restyles a vendored React Bits component.
- health Function is kept from Trove (used by DEMO.md pre-flight check). Verify: Function test.
- Authoritative Phase 3 D Functions list (supersedes the D list in Phases): registerOrganization, verifyOrganization (admin), createInvite, redeemInvite, completeProfile, updateProfile, upsertOpportunity, upsertSeries, createInstance, updateInstance, cancelInstance, signup, cancelSignup, extendSeriesSignup, issueKioskCode, checkIn, checkOut, finalizeShift (callable), setAttendance, approveHours, rejectHours, submitManualHours, issueLetter, revokeLetter, supersedeLetters (trigger), recomputeVolunteerStats (trigger), runDueJobs (the ONLY scheduled Function, every 5 min, also admin-callable; it calls the cutoff, finalizeShift, and extendSeries handlers), extendSeries (callable), rankVolunteers, markNotificationsRead, askAssistant (Tier 1), shiftPlannerParse (Tier 2), resetDemoData, reports PDF, turnstileVerify, health. Verify: Functions index exports exactly this list; one test file per Function.
- Series and opportunity writes go only through upsertOpportunity/upsertSeries/createInstance/updateInstance/cancelInstance (supersedes "series coordinator write" in the earlier rules bullet); rules deny all client writes to opportunities, series, and instances. Verify: rules tests.
- Profile fields: interests, skills, availability, phone, and fullName live in users/{uid}/private and are written by completeProfile and updateProfile (validated with zod: interests from the CauseArea enum, skills max 20 items of 40 chars, availability as weekday + time-block flags, phone E.164). Verify: Function tests for valid and invalid input.
- Streak is stored on the public users/{uid} doc as streakWeeks (added to the public allowlist) and written only by recomputeVolunteerStats. Verify: rules test denies client write.
- isMinor is recomputed by recomputeVolunteerStats and by runDueJobs daily, so it flips on the 18th birthday. Verify: unit test with a birthday boundary.
- Signup window: signup and confirmed booking are allowed until the 2 h cutoff; after the cutoff, signup is allowed only if seats remain (walk-up) until start; never after start. Whole-series signup confirms where seats exist, waitlists where the waitlist has room, and skips full ones, then reports a per-date summary. Verify: Function tests.
- setAttendance covers no-show to excused, no-show to completed (creates an approved HoursLog with coordinator-entered minutes), and completed to no-show (marks the HoursLog rejected, which triggers supersedeLetters). Verify: Function tests.
- approveHours and rejectHours (reason required) are coordinator-only; rejected logs never count. Verify: Function tests.
- Unverified orgs can publish shifts (marked "Unverified" in UI), but their hours are excluded from letters and /verify shows only hours from verified orgs. Verify: Function test for issueLetter excluding unverified-org hours.
- Notifications read state: markNotificationsRead (owner callable) sets read = true; clients never write notifications directly. Verify: Function test + rules deny.
- Late cancels by waitlisted volunteers do not count toward reliability (only confirmed signups can be late-cancelled). Verify: unit test.
- checkIn/checkOut attempts are limited to 10 per user per 10 minutes; excess returns "Too many attempts, wait a minute." Verify: Function test.
- Org cancellation transitions (supersede the state machine actors): waitlisted->cancelled and confirmed->cancelled include actor cancelInstance; checked-in->completed includes cancelInstance mid-shift (hours to the cancel time, needsReview). Verify: state-machine test.
- finalizeShift and extendSeries are callable handlers only; runDueJobs is the only scheduler (supersedes "scheduled + callable" wording). Verify: Functions index.
- All-orgs letters: "issuing-org coordinators" means coordinators of every org whose hours the letter counts; any of those orgs' owners or an admin may revoke. Same scope means exact match of orgId (or ALL) and date range; overlapping different ranges are separate letters. Verify: Function tests.
- Contact snapshots on open (future) signups are refreshed by recomputeVolunteerStats; past signups keep their snapshot frozen. Verify: Function test.
- Org archive rule: recomputeVolunteerStats and the signup/letter Functions maintain organizations/{id}.hasActivity = true; rules deny delete when hasActivity is true and allow setting archived = true instead. Verify: rules tests.
- Emulator config: Phase 1 hand-writes firebase.json with emulator ports (auth 9099, firestore 8080, functions 5001, storage 9199, ui 4000), rules/index paths, and functions source, with no .firebaserc; scripts pass --project demo-fbla2027. Verify: npm run emulators starts.
- Kiosk lock: the kiosk route hides the app shell and nav, intercepts browser back with a confirm, and exits only through re-authentication. Verify: e2e test.
- Signed-out Help: BM25 article search only; the "Ask" box prompts sign-in. Verify: component test.
- Reviews use doc id = signupId, so there is one review per signup. Verify: rules test denies a second create.
- Ranking: rankVolunteers (coordinator callable, Tier 1) ranks the coordinator's org's past volunteers plus volunteers who opted into discovery (notificationPrefs.discoverable) using match score + reliability server-side and returns display names only; the client-side deterministic parser only drafts the opportunity. Volunteers' own "recommended shifts" are ranked client-side from their private profile (no reliability needed). Verify: Function test.
- .ics cancellation is best-effort: documented in DEMO.md and the help article as not reliably applied by Google Calendar imports; the UI tells users to delete the event if their calendar does not. Verify: help article text.
- CEO summary Reviewer Concerns updated with the round-3 findings and their resolution bullets. Verify: CEO summary text.
- Consolidated spec: before Phase 3 starts, write docs/SPEC.md as one contradiction-free spec (no "supersedes" lines), with an appendix mapping R2-x concerns and CEO/spec-review batches to sections. Plan bullets marked "supersedes" are resolved in SPEC.md in favor of the later bullet. Verify: grep finds no "supersedes" in docs/SPEC.md; Eng review reads SPEC.md.
- Shared domain module: a repo-root shared/ TypeScript folder holds zod schemas, the state machine, hours/reliability/ics math, and an injectable clock; both the client and Functions import it. Verify: no duplicate schema definitions (grep) and unit tests live in shared/.
- Competitor positioning: README/RUBRIC_MAP include a table vs SignUpGenius, VolunteerHub, Galaxy Digital, and paper logs, plus a rehearsed 20-second "why not SignUpGenius" answer in DEMO.md. Verify: doc text.
- Human explainers: DEMO.md assigns each Tier 1 Function and the kiosk HMAC, waitlist transaction, and letter verification to a named team member who can explain it. Verify: DEMO.md table.
- T1 kiosk QR: the kiosk shows a QR encoding the same rotating HMAC code (plus instanceId) next to the typed code; the volunteer phone scans it with the in-app scanner; typed entry stays as fallback. Verify: e2e test using the typed path; component test renders QR.
- T2 promotion release: the promotion notification has a one-tap "Can't make it" that cancels without lateCancel and promotes the next person if before cutoff. Verify: Function test.
- T3 reliability guardrails: coordinator-only, shown with its inputs, records older than 12 months dropped, never used to block signup, and volunteers can request review. Verify: unit + rules tests.
- T4 org trust: coordinators of unverified orgs see display names only (no contact snapshot) for minors until verified. Verify: Function test on signup snapshot.
- T5 Tier 0: inside Tier 1, build order starts with the demo loop only (signup/waitlist, kiosk code/QR, check-in/out, finalizeShift, hours, issueLetter + /verify, one report, Q&A with BM25) and its rules; the rest of Tier 1 follows. Build order only, no cuts. Verify: Tier 0 e2e passes first.
- Indexes: signups(instanceId,status), hoursLogs(uid,status,date), instances(orgId,start), letters(uid,issuedAt) in firestore.indexes.json. Verify: emulator queries succeed without index errors.
- Observability: Functions log structured JSON {fn, uid, instanceId, outcome, ms, requestId}; jobRuns collection (admin read) shows runDueJobs history; client error toasts show requestId; shared toUserError maps HttpsError codes. Verify: unit test on toUserError + log shape test.
- Feature flags AI_ENABLED and DEMO_MODE via Functions env; deploy order rules+indexes, Functions, Hosting; post-deploy smoke checklist in DEMO.md. Verify: DEMO.md.
<!-- /autoplan-accepted:ceo -->

### Design review (autoplan Phase 2)

**Step 0.** Initial design completeness 4/10: flows and a few state tables exist, but no
per-screen hierarchy, empty/error copy, responsive contract, or kiosk/letter screen specs.
A 10 = every Tier 0/1 screen has a job, ordered content, one primary action, a full state
table, breakpoints, and a11y criteria in docs/SPEC.md. No DESIGN.md (the team's own design
doc will fill it). Existing leverage: old Trove ErrorState/LoadingState/EmptyState,
HelpCenter panel, ReportBuilder SectionSelector, OnboardingTour. Focus: all 7 passes (P1).
Step 0.5 mockups: SKIPPED (taste): the user said visual design comes from their own upcoming
design doc; mockups now would pre-empt it.

**Voices.** Native (Claude subagent, input design 940b8014, full read 1-235): 25 findings
(2 critical, 11 high, 12 medium). Outside (Codex gpt-5.6-terra): completed; recommends
blocking Phase 3 until SPEC.md has Tier 0 screen hierarchy, responsive layouts, and a
state/accessibility matrix.

```
DESIGN OUTSIDE VOICES — LITMUS SCORECARD:
  Check                                    Claude     Codex      Consensus
  1. Brand unmistakable in first screen?   NOT SPEC'D NOT SPEC'D CONFIRMED gap (deferred to team design doc)
  2. One strong visual anchor?             NO         NO         CONFIRMED gap
  3. Scannable by headlines only?          NO         NO         CONFIRMED gap
  4. Each section has one job?             NO         NO         CONFIRMED gap
  5. Cards actually necessary?             NOT SPEC'D NOT SPEC'D CONFIRMED risk (React Bits cards)
  6. Motion improves hierarchy?            NO (no rules) NO (decorative risk) CONFIRMED
  7. Premium without decorative shadows?   NOT SPEC'D NOT SPEC'D NOT SPEC'D
  Hard rejections triggered:               #7 risk (stacked cards app UI)  #7 risk  CONFIRMED risk
```
Classifier: volunteer + coordinator screens = OPERATE (App UI rules); /verify and help =
READ; home for signed-out visitors = PERSUADE (one section).

**Pass 1 Information Architecture: 2/10 -> 8/10.** Gaps: no screen inventory or per-screen
order (F1), no role/nav shell (F2), /verify order (F3). Auto-fixed (structural, P5) via
obligations D1-D3. Remaining: final visual anchor waits on the team's design doc.
```
 Volunteer (mobile-first, bottom tabs: Explore | My Shifts | Impact | Help)
   Explore: [promotion/upcoming banner] -> Recommended (why line) -> search+filters -> orgs
   Opportunity: when/where/seats -> signup button (state matrix) -> description -> org
   My Shifts: next shift + check-in entry -> list -> notifications
   Impact: hours + next milestone -> letters -> track record
 Coordinator (/org/:orgId/*, org switcher shown only with membership; desktop-first)
   Dashboard: Today/next shift [Start kiosk] -> Needs attention -> upcoming -> analytics
 Kiosk (/org/:orgId/kiosk/:instanceId, landscape >=1024, locked)
 Admin (/admin, claim-gated)   Public: /verify/:code (READ), signed-out home (PERSUADE)
```

**Pass 2 Interaction States: 3/10 -> 8/10.** Gaps F4-F9 and Codex list (offline, permission
denied, code rotation mid-entry, stale roster, optimistic vs confirmed). Auto-fixed via D4-D9
and D20. Remaining: exact copy strings are written in SPEC.md during T1.

**Pass 3 Journey & Emotional Arc: 4/10 -> 8/10.**
| Step | User does | User feels | Plan specifies |
|---|---|---|---|
| 1 | Lands on home | "is this for me?" | one-line pitch + Find shifts (D1) |
| 2 | Onboards | impatient | birth date first, skippable steps, progress, ends on 3 matches (D10) |
| 3 | Signs up | relief/uncertainty | button state + waitlist position (D5) |
| 4 | Arrives, checks in | slight nerves | QR/typed, big success with check-out time (D4) |
| 5 | Checks out | proud | "2.5 hours logged" + milestone bar + Get verified letter (D11) |
| 6 | Shares letter | trust | /verify status band (D3) |
Fixes D10-D13. 5-sec: pitch + one action; 5-min: signup to calendar; 5-year: letters that verify.

**Pass 4 AI Slop Risk: 3/10 -> 7/10.** Risks: React Bits everywhere, stacked cards as app UI,
SpotlightCard on every card, CountUp on revisit. Fixes D15 (placement rules), D14 (semantic
status tokens). Capped below 8: the visual direction is deliberately deferred to the team's
design doc (taste decision TD1).

**Pass 5 Design System Alignment: 2/10 -> 6/10.** No DESIGN.md. Fix: semantic status token
map + text-size/contrast/motion token sets + report preset themes (D14, D16, D18, D21).
Remaining: palette/type/brand from the team's design doc; recommend /design-consultation or
their own doc before final polish.

**Pass 6 Responsive & Accessibility: 2/10 -> 8/10.** Fixes D18-D22 plus Codex items (44px
targets, focus restoration, aria-live announcements, non-color status, mobile tables).

**Pass 7 Unresolved design decisions.**
| Decision needed | If deferred |
|---|---|
| Final palette, type pair, brand (team design doc) | interim neutral tokens ship to competition (TD1) |
| Signed-out home content beyond pitch + CTA | generic hero risk; resolve with design doc |
Resolved in this pass: 24 structural decisions (D1-D24). Deferred: 2 (above).

**Taste decisions.** TD1: interim tokens are deliberately neutral (one neutral ramp, one
accent, semantic status colors), NOT a named brand direction, because the team owns visual
identity (native F14 suggested "warm civic editorial"; declined to avoid pre-empting the
team's design doc). TD2: mockups skipped (same reason).

**NOT in scope (design).** Final visual identity, illustrations/imagery, marketing landing
page beyond one section, mockups.

**What already exists (design).** Trove EmptyState/ErrorState/LoadingState, HelpCenter
panel + route context, ReportBuilder (SectionSelector, ColorPicker -> becomes preset picker),
OnboardingTour steps, CommandPalette (Tier 2).

**Design Completion Summary**
```
  | System Audit         | no DESIGN.md; UI scope large (volunteer, coordinator, kiosk, verify) |
  | Step 0               | 4/10, all 7 passes                          |
  | Pass 1  (Info Arch)  | 2/10 -> 8/10                                |
  | Pass 2  (States)     | 3/10 -> 8/10                                |
  | Pass 3  (Journey)    | 4/10 -> 8/10                                |
  | Pass 4  (AI Slop)    | 3/10 -> 7/10                                |
  | Pass 5  (Design Sys) | 2/10 -> 6/10                                |
  | Pass 6  (Responsive) | 2/10 -> 8/10                                |
  | Pass 7  (Decisions)  | 24 resolved, 2 deferred                     |
  | NOT in scope         | written (4 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items proposed                            |
  | Approved Mockups     | 0 generated (skipped, TD2)                  |
  | Decisions made       | 24 added to plan (auto-decided)             |
  | Decisions deferred   | 2 (team design doc)                         |
  | Overall design score | 2/10 -> 6/10                                |
```

**Implementation Tasks (Design)**
- [ ] **T1 (P1, human: ~6h / CC: ~30min)** — docs — Add Screens, state tables, status-token map, motion/a11y, and copy sections to docs/SPEC.md
  - Surfaced by: native F1/F4/F25, Codex SPEC gate
  - Files: docs/SPEC.md
  - Verify: each Tier 0 screen has job, order, primary action, states, breakpoints, a11y criteria
- [ ] **T2 (P1, human: ~3h / CC: ~10min)** — styles — Neutral interim tokens incl. semantic status, text-size, contrast, motion sets
  - Surfaced by: F14/F18/F21
  - Files: src/styles/tokens.css
  - Verify: Playwright at 150% + high contrast + reducedMotion on Tier 0 screens
- [ ] **T3 (P1, human: ~4h / CC: ~20min)** — kiosk — Kiosk + phone check-in state handling incl. offline pause and aria-live
  - Surfaced by: F4, Codex kiosk failures
  - Files: to be determined
  - Verify: e2e for offline, stale code, permission denied
- [ ] **T4 (P2, human: ~2h / CC: ~10min)** — tests — Screenshot tests at 375/768/1440 for Tier 0 screens
  - Surfaced by: F19
  - Files: e2e/
  - Verify: npx playwright test

<!-- autoplan-accepted:design -->
- D1 Screens: docs/SPEC.md gains a Screens section; each Tier 0/1 screen lists its job, above-the-fold content in order, one primary action, and secondary content. Leads: Explore = promotion/upcoming banner, Recommended (one-line why), search + filters, orgs; Opportunity = date/time/place/seats, signup button, description, org; Coordinator Dashboard = Today/next shift with Start kiosk, Needs attention, upcoming, analytics. Phase 3 is gated on this section. Verify: SPEC.md review checklist.
- D2 Navigation shell: volunteer bottom tab bar on mobile (Explore, My Shifts, Impact, Help) and top nav on desktop; coordinator routes under /org/:orgId/* with an org switcher shown only when the user has a membership; admin under /admin gated by claim; kiosk at /org/:orgId/kiosk/:instanceId. Verify: e2e navigation test per role.
- D3 /verify hierarchy: status band first (valid/superseded/revoked with icon + text, never color alone), then display name, total verified hours, date range, orgs, then issue date + code, then "What this means". Verify: component test for all three states.
- D4 Kiosk + phone check-in states: SPEC.md state tables. Kiosk: loading code, 30 s countdown ring, code change announced, offline = dim code + "Reconnecting, codes paused" (never shows an expired code as live), denied, shift not open/ended, empty roster "No arrivals yet", arrival animation, row styles for checked-in/checked-out/no-show/walk-up. Phone: camera denied -> typed entry, QR unreadable, success "Checked in at 9:02, check-out opens 9:17", every Function error string, disabled check-out with available-at time. Verify: e2e for offline, stale code, camera denied.
- D5 Signup button state matrix: Sign up; Join waitlist (#N); Full (disabled); Ages N+ (disabled with reason); Signed up (Cancel, Add to calendar); Waitlisted #N of M; Shift started (disabled); Cancelled by organization. Waitlist position is shown. Whole-series result is a date list with confirmed/waitlisted/skipped chips. No optimistic UI for trusted writes: the button shows pending until the Function returns. Verify: component test per state.
- D6 Empty states, each with one line + one action: Impact at 0 hours shows progress to the first milestone (0/25) not zeros; My Shifts empty -> Find shifts; org with no opportunities; Coordinator Dashboard after registration -> Create your first shift; no pending hours; no notifications; filtered Explore empty -> Clear filters; recommendations with no interests -> Add interests; help search no results -> Ask (signed in) or Sign in; map unavailable -> list only. Verify: component tests.
- D7 Assistant panel: one panel, each answer labeled "From Help Center" or "AI answer, may be wrong"; over-limit copy "You've reached today's assistant limit; here are matching help articles."; character counter at 2,000; signed-out shows article results + Sign in to ask. Verify: component test.
- D8 Letter flow: preview then issue; inline "Hours excluded: N from unverified orgs"; generating/failed (retry)/ready states; one-page PDF layout (header, volunteer, table of orgs and hours, verify URL + QR, issue date) sketched in SPEC.md. Verify: Function + component tests.
- D9 Needs attention queue: one list on the coordinator Dashboard grouped by shift for needsReview logs, pending manual logs, and attendance disputes; approve/reject inline; reject opens a required reason; bulk approve for kiosk-verified rows. Verify: e2e.
- D10 Onboarding: birth date first (under-13 never creates an account where possible) with kind copy pointing to a parent or guardian; skills and availability skippable; progress indicator; ends on "3 shifts that match you". Verify: e2e.
- D11 Demo arc: after checkOut the phone shows "N hours logged at ORG", animated milestone progress, primary CTA "Get verified letter"; "Run due jobs" appears only when DEMO_MODE is on, labeled as a demo control. DEMO.md scripts the arc screen by screen. Verify: e2e + DEMO.md.
- D12 Reliability display: neutral text "Attended 8 of 10 recent shifts", never a colored score badge; "New volunteer" tag; volunteer view titled "Your track record" with Request review; never shown in discovery, public profiles, or kiosk. Verify: component test.
- D13 Promotion visibility: promoted/upcoming signups appear as a banner on Explore ("You're in! Saturday 9 AM: Confirm / Can't make it"); the header badge opens the notification list directly; help text states alerts are in-app only. Verify: e2e.
- D14 Semantic status tokens (interim, neutral; TD1): success = verified/completed, warning = waitlisted/needsReview, danger = revoked/no-show, neutral = cancelled/excused; every status also has an icon + text label. Verify: grep test that status components use status tokens.
- D15 React Bits placement: AnimatedList only for live roster arrivals and notifications; CountUp only for the Impact total and milestone moment (not on every revisit); SpotlightCard only for recommended shift cards; FadeContent only for route transitions. Verify: grep test on component usage locations.
- D16 Report themes: 4-6 preset accent themes from tokens, contrast-checked; no free hex input (replaces Trove ColorPicker). Verify: unit test that every preset passes 4.5:1.
- D17 Shift planner UI: text box with example placeholder; parse fills the structured form inline with parsed fields highlighted and editable; ranked volunteers in a side panel with "why" chips; display names only. Verify: component test.
- D18 Reduced motion: motion tokens with zero durations under prefers-reduced-motion and an in-app toggle stored with E3 preferences; static milestone variant. Verify: Playwright with reducedMotion: reduce.
- D19 Breakpoints: volunteer screens mobile-first at 375px; coordinator desktop-first and responsive (tables become stacked rows under 768px); kiosk landscape at 1024px+ with the code at least 120px tall. Verify: Playwright screenshots at 375/768/1440.
- D20 Accessibility contract: 44x44px minimum touch targets; visible focus states themed from tokens; focus restored after modals, signup submit, scanner failure, and route changes; aria-live announcements for kiosk code changes, waitlist promotion, form errors, roster arrivals, and toasts; status never by color alone; plain, age-appropriate copy. Verify: Playwright keyboard path + axe + aria-live assertions.
- D21 Text scale: 100/125/150% via a root font-size token; Tier 0 screens tested at 150% + high contrast without overflow. Verify: Playwright.
- D22 Error presentation: toUserError returns friendly copy plus a collapsed "Details" with a copyable requestId; expanded by default for coordinators/admins. Verify: component test.
- D23 Unverified org UI: "Unverified" chip with tooltip ("Hours here won't appear on verified letters until this organization is verified") on org and opportunity pages before signup; coordinator roster shows "Contact hidden until your organization is verified" for minors. Verify: component tests.
- D24 Time display: all shift times in the org time zone with a zone label; the signup confirmation and phone check-in screen show "Check-in opens H:MM". Verify: unit test on formatter.
- TD1 interim visual direction: neutral token set only (no named brand direction) pending the team's design doc. TD2 mockups skipped for the same reason. Verify: tokens.css contains no brand palette beyond one accent.
<!-- /autoplan-accepted:design -->

### DX review (autoplan Phase 2.5, DX POLISH)

**Product type:** web app whose developer surface is the repo (local setup, emulators, seed,
Functions, rules, deploy). Mode: DX POLISH (autoplan override).

```
TARGET DEVELOPER PERSONA
========================
Who:       High-school FBLA team member (2-3 people), Windows laptop, repo under OneDrive
Context:   Cloning the repo to build a feature, rehearse the 3-device demo, or explain code to judges
Tolerance: ~10 minutes before asking a teammate or giving up on local setup
Expects:   README with copy-paste commands; app runs without real Firebase keys; demo logins exist
```
Secondary audience: FBLA judges reading README, code comments, and RUBRIC_MAP.

**Empathy narrative (predicted; no code exists yet).** "I clone the repo into my OneDrive
Desktop folder and open the README. It says React + Firebase. I run npm install, then the app
complains about missing VITE_FIREBASE values, so I copy .env.example, but I don't know which
values are safe for local. Someone says run the emulators; the Firestore emulator fails because
I don't have Java. After installing Java I start the emulators, run the seed, start Vite, and
now I'm on a login page with no idea which account is the coordinator. When I finally get in,
the kiosk says the shift isn't open because the seeded shift is tomorrow. Forty minutes in, I
haven't seen the check-in loop once."

**Competitive DX benchmark (estimated; boundaries differ).**
| Tool | Start -> result | Time + evidence type | DX choice | Source |
|---|---|---|---|---|
| SignUpGenius / VolunteerHub | account -> shareable signup | minutes, reported (SaaS, no setup) | hosted, zero install | vendor sites (reported) |
| Typical Firebase+Vite project | clone -> emulator app | 15-30 min, estimated (Java, CLI, env) | emulators + manual steps | Firebase docs (emulators require Java) |
| This plan, current | clone -> seeded demo with 3 logins | 30-60 min, estimated | ~12 manual steps | plan text |
| This plan, target | clone -> seeded demo with 3 logins | <5 min after prerequisites, target | `npm ci` + `npm run demo` | this review |
Target tier: Competitive (2-5 min after prerequisites), auto-decided P5.

**Magical moment.** `npm run demo` starts the emulators, seeds a shift that starts in 10
minutes, and prints three clickable role links (coordinator, kiosk, volunteer) plus the LAN
URL as a QR for phones. Vehicle: existing emulators + seed script (no new service).

**Developer journey map**
```
STAGE        | DEVELOPER DOES                       | FRICTION POINTS                         | STATUS
1. Discover  | Opens README                         | product docs only (fixed: dev quickstart first) | fixed
2. Install   | Node/Java/CLI, npm ci                | no pins, Java unstated, OneDrive (fixed: .nvmrc, engines, doctor) | fixed
3. Hello W.  | npm run demo                         | 3 separate cmds, unknown logins, shift time (fixed: demo cmd, creds table, relative seed) | fixed
4. Real use  | Add a Function / screen              | no template, shared/ deploy break (fixed: defineCallable, bundled functions) | fixed
5. Debug     | Emulator/rules/index/App Check fail  | undesigned dev errors (fixed: doctor, banner, troubleshooting table) | fixed
6. Upgrade   | Bump deps / deploy                   | no policy (fixed: pins, Dependabot, deploy runbook + rollback) | fixed
```

**First-time developer confusion report (predicted, pre-fix)**
```
T+0:00  Clones into OneDrive; README shows rubric map, not setup.
T+0:05  npm install; app errors on missing VITE_FIREBASE_*.
T+0:10  Emulators fail: Java missing.
T+0:25  Emulators up; seed run; Vite up; doesn't know demo logins.
T+0:35  Kiosk: "check-in not open" because seeded shift is tomorrow.
T+0:40  Asks a teammate. (All five points addressed by X1-X12 below.)
```

**DX dual voices — consensus**
```
  Dimension                           Claude  Codex  Consensus
  1. Getting started < 5 min?          No      No     CONFIRMED gap
  2. API/CLI naming guessable?         Partly  Partly CONFIRMED (scripts undefined, surface large)
  3. Error messages actionable?        Users yes, devs no  Same  CONFIRMED
  4. Docs findable & complete?         No      No     CONFIRMED
  5. Upgrade path safe?                No (deploy runbook thin)  No (no policy)  CONFIRMED
  6. Dev environment friction-free?    No      No     CONFIRMED
```
Taste: TD3 Codex suggests a no-emulator `dev:ui` mock-data mode; declined for now (DX POLISH,
new data path; the doctor + one-command demo meets the target) and recorded in NOT in scope.

**Passes (before -> after):** 1 Getting started 3 -> 8; 2 API/CLI 5 -> 8; 3 Errors 5 -> 8;
4 Docs 4 -> 8; 5 Upgrade 2 -> 7; 6 Dev env 3 -> 8; 7 Community 3 -> 5 (school project: MIT
license + CONTRIBUTING note only); 8 DX measurement 2 -> 6 (timed `npm run demo` in CI +
rehearsal log).

**DX Scorecard**
```
| Getting Started      | 8/10 (from 3) |
| API/CLI/SDK          | 8/10 (from 5) |
| Error Messages       | 8/10 (from 5) |
| Documentation        | 8/10 (from 4) |
| Upgrade Path         | 7/10 (from 2) |
| Dev Environment      | 8/10 (from 3) |
| Community            | 5/10 (from 3) |
| DX Measurement       | 6/10 (from 2) |
| TTHW                 | <5 min target (from ~30-60 min est.) |
| Competitive Rank     | Competitive (target)                 |
| Magical Moment       | designed via npm run demo            |
| Product Type         | web app / repo developer surface     |
| Mode                 | POLISH                               |
| Overall DX           | 7/10 (from 3)                        |
```

**DX Implementation Checklist**
```
[ ] Time to hello world < 5 min after prerequisites (npm ci + npm run demo)
[ ] Installation is one command (npm ci at root installs workspaces)
[ ] First run prints role links, demo logins, LAN URL/QR
[ ] Magical moment: seeded shift starts in 10 minutes
[ ] Every error has problem + cause + fix (+ help link for users)
[ ] Script names follow the canonical table
[ ] .env.example works with zero edits for local
[ ] README quickstart copy-paste complete with expected output
[ ] Functions built with defineCallable; recipe documented
[ ] Deploy runbook + rollback rehearsed once
[ ] Node/Java/firebase-tools pinned; Dependabot weekly
[ ] CI runs npm run verify
```

**NOT in scope (DX).** TD3 no-emulator mock mode; public community channels; telemetry on
developer onboarding beyond the CI timer.

**What already exists (DX).** Old Trove: .github/workflows/ci.yml, vitest + playwright
configs, vitest.rules.config.mjs harness, README sections (setup/env/emulator commands),
.env.example pattern, firebase.json emulator config shape.

**Implementation Tasks (DX)**
- [ ] **T1 (P1, human: ~4h / CC: ~15min)** — tooling — npm workspaces + bundled Functions build + emulator smoke test in CI
  - Surfaced by: native E1 (shared/ deploy break)
  - Files: package.json, functions/package.json, .github/workflows/ci.yml
  - Verify: CI job builds functions and passes emulators:exec smoke test
- [ ] **T2 (P1, human: ~3h / CC: ~15min)** — tooling — npm run demo + doctor + zero-edit .env.example + creds table
  - Surfaced by: G1-G5, Codex TTHW
  - Files: scripts/demo.mjs, scripts/doctor.mjs, .env.example, seed
  - Verify: fresh clone to role links in <5 min (timed in CI)
- [ ] **T3 (P1, human: ~3h / CC: ~15min)** — functions — defineCallable wrapper + shared error catalog
  - Surfaced by: E3, R1
  - Files: functions/src/lib/defineCallable.ts, shared/errors.ts
  - Verify: unit tests; every Function uses the wrapper
- [ ] **T4 (P1, human: ~2h / CC: ~10min)** — demo — DEMO_MODE clock offset + relative seed
  - Surfaced by: X1
  - Files: shared/clock.ts, seed
  - Verify: e2e advances clock through check-in and check-out
- [ ] **T5 (P2, human: ~3h / CC: ~15min)** — docs — README quickstart, ARCHITECTURE.md, troubleshooting table, deploy runbook
  - Surfaced by: D1-D3, Codex docs
  - Files: README.md, docs/ARCHITECTURE.md, docs/DEMO.md
  - Verify: teammate follows README cold

<!-- autoplan-accepted:dx -->
- X1 One-command demo: `npm run demo` (via firebase emulators:exec + concurrently) starts emulators, seeds demo data with a shift starting 10 minutes from now, starts Vite on --host, and prints coordinator/kiosk/volunteer links, the demo credentials table, and the LAN URL as a terminal QR. README quickstart is exactly: prerequisites, `npm ci`, `copy .env.example .env.local`, `npm run demo`. Verify: CI times clone-to-ready under 5 minutes after prerequisites.
- X2 Prerequisites pinned: .nvmrc and package.json engines (Node 22, matching the Functions runtime); firebase-tools as a devDependency used via npx (no global install); README lists JDK 21+ for emulators. Verify: doctor checks versions.
- X3 Doctor: `npm run doctor` checks Node version, Java present, ports 9099/8080/5001/9199/4000/5173 free, .env.local present and valid, workspace deps installed, repo not inside a synced OneDrive folder (warn); each failure prints problem, cause, fix. Verify: unit tests on each check.
- X4 Zero-edit env: .env.example ships emulator-safe defaults (VITE_FIREBASE_PROJECT_ID=demo-fbla2027 with dummy apiKey/appId, VITE_USE_EMULATORS=true, Turnstile test keys); Mapbox and AI keys optional and blank; firebase.ts validates env with zod and fails naming the missing variable and pointing to .env.example. Verify: unit test on env validation.
- X5 Demo accounts: seed creates admin, owner/coordinator, adult volunteer, minor volunteer with fixed demo passwords, sets the admin custom claim, and prints them; DEMO_MODE-only "Sign in as..." role switcher on the login screen. Verify: e2e logs in as each role.
- X6 Workspaces + bundled Functions: npm workspaces (root, functions, shared); functions build bundles shared/ with esbuild into functions/lib/index.js so deploy never imports ../shared; CI runs the functions build and an emulators:exec smoke test against the bundle. Verify: CI job.
- X7 Canonical scripts: dev, demo, demo:reset, emulators, seed:demo, doctor, typecheck, lint, test, test:rules, test:functions, test:e2e, check:tokens, check:functions-index, check:spec, verify (runs all; CI calls verify), deploy. All scripts cross-platform (cross-env, rimraf or node scripts; no rm -rf or inline VAR=x). Verify: CI runs on windows-latest and ubuntu-latest.
- X8 defineCallable wrapper: functions/src/lib/defineCallable({name, input: zod schema, auth: signedIn | coordinator(orgId) | admin, rateLimit?, handler}) centralizes auth, validation, rate limits, structured logs, and error mapping; docs include an "Add a new Function" recipe (schema in shared, handler, export, rules row, test). Verify: check:functions-index asserts every export uses the wrapper and matches the authoritative list and the typed client map in src/lib/api.ts.
- X9 Error catalog: shared/errors.ts holds {code, httpsCode, message(params), fix, helpSlug}; Functions throw by code; toUserError maps code to copy + help link; messages carry params (opensAt, retryAfterSec, excess). Verify: unit test that every entry has a message, a fix, and a helpSlug or explicit null.
- X10 Developer failure UX: in dev, firebase.ts probes emulator reachability and shows a banner ("Emulators not reachable on :8080, run npm run demo"); Functions log one clear line when AI_ENABLED is true but the secret is missing, then fall back. docs/DEMO.md has a troubleshooting table (symptom, cause, diagnostic command, fix, when to run demo:reset) covering ports, Java, missing claim, rules denial, missing index, scheduler not running, LAN unreachable/firewall, wrong env keys. Verify: doc review + banner component test.
- X11 App Check in dev/e2e: debug provider via FIREBASE_APPCHECK_DEBUG_TOKEN in dev and Playwright; DEMO.md step registers debug tokens for the 3 demo devices; APPCHECK_ENFORCE and TURNSTILE_ENABLED flags with documented LAN-fallback values. Verify: e2e runs with debug provider.
- X12 Demo clock: DEMO_MODE-only server clock offset (demoClock/global, admin-set) read by shared/clock.ts; admin page "Advance clock 15 min"; seed supports --shift-starts-in. e2e uses the same hook. Verify: e2e walks check-in then check-out via clock advance.
- X13 Config in one place: shared/config.ts holds limits (AI 20/hr 100/day, check-in 10 per 10 min, 2,000 chars, 1,024 tokens, 30 s rotation, 8-week window) with Functions env overrides; DEMO_MODE "Reset rate limits" control. Verify: unit test reads overrides.
- X14 Org time zone: organizations.timeZone (default America/Chicago) used by .ics TZID and all display formatting (supersedes the hardcoded TZID wording). Verify: unit test with a non-Chicago org.
- X15 Kiosk session expiry: a "Kiosk session expired, coordinator sign-in" screen returns to the same instance after re-auth. Verify: e2e with forced token expiry.
- X16 Docs early: Phase 1 ships README quickstart, docs/ARCHITECTURE.md (folder map, one trusted write end to end, tokens, how to add a Function/screen/rules row), and .env.example comments; SPEC.md gets a table of contents, stable anchors (#fn-signup, #rules-signups), and API (callable inputs/outputs/errors/auth/idempotency) and Data Model sections; code comments and tests reference anchors. Help articles live in src/content/help/*.md with slug/tags front matter and are indexed for BM25 at build time. Verify: check:spec and doc review.
- X17 Deploy runbook: DEMO.md "First deploy" and "Competition day" sections with copy-paste commands (project creation, firebase use --add, functions:secrets:set ANTHROPIC_API_KEY, admin-claim script, App Check registration, deploy order, rollback via hosting:rollback and previous Functions commit), rehearsed once before Round 1 with a named owner. Verify: rehearsal log entry in DEMO.md.
- X18 Upgrade policy: lockfile committed; Dependabot weekly for npm and GitHub Actions; React Bits vendored components record their source URL and date in a file header; Tailwind 4 is the only Tailwind version (check:spec greps for "Tailwind 3"); seed data carries a schemaVersion and demo:reset rebuilds it. Verify: CI + check:spec.
- X19 DX measurement: CI records the duration of `npm run demo` readiness on a clean runner and fails over 5 minutes; DEMO.md keeps a rehearsal log (date, devices, issues). Verify: CI job output.
- X20 License and contributing: MIT LICENSE and a short CONTRIBUTING.md (branching, verify before push, how to add a Function). Verify: files exist.
- TD3 no-emulator mock mode declined for now (recorded in NOT in scope).
<!-- /autoplan-accepted:dx -->

### Eng review (autoplan Phase 3, runs last)

**Scope Challenge.** Evidence read from the source repo (`../fblaslc2026_old`):
`functions/package.json` (Node 22, firebase-functions v7, pdfkit, unused genkit devDeps),
`functions/src/index.ts:1038` (single Express `api` onRequest), `src/lib/search/index.ts`
(generic barrel; only `businessAdapter` is domain-specific), `firestore.rules` (366 lines) +
`firestore.rules.test.ts` (483 lines). Complexity check: estimated 150+ changed files and 30+
operations: far above 8 files / 2 services. Scope never reduced (autoplan override P2);
structure question auto-decided toward the smaller arrangement that preserves every feature:
domain-grouped callables (G4) and tier re-sequencing (G5). Result: scope accepted as-is.

**ENG DUAL VOICES — CONSENSUS TABLE**
```
  Dimension                           Claude  Codex  Consensus
  1. Architecture sound?               No (A1-A7)  No (no spec, trust boundary)  CONFIRMED gaps
  2. Test coverage sufficient?         No (T1-T4)  No (invariants per op)         CONFIRMED
  3. Performance risks addressed?      Partly (cold starts, fan-out)  Partly (due-work queries)  CONFIRMED
  4. Security threats covered?         No (IDOR, Turnstile, kiosk, minors)  No (Turnstile, kiosk, retention)  CONFIRMED
  5. Error paths handled?              Partly (idempotency)  Partly (runDueJobs leases)  CONFIRMED
  6. Deployment risk manageable?       No (deploy artifact)  No (demo/CI flakiness)  CONFIRMED
```
Single-voice critical: A1 trigger self-loop (Claude only; verified against plan lines 177/214,
accepted).

**Section 1 Architecture.**
```
   Volunteer phone      Kiosk tablet (custom token, G15)     Coordinator laptop
          \                    |                                  /
           +------------- React SPA (Vite, Tailwind 4, React Bits) -------------+
           | pages/*  hooks/*  lib/data/* (reads, onSnapshot)  lib/api.ts (typed ops)|
           +-----------------------------+------------------------------------------+
                                         | httpsCallable({op, ...})   reads
                                         v                            v
   shared/ (zod schemas, errors, state machine, hours, reliability, ics, clock, config)
         ^ imported by both, bundled into functions deploy dir (G3)
   +---------------- Cloud Functions (Node 22, v2) ----------------------------------+
   | volunteer | coordinator | kiosk | admin | ai   <- defineCallable(op dispatch, G2,G4)|
   | triggers: recomputeVolunteerStats (bounded, G1), supersedeLetters                 |
   | scheduler: runDueJobs (lease + nextActionAt, G8)   reports/PDF (pdfkit, G22)      |
   +----------------------------+-----------------------------------------------------+
                                v Admin SDK (rules do not apply; per-op auth, G2)
              Firestore (rules deny client writes except allowlisted prefs) + Storage
```
Findings A1 (critical), A2 (critical), A3, A4, A5, A6 (high), A7 (medium). Dispositions:
A1-A6 accepted as G1-G5, G17; A7 surfaced as taste TE3.

**Section 2 Code Quality.** Shared-code rubric: the state machine, hours, reliability, and
schemas each have two proven caller sides (client display + Function enforcement) -> shared/
justified (net reduction of duplicated validation). defineCallable centralizes auth/logging
across ~30 operations. Old `functions/src/index.ts` Express mock routes dropped (dead code).
Findings: incomplete idempotency (E3), serverTimestamp vs demo clock (E1), hours over-credit
(E7). Accepted as G6, G8, G12.

**Section 3 Test review.** Framework: Vitest + Playwright + @firebase/rules-unit-testing
(ported harness). Coverage diagram:
```
CODE PATHS                                         USER FLOWS
[+] shared/stateMachine                            [+] Tier 0 demo loop [->E2E]
  ├── [GAP] allowed/rejected pairs w/ actors         ├── [GAP] signup -> kiosk typed code -> check-in
[+] shared/hours, reliability, ics, clock            ├── [GAP] check-out -> hours auto-approved
  ├── [GAP] table tests incl. DST, clamp (G10,G12)   ├── [GAP] letter -> /verify valid/superseded/revoked
[+] functions ops (volunteer/coordinator/kiosk/...)  [+] Coordinator
  ├── [GAP] per-op auth + cross-org denial (G2)       ├── [GAP] needs-attention approve/reject
  ├── [GAP] last-seat race, cancel race (G7)          └── [GAP] kiosk token cannot approve (G15)
  ├── [GAP] retry idempotency (G8)                 [+] Volunteer edge
  └── [GAP] runDueJobs lease overlap (G8)             ├── [GAP] under-13 never creates account (G18)
[+] triggers                                         ├── [GAP] stale code / offline kiosk / camera denied
  ├── [GAP] stats trigger bounded fan-out (G1)        └── [GAP] keyboard-only signup + axe
  └── [GAP] supersede after log change (G19)
[+] rules                                          AI: [GAP] [->EVAL] fallback on 429/bad JSON;
  └── [GAP] every matrix row incl. denied             answers rendered as text (G16)
COVERAGE: 0/22 paths tested (greenfield)  |  GAPS: 22 (4 E2E, 1 eval)
```
Test plan artifact written to disk (see Completion). Regression rule: ported pure modules
(search, consent, lazyWithReload, organicScore) keep their existing tests unchanged.
2am-Friday test: the Tier 0 three-context Playwright run. Hostile QA: concurrent last seat,
replayed kiosk code, cross-org approveHours, client write of isMinor.

**Section 4 Performance.** Cold starts mitigated by grouping (G4) + kiosk minInstances on
demo day. Fan-out bounded (G1). Due-work queries paginated via nextActionAt (G8). Explore
reuses ported paginated queries + search index. PDF 2-5 s at 512 MB (G22). Scale numbers are
estimates (unknown real load; demo scale ~10 users).

**NOT in scope (eng).** Production multi-region, load testing beyond demo scale, email/push
delivery, data export/retention automation (documented manually in privacy page; Codex 11
retention items deferred to TODOS), Identity Platform blocking functions.

**What already exists (eng).** Search engine + tests (reuse), PDF pipeline sections (rewrite
sections, reuse helpers), rules test harness (reuse), CI workflow (extend), lazyWithReload,
consent, ErrorBoundary (reuse). Express api (drop).

**Failure modes registry (eng)**
```
  CODEPATH             | FAILURE                          | TEST? | ERROR HANDLING | USER SEES
  stats trigger        | self-retrigger loop              | G1    | bounded writes | nothing (fixed)
  coordinator ops      | cross-org write (IDOR)           | G2    | permission-denied | error
  deploy               | shared/ import fails in Cloud Build | G3 | CI deploy-dir test | n/a
  runDueJobs           | overlapping runs double-process  | G8    | lease          | nothing
  checkOut retry       | duplicate hours                  | G8    | deterministic id | nothing
  demo clock           | mixed clocks corrupt hours       | G6    | lint + single clock | nothing
  kiosk device         | coordinator session abuse        | G15   | scoped token   | permission-denied
  signup               | Turnstile bypass via Auth REST   | G13   | profile gate   | error
```
0 critical gaps remain after accepted obligations (A1 and A2 were critical; both now have
tests + handling).

**Worktree parallelization**
| Step | Modules touched | Depends on |
|---|---|---|
| Scaffold + shared/ + tooling | root, shared/, scripts/, .github/ | — |
| SPEC.md + PORT_LEDGER | docs/ | — |
| Functions ops + rules | functions/, firestore.rules | Scaffold, SPEC |
| Volunteer UI | src/pages/volunteer, src/components | Scaffold, SPEC |
| Coordinator + kiosk UI | src/pages/org, src/pages/kiosk | Scaffold, SPEC |
| Help/search/reports port | src/lib/search, src/components/help, functions/reports | Scaffold |
Lanes: A = Scaffold -> Functions ops + rules; B = SPEC + ledger (parallel with A's scaffold);
C = Volunteer UI; D = Coordinator/kiosk UI; E = help/search/reports. Execution: A-scaffold and
B first; then A-functions, C, D, E in parallel; merge; Tier 0 e2e gate. Conflict flags:
shared/ (owned by lane A; others consume), firestore.rules (lane A only).

**Eng Completion summary**
- Step 0: Scope Challenge — scope accepted as-is
- Architecture Review: 7 issues found
- Code Quality Review: 3 issues found
- Test Review: diagram produced, 22 gaps identified
- Performance Review: 3 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 3 items proposed (retention/export automation, Identity Platform blocking functions, no-emulator mock mode)
- Failure modes: 0 critical gaps flagged (2 critical findings resolved by G1, G2)
- Unresolved decisions: 0 in this review (UC1, UC2, T6 belong to CEO)
- Outside voice: codex completed
- Parallelization: 5 lanes, 4 parallel / 1 sequential gate
- Lake Score: N/A

**Implementation Tasks (Eng)**
- [ ] **T1 (P1, human: ~3h / CC: ~15min)** — functions — Bounded stats trigger + fan-out test (G1)
  - Surfaced by: Section 1 A1
  - Files: functions/src/triggers/recomputeVolunteerStats.ts
  - Verify: emulator execution-count test
- [ ] **T2 (P1, human: ~4h / CC: ~20min)** — functions — Resource-derived auth in defineCallable + cross-org tests (G2)
  - Surfaced by: Section 1 A2
  - Files: functions/src/lib/defineCallable.ts
  - Verify: cross-org denial test per coordinator op
- [ ] **T3 (P1, human: ~3h / CC: ~15min)** — tooling — Standalone functions deploy dir + CI npm ci check (G3)
  - Surfaced by: A3
  - Files: scripts/build-functions.mjs, .github/workflows/ci.yml
  - Verify: CI job
- [ ] **T4 (P1, human: ~4h / CC: ~20min)** — functions — Transactions, idempotent ids, runDueJobs lease (G7, G8)
  - Surfaced by: E2, E3, Codex 5
  - Files: functions/src/ops/*, functions/src/jobs/runDueJobs.ts
  - Verify: race + retry + lease tests
- [ ] **T5 (P1, human: ~3h / CC: ~15min)** — security — Kiosk custom token, Turnstile-bound profile, minor/org rules (G13-G15, G17, G18)
  - Surfaced by: S1-S3, S5, S6
  - Files: functions/src/ops/kiosk.ts, functions/src/ops/volunteer.ts, firestore.rules, storage.rules
  - Verify: Function + rules tests

<!-- autoplan-accepted:eng -->
- G1 Stats trigger bounded (A1, critical): recomputeVolunteerStats triggers only on hoursLogs writes and on signups writes whose status changed (before/after compare); it writes users docs and refreshes open-signup contact snapshots only when a field value actually differs; snapshot refresh is limited to signups starting within the 8-week window. Verify: emulator test that one signup write causes a bounded number of Function executions and no self-retrigger.
- G2 Resource-derived authorization (A2, critical, IDOR): defineCallable auth resolvers load the target resource (instance, signup, hoursLog, letter, org) and derive orgId from it; orgId is never accepted as a free input when a resource id exists; every coordinator operation has a cross-org denial test. Rules do not bind Admin-SDK Functions, so each operation enforces its own authorization, idempotency, schema, allowed transitions, and audit event, listed in a per-operation table in docs/SPEC.md. Verify: cross-org denial tests + SPEC table review.
- G3 Deploy artifact (A3): the predeploy step emits a standalone functions deploy directory (bundled lib/index.js, package.json with runtime deps only and no shared/workspace entry, its own lockfile); CI runs npm ci in a clean copy of that directory; one real `firebase deploy --only functions` rehearsal happens as soon as the team's Blaze project exists, not on first-deploy day. Verify: CI job + rehearsal log in DEMO.md.
- G4 Domain-grouped callables (A4, taste TE1): operations are grouped into five callable endpoints (volunteer, coordinator, kiosk, admin, ai), each dispatching on an `op` field through defineCallable, with one handler file and one test per operation; kiosk endpoint gets minInstances 1 on competition day only; check:functions-index checks the operation list. Triggers (supersedeLetters, recomputeVolunteerStats) and the runDueJobs scheduler stay separate exports. Verify: functions index test.
- G5 Tier re-sequencing (A6 + Codex 3, taste TE2; no features cut): Tier 0 = seeded users, one shift instance, typed kiosk code check-in/out, finalizeShift, auto-approved hours, one letter template + /verify, BM25 help, and the rules for those collections. Tier 1 adds waitlist, QR scanning, reports, onboarding/Explore polish, E1-E4. Recurring series, rankVolunteers, and shiftPlannerParse move to Tier 2. Nothing outside Tier 0 starts until the Tier 0 e2e passes. Verify: Tier 0 e2e gate in CI.
- G6 Single clock (E1): Functions write explicit clock.now() timestamps (never FieldValue.serverTimestamp, enforced by a lint rule in functions/src); kiosk code windows, check-in/out windows, finalizeShift, runDueJobs, and age checks all read shared/clock.ts; the demo clock offset can only be non-zero when DEMO_MODE is true and the project id starts with "demo-" or a DEMO_MODE env flag is set on a non-production project. Verify: lint rule + e2e that advances the clock and asserts stored hours.
- G7 Races (E2): signup and cancel-promote run in one Admin-SDK transaction over the instance doc (counters + ordered waitlist array + monotonic waitlistSeq); waitlist position derives from waitlistSeq, not createdAt. Verify: emulator tests with N concurrent signups at the last seat (exactly one confirmed) and a cancel racing a signup.
- G8 Idempotency (E3 + Codex 5): HoursLog id = signupId; letter id = hash(uid, scopeKey, requestNonce); per-instance markers cutoffDoneAt and finalizedAt set inside transactions; runDueJobs takes a lease doc (jobLeases/runDueJobs with expiry) so overlapping scheduled/admin runs do not double-process; due work is found via nextActionAt per instance with pagination (200 per tick). Verify: retry tests for checkOut, finalizeShift, issueLetter; concurrent runDueJobs test.
- G9 Indexes from a query catalogue (E4): docs/SPEC.md lists every query; firestore.indexes.json is derived from it, including instances(nextActionAt), hoursLogs(orgId,status), signups(uid,start), letters(uid,scopeKey,status), notifications(createdAt). Verify: emulator runs with index enforcement and no missing-index errors.
- G10 Time zones (E5): use date-fns-tz for all zone math; table tests cross the March and November DST changes with a non-Chicago org for materialization, thresholds, display, and .ics. Verify: unit tests.
- G11 Profile gate (E6): defineCallable rejects every volunteer/coordinator operation until the profile is complete; the client routes such users to onboarding. Age (minor or not) is computed at each server decision from the private birth date; the public display projection is refreshed by completeProfile/updateProfile and on the next stats recompute (no scheduled birthday scan). Verify: Function tests.
- G12 Hours clamp (E7, supersedes the earlier hours formula): minutes = min(checkOutAt, scheduledEnd) minus max(checkInAt, scheduledStart), floored at 0, rounded to the nearest 15 min; coordinators adjust via setAttendance. Verified letters never credit time outside the scheduled window. Verify: table-driven unit test.
- G13 Turnstile bound to profile (S1 + Codex 8): completeProfile requires a Turnstile token verified server-side and consumed once (stored hash with expiry); every useful action requires a completed profile (G11). When TURNSTILE_ENABLED is false (emulator/LAN), this is logged at startup. Verify: Function tests for missing, invalid, and replayed tokens.
- G14 Minor safety (S2): registerOrganization requires an adult; minors cannot sign up for shifts of unverified orgs; coordinators who are minors cannot see adult contact snapshots. Verify: Function tests.
- G15 Kiosk custom token (S3 + Codex 7): startKiosk (coordinator) mints a custom token with claim kioskInstanceId and a 12-hour expiry; with it the kiosk device can only call kiosk ops for that instance and read that instance's roster; the coordinator's own session is not left on the device. Verify: Function + rules tests that the kiosk token cannot approve hours or read other instances.
- G16 AI caps (S4): a global daily counter aiUsage/_global trips AI off when exceeded; AI answers render as plain text (or sanitized markdown), never HTML; the system prompt contains no private data and the model has no tools. Verify: Function test + component test.
- G17 Org updates via Function (A5/S5): updateOrganization callable handles all org edits (rules deny client writes to organizations); verified, hasActivity, archived (one-way), ownerUid stay server-controlled. Storage rules restrict content type (image/* for photos, application/pdf for letters/reports), size under 5 MB, and owner-only paths for letters/reports. Verify: rules tests.
- G18 Under-13 before account (S6): the birth-date gate always runs before Firebase account creation; under-13 users never create an account; if an account somehow exists, deletion also removes any Firestore/Storage data and logs no PII. Verify: e2e + Function test.
- G19 Letter evidence snapshot (Codex 10): issueLetter snapshots the included approved log ids, per-org verification state, totals, date range, renderer version, and PDF object path into the letter doc at issuance; corrections create a new letter version and atomically mark the prior verification projection superseded. Verify: Function test that a later log change does not alter an issued letter's snapshot.
- G20 QR is progressive enhancement (H3 + Codex 7): typed code is the rehearsed primary path; QR scanning is enabled only in a secure context (deployed HTTPS or mkcert TLS on LAN, documented in DEMO.md). Verify: e2e typed path; QR component hidden when not secure.
- G21 HMAC details (S7): compare codes with timingSafeEqual; derive per-instance kiosk secrets with HKDF from a master secret in Secret Manager; force a client token refresh after admin claims are set. Verify: unit tests.
- G22 PDF Function sizing (H2): letters/reports use pdfkit (ported) with embedded fonts and server-side QR; the Function runs with at least 512 MB memory. Verify: Function test renders a letter under the emulator.
- G23 Job alerting (T1): a Cloud Monitoring log-based alert fires on runDueJobs outcome:error or no run in 15 minutes; the admin page and health show the last job run time. Verify: DEMO.md setup step + health test.
- G24 CI timing as a tracked target (T3 + Codex 12): the clone-to-ready timer runs on ubuntu only and reports (does not fail) until rehearsals establish a baseline; the functional suite runs on ubuntu and windows. This replaces the X19 hard-fail wording. Verify: CI config.
- G25 Port disposition ledger (Codex 13): pin the source repo commit (russy457/fblaslc2026 @ f9f6793) and write docs/PORT_LEDGER.md listing every old module/page with port, rewrite, or drop and the reason. Verify: ledger covers every file under src/ and functions/src of the old repo.
- G26 Plan cleanup (Codex 14 + H6): docs/SPEC.md (requirements), TODOS.md (backlog), and the decision log are the build inputs; PORT_PLAN.md's review record is history only and not handed to build agents. Verify: build-agent prompts reference SPEC.md only.
- G27 Test focus (T4): coverage target 100% lines/branches for shared/ (state machine, hours, reliability, ics, clock) instead of counting test files. Verify: vitest coverage threshold in shared.
- TE3 (taste, user environment): recommend moving the repo out of OneDrive before Phase 1 (A7); not applied without the user's say-so.
<!-- /autoplan-accepted:eng -->
