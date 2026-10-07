# Rubric Map

| | |
|---|---|
| Date | 2026-10-06 |
| Event | FBLA 2026-27 Coding & Programming, "Serving the Community: Nonprofit Volunteer Management" |
| App | Pitch In (working name; constant in `src/lib/brand.ts`) |
| Required by | `docs/SPEC.md` 10.14 ("Each rubric row to the screen and file that earns it; competitor table") |
| Status of this doc | Tier 0 is built. Tier 1 is in progress in three parallel lanes (A, B, C). Statuses below reflect that moment and must be refreshed when Tier 1 merges. |

How to read the status column:

| Status | Meaning |
|---|---|
| built (Tier 0) | In the repo now and covered by the Tier 0 e2e gate or unit tests |
| built (Tier 1 lane C) | Built on the lane C branch (AI Q&A, planner parser, legal pages, demo dataset and reset, Tier 1 help articles). Some files may still be landing when this doc is read. |
| in progress (Tier 1) | Being built in lane A or lane B. Paths are the planned ones from SPEC 2.2, 5.1 ("one handler file `functions/src/ops/<op>.ts` per op"), 9.2, and `docs/PORT_LEDGER.md`. They do not exist yet. |
| planned (Tier 2) | Scheduled after Tier 1 (SPEC 1.2). Listed only where it strengthens a row. |

Rubric row names follow the 2026-27 rubric topics as summarized in `docs/designs/volunteer-management-port.md` (110 points: language rationale, comments, modular design, UX and accessibility, intuitive navigation with an interactive help menu, an intelligent feature, syntactic and semantic validation, full prompt coverage explained in the instructions, customizable reports, appropriate data structures). Before Round 1, match each row name to the official rubric sheet wording.

---

## 1. Code quality

| Rubric row | What earns it | Screens | Files | Status |
|---|---|---|---|---|
| Language and stack selection, with justification | TypeScript end to end (React 18 + Vite client, Cloud Functions v2 on Node 22, one `shared/` package imported by both), so a rule like "who may move a signup from confirmed to checked-in" is written once and enforced on the server. Rationale is written in SPEC 1.4 and 2.1. | (none; code walkthrough) | `docs/SPEC.md` (1.4, 2.1, 2.2), `package.json`, `shared/package.json`, `functions/package.json`, `tsconfig.base.json`, `vite.config.ts`, `scripts/build-functions.mjs` | built (Tier 0) |
| Comments and documentation | Every file opens with a header comment that says what it does and which SPEC anchor it implements (for example `SPEC#fn-signup`). Docs: README quickstart, SPEC as source of truth, port ledger, contributing guide, in-app help articles. | `/help` | `README.md`, `docs/SPEC.md`, `docs/PORT_LEDGER.md`, `CONTRIBUTING.md`, `src/content/help/*.md`, file headers such as `functions/src/lib/rateLimit.ts`, `src/lib/validation/formSchemas.ts` | built (Tier 0); `docs/DEMO.md` and `docs/ARCHITECTURE.md` planned (SPEC 10.14) |
| Modularity and code organization | Layers: pages, hooks, `src/lib/data/*` repositories (one per domain), typed callable client, `shared/` domain logic, five grouped Functions endpoints with one handler file per op, all registered through `defineCallable`. Files stay under 800 lines. | (all) | `src/lib/api.ts`, `src/lib/data/*.ts`, `shared/src/index.ts`, `shared/src/ops.ts`, `functions/src/index.ts`, `functions/src/endpoints/{volunteer,coordinator,kiosk,admin,ai}.ts`, `functions/src/lib/defineCallable.ts`, `functions/src/ops/*.ts` | built (Tier 0) |
| Naming and readability | Domain names match the prompt (opportunity, instance, signup, hoursLog, letter). Status labels and error copy come from one catalog. Design tokens instead of literal colors, enforced by a script. | (all) | `shared/src/collections.ts`, `shared/src/errorCatalog.ts`, `src/lib/statusLabels.ts`, `src/styles/tokens.css`, `scripts/check-tokens.mjs` | built (Tier 0) |

