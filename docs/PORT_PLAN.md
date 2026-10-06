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
Firebase (Auth, Firestore, Storage) on the free Spark tier, Cloud Functions (Express) for the
PDF report pipeline + Turnstile verification, Vitest + Playwright, Recharts, Mapbox GL.

## Domain mapping
| Trove concept | New concept | Notes |
|---|---|---|
| Business | **Organization** (nonprofit) | name, mission, cause category, city/address, coords, photos, contact, verified 501(c)(3) EIN (validated format) |
| BusinessCategory | **CauseArea** | Hunger & Food Security, Education & Youth, Health & Wellness, Environment, Animal Welfare, Housing & Homelessness, Seniors, Arts & Culture, Disaster Relief, Community Development |
| Deal | **Opportunity / Shift** | title, description, date/start/end, location, capacity (`maxClaims`→`capacity`), `claimedCount`→`signupCount`, required skills, min age, type (One-time, Recurring, Virtual, Skilled) |
| DealClaim (token) | **Signup** (check-in code) | status: signed-up → checked-in → completed / no-show / cancelled; token = check-in code |
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
| Onboarding tour + onboarding page | Kept; onboarding collects interests (cause areas), skills, availability, age band | |
| Command palette, cookie consent, legal pages, SEO, error boundary, 404, lazyWithReload | Kept, re-texted | |

## Headline features (from the approved design)
1. Live 3-device check-in kiosk (rotating HMAC code, `checkIn`/`checkOut` Functions, locked kiosk route, live roster).
2. AI shift planner (deterministic parser + match ranking always; Claude via Function when a key exists).
3. Verified hours letters (PDF) + public `/verify` page (128-bit code, minimal public fields, superseded status).
4. Waitlist (transactional, auto-promote, 2 h cutoff) + reliability score (defined formula, cold start).
Plus in-app notifications, recurring series/instances, roles/membership/admin claim, minor privacy.

## Phases
1. **Scaffold** — package.json (renamed, deps pruned of dataconnect/lenis/fuse/gemini), Vite/TS
   configs, `.gitignore`, `.env.example`, CI workflow, env-driven `firebase.ts`, neutral
   `styles/base.css`, brand constant. `git init`, remote `russy457/fbla2027`.
2. **Core domain layer** — `src/lib/types.ts`, `firestore.ts` (split by domain into
   `src/lib/data/*.ts` to fix the 1,335-line file), `api.ts`, `appStore.ts`, mock/seed data
   (San Antonio nonprofits), search adapter, match score, validation schemas (zod) in
   `src/lib/validation/`.
3. **Pages & components (parallel agents)** —
   A. Volunteer side: Home, Explore (orgs + opportunities, smart filters), Organization detail,
      Opportunity detail/signup, Saved, Profile, Impact, Onboarding.
   B. Coordinator side: Org auth/portal/register, Dashboard (opportunities CRUD, roster,
      check-in by code, hours approval, analytics), Report builders (user + org).
   C. Community + help: Collections (lists), Impact stories feed, public profiles, Help Center,
      AI chat, command palette, onboarding tour, legal pages.
   D. Backend: Cloud Functions (reports PDF sections rewritten, Turnstile verify, health),
      Firestore + Storage rules for new collections, rules tests, indexes.
4. **Quality** — `tsc -b`, `vite build`, vitest (port all existing pure-logic tests + new tests
   for validation, match score, hours aggregation, report aggregation), fix errors, review.
5. **Docs** — README (setup, features mapped to rubric, libraries + licenses, attributions),
   `docs/RUBRIC_MAP.md`.

## Known issues in old repo to fix during port
- Hardcoded Firebase config + Mapbox secret token in tracked files.
- 1,000–1,500-line files (firestore.ts, ExplorePage, BusinessDetailPage, AuthPage,
  DashboardPage, functions/index.ts) — split to <800 lines.
- Hardcoded admin uid in firestore.rules → env/config placeholder.
- Express endpoints in functions/index.ts served in-memory mock data (dead code) — drop.
- `@dataconnect/generated` local dependency (unused) — drop.

## Out of scope
- Visual design (new design doc), Firebase project creation/deploy, mobile app.