## 2. User experience

| Rubric row | What earns it | Screens | Files | Status |
|---|---|---|---|---|
| UX design and accessibility | Status shown by icon plus text, never color alone; 44 px targets; visible focus; aria-live for kiosk codes and form errors; text size 100/125/150%, high contrast, reduced motion; axe scan in e2e. Accessibility statement page. | `/explore`, `/opportunity/:instanceId`, `/me/shifts`, kiosk, `/verify`, `/accessibility` | `src/components/DisplayPreferences.tsx`, `src/store/preferencesStore.ts`, `src/hooks/useReducedMotionPreference.ts`, `src/lib/motionTokens.ts`, `src/components/ui/StatusBadge.tsx`, `e2e/smoke.spec.ts` (axe), `src/pages/legal/AccessibilityPage.tsx` | controls built (Tier 0); accessibility page built (Tier 1 lane C); profile sync of preferences and full E3 contract in progress (Tier 1, lane A) |
| Intuitive navigation | Role-based shell (visitor, volunteer, coordinator, admin), locked kiosk route with no shell, route guards, profile gate to onboarding, friendly 404, footer legal links. | all routes in `src/router.tsx` | `src/router.tsx`, `src/layouts/AppLayout.tsx`, `src/layouts/navItems.ts`, `src/components/guards/RouteGuards.tsx`, `src/pages/NotFoundPage.tsx`, `src/layouts/LegalLinks.tsx` | built (Tier 0); `LegalLinks.tsx` built (Tier 1 lane C); notification badge in progress (Tier 1, lane A); command palette planned (Tier 2) |
| Help and support with intelligent Q&A (interactive assistant) | Help Center with BM25 search, topic browser, route-aware suggestions, keyboard shortcut and slide-out panel. Signed-in users ask a question; the server answers from the top BM25 help articles with citations, and falls back to the top 3 articles when AI is off, over limit (20/hour, 100/day per user plus a global daily cap), or failing. Answers render as plain text. Provider and model set by env (`AI_PROVIDER`, `AI_MODEL`, `AI_ENABLED`). | `/help`, `/help/:slug`, help panel on every page | Tier 0: `src/pages/HelpPage.tsx`, `src/components/help/*`, `src/lib/help/helpSearch.ts`, `src/lib/help/routeContext.ts`, `src/lib/help/answerQuestion.ts`. Lane C: `functions/src/ops/askAssistant.ts`, `functions/src/ai/helpCorpus.ts`, `retrieval.ts`, `systemPrompt.ts`, `aiSettings.ts`, `aiUsage.ts`, `assistantModel.ts`, `providers/anthropicModel.ts`, `providers/openRouterModel.ts`, `assistantAnswer.ts`, `shared/src/schemas/ops/aiOps.ts`, `src/components/help/AssistantPanel.tsx`, `AssistantAnswerView.tsx`, `HelpCenterAnswer.tsx`, `useAssistantAccess.ts` | help center built (Tier 0); AI assistant built (Tier 1 lane C) |
| Input validation (syntactic and semantic, client and server) | Client zod schemas check format ("use 6 digits") and meaning ("a birth date can't be in the future", age 13+). Every op re-validates with shared zod op schemas, then checks state (seat left, check-in window open, valid transition). | `/onboarding`, `/me/shifts` (code entry), `/verify`, `/login` | `src/lib/validation/formSchemas.ts`, `shared/src/schemas/ops/*.ts`, `shared/src/schemas/*.ts`, `shared/src/stateMachine.ts`, `shared/src/shiftWindows.ts`, `functions/src/lib/defineCallable.ts`, `shared/src/plannerParse.ts` | built (Tier 0); planner parser built (Tier 1 lane C); org, shift, and manual-hours forms in progress (Tier 1, lane B) |
| Error handling | One error catalog maps each code to title, message, fix, and help article. UI shows friendly copy plus a copyable request id; route and render errors are caught; dev banner when emulators are unreachable. | every screen | `shared/src/errors.ts`, `shared/src/errorCatalog.ts`, `src/components/errors/ErrorNotice.tsx`, `src/components/ErrorBoundary.tsx`, `src/components/RouteError.tsx`, `src/components/ErrorState.tsx`, `src/components/DevEnvironmentBanner.tsx`, `src/lib/lazyWithReload.ts` | built (Tier 0) |
| Intelligent feature: recommendations and smart filters | Explore ranks recommended shifts with a one-line "why"; smart filters (cause, date, weekday, distance, seats, eligible for my age, verified orgs only) run on the in-house search engine. | `/explore` | built: `src/pages/ExplorePage.tsx`, `src/lib/search/*`; planned: `shared/src/matchScore.ts`, `src/hooks/useExploreFilters.ts`, `src/components/explore/WhyChips.tsx` | list built (Tier 0); recommended and filters in progress (Tier 1, lane A); volunteer ranking planned (Tier 2) |

## 3. Functionality

### 3.1 Addresses the prompt

| Prompt need | What earns it | Screens | Files | Status |
|---|---|---|---|---|
| Recruit volunteers | Browse and search shifts, opportunity page with seats left and a signup button that explains every state, unverified-org chip. | `/explore`, `/opportunity/:instanceId` | `src/pages/ExplorePage.tsx`, `src/pages/OpportunityPage.tsx`, `src/components/shifts/SignupAction.tsx`, `src/lib/signupButtonState.ts`, `functions/src/ops/signup.ts` | built (Tier 0); org pages, saved items in progress (Tier 1, lane A); invites to ranked volunteers planned (Tier 2) |
| Schedule shifts | Coordinators create opportunities and instances; plain-English planner box fills the form; volunteers get a waitlist with auto-promotion and an `.ics` download. | `/org/:orgId/shifts`, `/org/:orgId/shifts/new`, `/me/shifts` | lane C: `shared/src/plannerParse.ts`; lane B planned: `functions/src/ops/upsertOpportunity.ts`, `createInstance.ts`, `updateInstance.ts`, `cancelInstance.ts`, `src/pages/org/OpportunityEditorPage.tsx`, `src/pages/org/ShiftPlannerPanel.tsx`; lane A planned: `shared/src/ics.ts` | parser built (Tier 1 lane C); CRUD in progress (Tier 1, lane B); waitlist and `.ics` in progress (Tier 1, lane A) |
| Track hours | 3-device kiosk check-in with a rotating HMAC code, check-out, server hours formula, auto-approved kiosk hours, finalize no-shows. Manual hours with coordinator approval and disputes. | kiosk, `/me/shifts`, `/org/:orgId/dashboard`, `/impact` | `functions/src/ops/startKiosk.ts`, `issueKioskCode.ts`, `checkIn.ts`, `checkOut.ts`, `finalizeShift.ts`, `functions/src/kiosk/kioskCode.ts`, `shared/src/hours.ts`, `functions/src/shifts/*.ts`, `src/components/kiosk/*`, `src/components/checkin/*`, `src/components/org/RosterTable.tsx` | built (Tier 0); manual hours, approveHours, rejectHours, setAttendance, requestAttendanceReview in progress (Tier 1, lane B); QR scan in progress (Tier 1, lane A) |
| Communicate and notify | In-app notifications (promotion, cancellations, hours approved), header badge, reminders computed from upcoming shifts; help article explains alerts are in-app only. | `/me/notifications`, `/explore`, `/me/shifts` | planned: `src/components/notifications/*`, `functions/src/ops/markNotificationsRead.ts`; built: `src/content/help/*.md` | in progress (Tier 1, lane A) |
| Report | Verified hours letter PDF with public verify page (Tier 0). Volunteer hours report and org participation report (Tier 1). | `/impact`, `/impact/letters/new`, `/verify/:code`, `/impact/report`, `/org/:orgId/reports` | see 3.2 | letters built (Tier 0); reports in progress (Tier 1, lane B) |
| Manage organizations and volunteers | Seeded org with roster and admin page (Tier 0). Org registration with EIN check, invites, members, admin verification, letter revocation and supersede (Tier 1). | `/org/:orgId/dashboard`, `/admin`, `/org/register`, `/org/:orgId/settings` | built: `src/pages/OrgDashboardPage.tsx`, `src/pages/AdminPage.tsx`, `functions/src/ops/revokeLetter.ts`; planned: `functions/src/ops/registerOrganization.ts`, `updateOrganization.ts`, `createInvite.ts`, `redeemInvite.ts`, `removeMember.ts`, `verifyOrganization.ts`, `functions/src/triggers/supersedeLetters.ts`, `src/pages/org/MembersPage.tsx`, `src/pages/org/dashboard/NeedsAttention.tsx` | roster, admin, revokeLetter built (Tier 0); rest in progress (Tier 1, lane B) |

### 3.2 Other functionality rows

| Rubric row | What earns it | Screens | Files | Status |
|---|---|---|---|---|
| Customizable reports | Hours letter PDF (pdfkit, server QR) now. Tier 1 reports: section toggles, date range, 6 contrast-checked preset themes, PDF on the server plus client CSV export from the same shared aggregation. | `/impact/letters/new`, `/verify/:code`, `/impact/report`, `/org/:orgId/reports` | built: `functions/src/letters/renderLetterPdf.ts`, `functions/src/ops/issueLetter.ts`, `src/components/impact/LetterBuilder.tsx`, `src/pages/VerifyPage.tsx`, `functions/src/reports/pdf/helpers/*`; planned: `functions/src/ops/generateVolunteerReport.ts`, `generateOrgReport.ts`, `functions/src/reports/pdf/sections/` (`orgAttendance.ts`, `orgHoursByMonth.ts`, `volunteerSummary.ts`, ...), `src/components/reports/ReportBuilder.tsx`, `ThemePicker.tsx`, `SectionSelector.tsx`, `src/pages/org/OrgReportPage.tsx`, `src/pages/volunteer/HoursReportPage.tsx` | letters built (Tier 0); reports in progress (Tier 1, lane B) |
| Data storage and data structures | Firestore model with server-owned collections and a deterministic signup id. In-house search engine: inverted index, BM25 ranking, trie autocomplete, Levenshtein typo tolerance, geohash plus haversine. Signup state machine with an allowed-transition table. Waitlist as an ordered queue (`waitlistSeq`) promoted in a transaction. Fixed-window rate limit counters. HMAC time-window kiosk codes. | `/explore`, `/help`, kiosk | `shared/src/schemas/*.ts`, `shared/src/collections.ts`, `firestore.indexes.json`, `src/lib/search/invertedIndex.ts`, `bm25.ts`, `trie.ts`, `levenshtein.ts`, `geo.ts`, `searchEngine.ts`, `shared/src/stateMachine.ts`, `functions/src/lib/rateLimit.ts`, `shared/src/kioskCode.ts`, `functions/src/kiosk/kioskCode.ts`, `functions/src/ai/aiUsage.ts` | built (Tier 0); AI usage windows built (Tier 1 lane C); waitlist queue and `shared/src/reliability.ts` in progress (Tier 1, lane A) |
| Security and privacy | Clients read; every trusted write is a callable op that authorizes itself from the resource (Admin SDK bypasses rules). Rules tested row by row. Minors: 13+ only, under-13 stop before account creation, minors cannot join unverified orgs, contact hidden. Turnstile on onboarding. Secrets only in Functions secrets and `.env.local`; gitleaks in CI. Privacy and terms pages. | `/onboarding`, `/privacy`, `/terms`, `/admin` | `firestore.rules`, `storage.rules`, `tests/rules/*.test.ts`, `functions/src/lib/auth.ts`, `functions/src/lib/defineCallable.ts`, `functions/src/lib/secrets.ts`, `functions/src/turnstile/verifyTurnstile.ts`, `functions/src/ops/completeProfile.ts`, `src/components/onboarding/UnderAgeStop.tsx`, `src/lib/underAgeAccount.ts`, `.env.example`, `.github/workflows/ci.yml`, `src/pages/legal/PrivacyPage.tsx`, `src/pages/legal/TermsPage.tsx` | built (Tier 0); legal pages built (Tier 1 lane C); org trust (verification) in progress (Tier 1, lane B) |
| Testing | `shared/` at 100% coverage; one Functions test file per op against emulators (races, idempotency, cross-org denial); rules tests; component tests; Tier 0 three-browser e2e gate; CI on Ubuntu and Windows. AI: op test plus a 18-question retrieval eval set. | (none) | `shared/src/*.test.ts`, `functions/test/*.test.ts`, `functions/src/**/*.test.ts`, `tests/rules/*.test.ts`, `src/**/*.test.ts(x)`, `e2e/tier0.spec.ts`, `e2e/smoke.spec.ts`, `vitest.config.ts`, `vitest.functions.config.ts`, `vitest.rules.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`; lane C: `functions/test/askAssistant.test.ts`, `functions/test/resetDemoData.test.ts`, `functions/src/ai/retrievalEval.test.ts` (18 questions), `e2e/assistantLegal.spec.ts`, `shared/src/plannerParse.test.ts` | built (Tier 0); lane C tests built (Tier 1 lane C); Tier 1 e2e and axe gate in progress (Tier 1) |
| Presentation and demo readiness | `npm run demo` starts emulators and seeds a shift that starts in 10 minutes with role logins. Demo clock (advance 15 min) and Run due jobs let the full loop run live on 3 devices in minutes. Richer E1 dataset and Reset demo data (admin plus `DEMO_MODE` only). | `/login` (role switcher), `/org/:orgId/dashboard` (demo controls), `/admin` | `scripts/demo.mjs`, `scripts/doctor.mjs`, `scripts/seed-demo.mjs`, `functions/src/seed/*.ts`, `shared/src/clock.ts`, `functions/src/ops/setDemoClock.ts`, `src/hooks/useDemoClockSync.ts`, `src/components/org/DemoControls.tsx`, `src/components/auth/DemoRoleSwitcher.tsx`, `src/components/checkin/DemoArc.tsx`; lane C: `functions/src/seed/demoExtras.ts`, `functions/src/ops/resetDemoData.ts`, `functions/src/seed/applyDemoSeed.ts`, `scripts/demo-reset.mjs`, `src/components/admin/ResetDemoDataControl.tsx` | built (Tier 0); dataset and reset built (Tier 1 lane C); `docs/DEMO.md` planned |

### 3.3 Headline features (presentation talking points)

| Feature | Screens | Key files | Status |
|---|---|---|---|
| H1 Live 3-device check-in (rotating 6-digit code, live roster) | kiosk, `/me/shifts`, `/org/:orgId/dashboard` | `functions/src/kiosk/kioskCode.ts`, `functions/src/ops/checkIn.ts`, `src/components/kiosk/KioskScreen.tsx`, `src/hooks/useKioskCode.ts` | built (Tier 0); QR in progress (Tier 1, lane A) |
| H2 Shift planner (plain English to draft shift) | `/org/:orgId/shifts/new` | `shared/src/plannerParse.ts` | parser built (Tier 1 lane C); planner UI in progress (Tier 1, lane B); AI parse and ranking planned (Tier 2) |
| H3 Verified hours letters with `/verify` | `/impact`, `/verify/:code` | `functions/src/ops/issueLetter.ts`, `functions/src/letters/*.ts`, `src/pages/VerifyPage.tsx` | built (Tier 0); supersede trigger in progress (Tier 1, lane B) |
| H4 Waitlist auto-promotion and fair reliability record | `/opportunity/:instanceId`, `/impact`, roster | planned: `shared/src/reliability.ts`, changes to `functions/src/ops/signup.ts` and `cancelSignup.ts` | in progress (Tier 1, lane A) |

---

## 4. Competitor comparison

Competitor cells describe typical, publicly described capabilities as of 2026, stated with hedges on purpose. Plans and features change and differ by tier. **The team must re-check every competitor cell against each vendor's current site before presenting**, and should say "as far as we found" when asked.

| Capability | Pitch In | VolunteerHub | SignUpGenius | Golden | Better Impact | Galaxy Digital | Paper sign-in sheets |
|---|---|---|---|---|---|---|---|
| Live 3-device kiosk check-in with rotating code | yes (built, Tier 0) | kiosk check-in typical; rotating code not typical | check-in on some plans (varies); rotating code not typical | mobile/kiosk check-in typical; rotating code not typical | kiosk check-in typical; rotating code not typical | kiosk check-in typical; rotating code not typical | no (anyone can sign any name) |
| Verified hours letters with public verification page | yes (built, Tier 0) | hour reports typical; public verify page not typical | not typical | hour records typical; public verify page not typical | hour records typical; public verify page not typical | hour records typical; public verify page not typical | no (signature only) |
| Waitlist auto-promotion | yes (Tier 1) | varies | waitlist on some plans (varies) | varies | varies | varies | no |
| Reliability record (fair, with excused and late-promotion rules) | yes (Tier 1) | attendance history typical; fairness rules not typical | partial (attendance only, varies) | partial | partial | partial | no |
| Minor-safety rules (13+, no unverified orgs for minors, hidden contact) | yes (Tier 0 and 1) | varies (configurable) | not typical | varies | varies (configurable) | varies | no |
| Plain-English shift planner | yes (Tier 1 parser; AI Tier 2) | not typical | not typical | not typical | not typical | not typical | no |
| In-app help with Q&A assistant | yes (Tier 1) | help center typical; in-app assistant varies | help center typical; in-app assistant varies | help center typical; in-app assistant varies | help center typical; in-app assistant varies | help center typical; in-app assistant varies | no |
| Customizable reports (PDF and CSV) | yes (letters Tier 0; reports Tier 1) | yes (typical) | exports on paid plans (varies) | yes (typical) | yes (typical) | yes (typical) | manual tally |
| Free for small nonprofits and students | yes (open source, MIT) | paid (typical) | free tier with limits (typical) | free plan described (verify) | paid (typical) | paid (typical) | yes |
| Accessibility controls (text size, high contrast, reduced motion in app) | yes (Tier 0 controls; Tier 1 sync) | not typical as in-app toggles | not typical as in-app toggles | not typical as in-app toggles | not typical as in-app toggles | not typical as in-app toggles | n/a |

### 4.1 Cited stats (as SPEC 10.14 states them)

| Claim | Source | Use |
|---|---|---|
| About 1 in 4 scheduled volunteers no-show or cancel | VolunteerHub, "Volunteer No-Shows" | Why waitlist auto-promotion, reliability, and `.ics` reminders matter |
| About 30% of volunteers do not return | Zeffy volunteer retention guide | Why verified letters, milestones, and low-friction signup matter |
| "no more than three personal devices" | FBLA 2026-27 Coding & Programming guidelines | Why the demo is exactly three devices |

Add the exact URLs and access dates to README before Round 1; quote the stats as "about", not as precise figures.

### 4.2 The 20-second "why not SignUpGenius" answer

> "SignUpGenius is great at one thing: a sign-up sheet. A nonprofit still has to prove who actually showed up, count the hours, and give students a letter a counselor will trust. Our app does the whole loop: the kiosk code proves the volunteer was there, hours are calculated by the server, the letter has a code anyone can check at /verify, and a waitlist fills no-show seats automatically. And it's free and built with minors' safety rules from day one."

Rehearse it in `docs/DEMO.md` (planned) and assign it to a named team member.
