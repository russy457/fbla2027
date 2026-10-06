# Port Disposition Ledger

- **Source repo:** `russy457/fblaslc2026` ("Trove", 2025-26 FBLA), commit `f9f6793` ("readme change"), read-only clone at `../fblaslc2026_old`.
- **Target repo:** this repo (2026-27 nonprofit volunteer management platform).
- **Date:** 2026-10-06
- **Inputs:** `docs/PORT_PLAN.md` (Implementation plan plus the accepted `ceo`, `design`, `dx`, `eng`, and `gate` blocks), `docs/designs/volunteer-management-port.md`. This ledger satisfies obligation G25. Where the plan and this ledger disagree, `docs/SPEC.md` (once written) wins.
- **Coverage:** the source commit tracks 308 files. Every one appears below with its own row, except `src/dataconnect-generated/**` (15 generated files, one row). Two untracked local build files (`*.tsbuildinfo`) are also listed.

## Legend

| Disposition | Meaning |
|---|---|
| **PORT** | Copy nearly as-is. Adjust imports, naming (Business to Organization, etc.), brand strings, and styling tokens only. |
| **REWRITE** | Keep the idea and structure, rewrite the code for the new domain, trust model (callable Functions), or design system. |
| **DROP** | Not carried over. The reason column says why. |
| **NEW** | Target file with no Trove equivalent (section at the end). |

- "—" in the Target column means there is no target file.
- Tier tags follow plan G5 and the gate block: **T0** = demo loop (seeded users, one instance, typed kiosk check-in/out, finalizeShift, auto-approved hours, one letter + `/verify`, BM25 help, rules for those collections); **T1** = waitlist, QR, reports, onboarding/Explore polish, E1-E4, askAssistant, minimal notifications; **T2** = series, rankVolunteers, shiftPlannerParse, collections, saved items, reviews, command palette, notifications bell, cookie consent, reliability charts; **T3** = SEO polish.
- Target paths are proposals that follow the plan's lane layout (`src/pages/volunteer`, `src/pages/org`, `src/pages/kiosk`, `src/components/help`, `src/lib/data/*.ts`, `shared/`, `functions/src/ops/<endpoint>/<op>.ts`, `functions/src/triggers`, `functions/src/jobs`, `functions/src/reports`). SPEC.md can rename them.
- "Restyle" in a note means: replace Trove classes and `board/` primitives with Tailwind 4 classes mapped to `src/styles/tokens.css` (no hardcoded hex).

---

## 1. Root config and tooling

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `.env.example` | REWRITE | `.env.example` | Emulator-safe defaults (X4): `VITE_FIREBASE_*` with dummy values, `VITE_USE_EMULATORS=true`, Cloudflare Turnstile test keys, optional blank `VITE_MAPBOX_TOKEN` (`pk.` only). Remove `VITE_TROVE_GEMINI_KEY` and `VITE_TROVE_OPENROUTER_KEY` (AI moves server-side). Old file omitted `VITE_TROVE_APPCHECK_KEY` even though `src/lib/firebase.ts` reads it. |
| `.firebaserc` | DROP | — | Points at the old project `fblaslc2026`. No `.firebaserc` until the new project exists (plan constraint); scripts pass `--project demo-fbla2027`. |
| `.gitignore` | REWRITE | `.gitignore` | Keep node/dist/env/Playwright/service-account patterns. Remove Trove artifacts (pinboard, `trovephoto.png`, design-sync, `.bundle`) and line 60, which names a real key file. Add functions deploy dir and `functions/.secret.local`. |
| `CHANGELOG.md` | DROP | — | Trove release history. |
| `CLAUDE.md` | DROP | — | New repo already has its own `CLAUDE.md`. |
| `Coding-and-Programming.md` | DROP | — | 2025-26 FBLA guidelines. The 2026-27 rubric is mapped in `docs/RUBRIC_MAP.md` (NEW). |
| `DESIGN.md` | DROP | — | Trove cork-board visual system (cut by plan constraint). |
| `LocalRoot_Design_Document.docx` | DROP | — | Last year's design document. |
| `LocalRoot_Project_Outline.docx` | DROP | — | Last year's outline. |
| `PRODUCT.md` | DROP | — | Trove product register. Product description moves to README and SPEC. |
| `README.md` | REWRITE | `README.md` | Quickstart exactly as X1, features mapped to rubric, libraries + licenses (MIT, React Bits MIT + Commons Clause), cited stats (VolunteerHub, Zeffy), FBLA device quote. |
| `SECURITY_AUDIT_2026-06-18.md` | DROP | — | Historical audit. Use its findings (F1-F22) as a checklist only. Do not copy: lines 116 and 278 still contain the tail of the revoked Mapbox `sk.` token. |
| `Trove-Technical-Booklet.pdf` | DROP | — | Trove deliverable. |
| `apply-yelp-photos.mjs` | DROP | — | One-off Yelp photo migration against the old project; hardcodes OAuth client id/secret (line 26-28). Yelp images contradict the seed README's "no Yelp scraping" compliance claim. |
| `firebase.json` | REWRITE | `firebase.json` | Hand-written (no init): emulators auth 9099, firestore 8080, functions 5001, storage 9199, ui 4000. Remove `dataconnect` block and the `/api/**` rewrite to `api`. Functions predeploy builds the bundled standalone deploy dir (G3). Keep security headers; fix CSP (drop `openrouter.ai`, add `default-src`/`script-src`). |
| `firestore.indexes.json` | REWRITE | `firestore.indexes.json` | Business/deal indexes do not apply. Derive from the SPEC query catalogue (G9): signups(instanceId,status), signups(uid,start), hoursLogs(uid,status,date), hoursLogs(orgId,status), instances(orgId,start), instances(nextActionAt), letters(uid,issuedAt), letters(uid,scopeKey,status), notifications(createdAt). |
| `index.html` | REWRITE | `index.html` | Title/description from the brand constant. Remove Fraunces + Satoshi font links and `images.unsplash.com` / `api.fontshare.com` preconnects. `theme-color` from tokens. |
| `migrate.ts` | DROP | — | Contains a hardcoded Mapbox secret token (line 473) and targets the old project. |
| `package-lock.json` | DROP | — | Regenerated by npm workspaces (root, functions, shared). Lockfile is committed (X18). |
| `package.json` | REWRITE | `package.json` | Rename, `engines.node` 22, workspaces, X7 scripts (`demo`, `doctor`, `verify`, ...). Remove unused deps: `@dataconnect/generated`, `@google/generative-ai`, `@radix-ui/react-tabs`, `fuse.js`, `lenis`, duplicate `playwright`, `@testing-library/react` (unused now; keep only if component tests use it). Move `autoprefixer`/`postcss`/`tailwindcss` to devDependencies (Tailwind 4). Add `firebase-tools` devDep, `date-fns-tz`, `cross-env`. |
| `playwright.config.ts` | REWRITE | `playwright.config.ts` | Old suite ran against LIVE Firestore (comment line 20). New: run against emulators + seeded demo, App Check debug token (X11), projects for 375/768/1440 and `reducedMotion: reduce`, axe. |
| `postcss.config.cjs` | DROP | — | Tailwind 4 uses `@tailwindcss/vite`; no PostCSS config needed. |
| `tailwind.config.cjs` | DROP | — | Trove palette and fonts. Tailwind 4 reads `@theme` variables defined from `src/styles/tokens.css`. |
| `tsconfig.json` | PORT | `tsconfig.json` | Add project reference for `shared/`. |
| `tsconfig.app.json` | PORT | `tsconfig.app.json` | Same strict options; add `shared` path alias. |
| `tsconfig.node.json` | PORT | `tsconfig.node.json` | Include `vite.config.*` and `scripts/*.mjs`. |
| `tsconfig.app.tsbuildinfo` (untracked) | DROP | — | Local build output, already gitignored. |
| `tsconfig.node.tsbuildinfo` (untracked) | DROP | — | Local build output, already gitignored. |
| `update-mock-addresses.ts` | DROP | — | Hardcoded Mapbox secret token fallback (line 8); mock-data script. |
| `vite.config.mjs` | REWRITE | `vite.config.ts` | Remove `/api` proxy to `us-central1-fblaslc2026.cloudfunctions.net` (line 28). Keep the `manualChunks` vendor split (drop `motion`/`radix` buckets if unused). Add Tailwind 4 plugin. Keep test excludes. |
| `vitest.rules.config.mjs` | PORT | `vitest.rules.config.mjs` | Change `include` from the single root file to `tests/rules/**/*.rules.test.ts`. |
| `vitest.setup.ts` | PORT | `vitest.setup.ts` | Unchanged. |
| `yelp-photo-backup.json` | DROP | — | Yelp photo URLs for Trove businesses. |
| `yelp-photo-updates.json` | DROP | — | Yelp photo URLs for Trove businesses. |

## 2. dataconnect/ and generated client

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `dataconnect/dataconnect.yaml` | DROP | — | Data Connect is unused by the app. |
| `dataconnect/example/connector.yaml` | DROP | — | Unused sample connector. |
| `dataconnect/example/queries.gql` | DROP | — | Unused sample queries. |
| `dataconnect/schema/schema.gql` | DROP | — | Unused schema. |
| `dataconnect/seed_data.gql` | DROP | — | Unused seed. |
| `src/dataconnect-generated/**` (15 files: `.guides/*`, `README.md`, `esm/*`, `index.cjs.js`, `index.d.ts`, `package.json`, `react/**`) | DROP | — | Generated SDK wired in as `@dataconnect/generated` local dependency; zero imports outside the folder. |

## 3. .github

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `.github/workflows/ci.yml` | REWRITE | `.github/workflows/ci.yml` | Old CI pinned Node 20 (line 29) while Functions require Node 22; did not build Functions, run rules tests, or e2e; `npm audit ... \|\| true` never fails. New: `npm run verify` on ubuntu + windows (X7, G24), bundled Functions build + `emulators:exec` smoke test (X6, G3), rules tests, gitleaks, actions pinned to SHAs (old TODO line 21), clone-to-ready timer (report only, G24). |

## 4. src/lib (core)

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/lib/api.ts` | REWRITE | `src/lib/api.ts` + `src/lib/data/explore.ts`, `src/lib/data/organizations.ts`, `src/lib/geo/geocode.ts` | 953 lines (over 800): split. `api.ts` becomes the typed callable client map (X8). Explore paging, sorting, home feed, and facets move to `data/explore.ts`; Mapbox geocoding (lines 140-460) to `geo/geocode.ts` using a `pk.` token only. `fetchActiveDeals` becomes upcoming-opportunity queries. T0/T1. |
| `src/lib/api.test.ts` | REWRITE | `src/lib/data/explore.test.ts`, `src/lib/data/organizations.test.ts` | Keep the browse-mode and client-filter cases; drop the yelpcdn/picsum photo cases. |
| `src/lib/auth.ts` | REWRITE | `src/lib/auth.ts` | Keep email/password, Google, reset, email verification. Sign-up must run the birth-date gate before account creation (G18). Phone sign-in (lines 38-226, reCAPTCHA verifier) is not in SPEC; drop unless SPEC adds it. |
| `src/lib/brand.ts` | REWRITE | `src/lib/brand.ts` | Single product-name constant (plan constraint). Drop `troveColorTokens` (colors live in tokens.css). |
| `src/lib/brand.test.ts` | REWRITE | `src/lib/brand.test.ts` | Old test asserts "Trove" naming and a green/sand palette; new test asserts the constant is the only name source. |
| `src/lib/categoryColors.ts` | REWRITE | `src/lib/causeAreas.ts` | CauseArea list + chip token mapping. Old file is only used by dead `home/CategoryBand.tsx`. |
| `src/lib/categoryColors.test.ts` | REWRITE | `src/lib/causeAreas.test.ts` | Same three cases for cause areas. |
| `src/lib/chatSystemPrompt.ts` | REWRITE | `functions/src/ops/ai/systemPrompt.ts` | Dead in Trove (only imported by unused `TroveChat.tsx`). The idea moves server-side: one system prompt for askAssistant, no private data, no tools (G16). Rewrite content for volunteering. T1. |
| `src/lib/cn.ts` | PORT | `src/lib/cn.ts` | Unchanged (shadcn convention). |
| `src/lib/cn.test.ts` | PORT | `src/lib/cn.test.ts` | Kept. |
| `src/lib/consent.ts` | PORT | `src/lib/consent.ts` | Kept; rename storage key from Trove. T2. |
| `src/lib/consent.test.ts` | PORT | `src/lib/consent.test.ts` | Kept. |
| `src/lib/dealCountdown.ts` | REWRITE | `src/lib/shiftCountdown.ts` | Countdown logic reused for "Starts in" and "Check-in opens H:MM" (D24) in the org time zone. T1. |
| `src/lib/dealCountdown.test.ts` | REWRITE | `src/lib/shiftCountdown.test.ts` | Same boundary cases (expired, exactly-now, warning window) plus a DST case (G10). |
| `src/lib/facets.ts` | REWRITE | `src/lib/data/facets.ts` | Facet counts over CauseArea and opportunity type instead of category/subcategory. |
| `src/lib/facets.test.ts` | REWRITE | `src/lib/data/facets.test.ts` | Same cases on new taxonomy. |
| `src/lib/feed.ts` | DROP | — | Impact stories feed cut (gate UC1). |
| `src/lib/firebase.ts` | REWRITE | `src/lib/firebase.ts` | Hardcoded web config (lines 14-22) replaced by zod-validated `VITE_FIREBASE_*` env (X4) with a named-variable error; emulator connect + reachability banner (X10); App Check with debug provider in dev/e2e (X11). Analytics stays consent-gated. T0. |
| `src/lib/firebase.test.ts` | REWRITE | `src/lib/firebase.test.ts` | Keep App Check no-op/enabled cases; add env validation cases. |
| `src/lib/firestore.ts` | REWRITE | `src/lib/data/reviews.ts`, `saved.ts`, `collections.ts`, `profile.ts`, `organizations.ts`, `storage.ts` | 1,335 lines (over 800): split by domain. Client-side trusted writes are removed: `claimDeal` (lines 896-950), `registerBusiness` (753-797), aggregate bumps in `submitReview`, supports. Those become Functions (signup, registerOrganization, triggers). Keep `compressImageClientSide` + `uploadImageBlob` in `storage.ts`. Supports (lines 1220-1335) DROP. `seedBusinessesToFirestore` DROP. |
| `src/lib/firestore.test.ts` | REWRITE | `src/lib/data/storage.test.ts` | Keep the Storage upload cases. The `submitReview` transaction cases are replaced by Function tests for review aggregates (T2). |
| `src/lib/helpArticles.ts` | REWRITE | `src/content/help/*.md` | Articles become Markdown with slug/tags front matter, indexed for BM25 at build time (X16). Rewrite content for volunteers, coordinators, kiosk, letters, `.ics` caveat. T0. |
| `src/lib/helpRouteContext.ts` | REWRITE | `src/components/help/routeContext.ts` | Same route-to-article mapping idea for new routes (`/org/:orgId/*`, `/verify/:code`, kiosk). |
| `src/lib/helpRouteContext.test.ts` | REWRITE | `src/components/help/routeContext.test.ts` | Same cases with new routes. |
| `src/lib/lazyWithReload.ts` | PORT | `src/lib/lazyWithReload.ts` | Kept verbatim (taste reference in plan). |
| `src/lib/lazyWithReload.test.ts` | PORT | `src/lib/lazyWithReload.test.ts` | Kept. |
| `src/lib/lists.ts` | REWRITE | `src/lib/data/collections.ts` | Community Top Lists become coordinator/admin-authored collections (gate UC1). Likes, comments, and reports DROP. T2. |
| `src/lib/mockData.ts` | DROP | — | 2,249 lines of Trove businesses; only imported by unrouted `MigratePage.tsx`. Demo data comes from the new seed. |
| `src/lib/parseCoordinateOverride.test.ts` | PORT | `src/lib/geo/coordinates.test.ts` | Tests `parseCoordinateOverride` (defined in `api.ts` line 112), which moves to `src/lib/geo/coordinates.ts` for org registration. |
| `src/lib/photoCatalog.ts` | DROP | — | Category stock-photo fallback for Trove businesses. |
| `src/lib/photoCatalogData.json` | DROP | — | Data for the dropped photo catalog. |
| `src/lib/recentlyViewed.ts` | DROP | — | Only feeds the cut home rail; not in SPEC. |
| `src/lib/recentlyViewed.test.ts` | DROP | — | Module dropped. |
| `src/lib/reportTypes.ts` | REWRITE | `shared/reports.ts` | Section keys for the volunteer hours report and org participation report, shared by client and Functions so they cannot drift. T1. |
| `src/lib/reviewAggregate.ts` | PORT | `shared/reviewAggregate.ts` | Pure helpers kept; now used by the server-side review aggregate writer. T2. |
| `src/lib/reviewAggregate.test.ts` | PORT | `shared/reviewAggregate.test.ts` | Kept. |
| `src/lib/social.ts` | DROP | — | Follows cut (gate UC1). |
| `src/lib/types.ts` | REWRITE | `shared/types.ts` + `shared/schemas.ts` | Domain types re-modeled (Organization, CauseArea, Opportunity, Series, Instance, Signup, HoursLog, Letter, Review, Collection, Notification) with zod schemas as the source (plan: one schema definition shared by client and Functions). Post/List-comment/Report types DROP. |
| `src/lib/utils.ts` | DROP | — | Duplicate of `cn.ts`; zero imports. |
| `src/vite-env.d.ts` | PORT | `src/vite-env.d.ts` | Add typings for the new `VITE_*` variables. |

## 5. src/lib/search and src/lib/discovery

Domain check: `bm25`, `geo`, `invertedIndex`, `levenshtein`, `searchEngine`, `tokenize`, `trie`, `types`, and `indexArtifactCodec` import nothing from the app domain. Only `businessAdapter`, `businessFixture`, `indexArtifact`, and `index` reference `Business`.

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/lib/search/bm25.ts` | PORT | `src/lib/search/bm25.ts` | Domain-agnostic. Also used for Help Center article search (T0). |
| `src/lib/search/bm25.test.ts` | PORT | `src/lib/search/bm25.test.ts` | Kept. |
| `src/lib/search/businessAdapter.ts` | REWRITE | `src/lib/search/organizationAdapter.ts`, `src/lib/search/opportunityAdapter.ts`, `src/lib/search/helpAdapter.ts` | Same pattern, new records and field weights (name, mission, cause area, skills, city). Coordinates stay [lng, lat]. |
| `src/lib/search/businessAdapter.test.ts` | REWRITE | `src/lib/search/organizationAdapter.test.ts`, `opportunityAdapter.test.ts` | Same assertions on new fixtures. |
| `src/lib/search/businessFixture.ts` | REWRITE | `src/lib/search/fixtures.ts` | Organization and opportunity fixtures. |
| `src/lib/search/geo.ts` | PORT | `src/lib/search/geo.ts` | Domain-agnostic geohash + haversine. Volunteer location uses geohash precision 5 (privacy section). |
| `src/lib/search/geo.test.ts` | PORT | `src/lib/search/geo.test.ts` | Kept. |
| `src/lib/search/index.ts` | REWRITE | `src/lib/search/index.ts` | Barrel re-exports the new adapters. |
| `src/lib/search/indexArtifact.ts` | REWRITE | `src/lib/search/indexArtifact.ts` | Generic loader with adapter-specific fallback. Fix: old rules had no `searchIndex` match, so the artifact read always failed and the error was swallowed (line 41-43). Add a public-read rule or build the index from a public query. |
| `src/lib/search/indexArtifact.test.ts` | REWRITE | `src/lib/search/indexArtifact.test.ts` | Update fallback case to new adapters. |
| `src/lib/search/indexArtifactCodec.ts` | PORT | `src/lib/search/indexArtifactCodec.ts` | Domain-agnostic sharding. |
| `src/lib/search/indexArtifactCodec.test.ts` | PORT | `src/lib/search/indexArtifactCodec.test.ts` | Kept. |
| `src/lib/search/invertedIndex.ts` | PORT | `src/lib/search/invertedIndex.ts` | Domain-agnostic. |
| `src/lib/search/invertedIndex.test.ts` | PORT | `src/lib/search/invertedIndex.test.ts` | Kept. |
| `src/lib/search/levenshtein.ts` | PORT | `src/lib/search/levenshtein.ts` | Domain-agnostic. |
| `src/lib/search/levenshtein.test.ts` | PORT | `src/lib/search/levenshtein.test.ts` | Kept. |
| `src/lib/search/searchEngine.ts` | PORT | `src/lib/search/searchEngine.ts` | Domain-agnostic (246 lines). |
| `src/lib/search/searchEngine.test.ts` | PORT | `src/lib/search/searchEngine.test.ts` | Kept. |
| `src/lib/search/tokenize.ts` | PORT | `src/lib/search/tokenize.ts` | Domain-agnostic. |
| `src/lib/search/tokenize.test.ts` | PORT | `src/lib/search/tokenize.test.ts` | Kept. |
| `src/lib/search/trie.ts` | PORT | `src/lib/search/trie.ts` | Domain-agnostic. |
| `src/lib/search/trie.test.ts` | PORT | `src/lib/search/trie.test.ts` | Kept. |
| `src/lib/search/types.ts` | PORT | `src/lib/search/types.ts` | Domain-agnostic. |
| `src/lib/discovery/organicScore.ts` | REWRITE | `shared/matchScore.ts` | Opportunity match score (skills, interests, availability, distance, reliability with 0.8 cold start). Lives in `shared/` because rankVolunteers (server) and the client "Recommended" rail both use it. Keep the `scoreWithSignals` + `explainSignals` shape for the one-line "why" (D1, D17). Sentiment/support momentum signals DROP. |
| `src/lib/discovery/organicScore.test.ts` | REWRITE | `shared/matchScore.test.ts` | Same structure (determinism, per-signal contributions, explanations), new signals. 100% coverage target for `shared/` (G27). |
| `src/lib/discovery/sentiment.ts` | DROP | — | Review sentiment for business ranking; not used by match score. `clamp01` moves into `shared/matchScore.ts`. |
| `src/lib/discovery/sentiment.test.ts` | DROP | — | Module dropped. |

## 6. src/components

### 6a. Top-level components

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/components/AddToListDialog.tsx` | REWRITE | `src/components/saved/SaveDialog.tsx` | Save an org or opportunity to a private list under `users/{uid}`. T2. |
| `src/components/AddressVerificationField.tsx` | REWRITE | `src/components/org/AddressField.tsx` | Org registration address with optional Mapbox autocomplete; manual lat/lng fallback via `geo/coordinates.ts`. T1. |
| `src/components/Avatar.tsx` | PORT | `src/components/ui/Avatar.tsx` | Used by roster, profile, notifications. Restyle. |
| `src/components/BusinessMap.tsx` | REWRITE | `src/components/map/OrgMap.tsx` | Optional Mapbox map of orgs/opportunities ("near me" filter, gate UC1). Hidden without a token. Use `lazyWithReload` (old page used plain `lazy`). T2. |
| `src/components/CommandPalette.tsx` | REWRITE | `src/components/CommandPalette.tsx` | Navigation rubric row. Search orgs + opportunities through the engine; remove feed/lists entries. T2. |
| `src/components/CookieConsent.tsx` | PORT | `src/components/CookieConsent.tsx` | Re-text, restyle. T2. |
| `src/components/EmptyState.tsx` | PORT | `src/components/ui/EmptyState.tsx` | Unused in Trove, but D6 needs one-line + one-action empty states everywhere. |
| `src/components/ErrorBoundary.tsx` | PORT | `src/components/ErrorBoundary.tsx` | Kept. |
| `src/components/ErrorState.tsx` | PORT | `src/components/ui/ErrorState.tsx` | Add collapsed "Details" with copyable requestId (D22). |
| `src/components/LegalDocument.tsx` | REWRITE | `src/components/legal/LegalDocument.tsx` | Layout depends on `board/` primitives; rebuild with tokens. |
| `src/components/LoadingState.tsx` | PORT | `src/components/ui/LoadingState.tsx` | Kept. |
| `src/components/MiniMap.tsx` | DROP | — | Zero imports (dead). `OrgMap` covers maps. |
| `src/components/ProtectedRoute.tsx` | REWRITE | `src/components/auth/RequireRole.tsx` | Role-aware guard: signed in, profile complete (G11), org membership for `/org/:orgId/*`, admin claim for `/admin`, kiosk token for the kiosk route (G15). |
| `src/components/Reveal.tsx` | DROP | — | Zero imports. React Bits FadeContent replaces it (D15). |
| `src/components/SegmentedToggle.tsx` | PORT | `src/components/ui/SegmentedToggle.tsx` | Restyle. |
| `src/components/SeoMeta.tsx` | PORT | `src/components/SeoMeta.tsx` | Base URL `https://trove.app` (line 18) moves to config; title from brand constant. T3 polish. |
| `src/components/SmoothScroll.tsx` | DROP | — | Lenis smooth scroll; dependency removed. |
| `src/components/StarRating.tsx` | PORT | `src/components/reviews/StarRating.tsx` | Experience reviews. T2. |
| `src/components/ToastHost.tsx` | PORT | `src/components/ToastHost.tsx` | Kept; toasts show requestId on errors (observability bullet). aria-live per D20. |
| `src/components/TroveChat.tsx` | DROP | — | Zero imports (dead). Calls Gemini from the browser with a `VITE_` key (line 30-40). Replaced by the server-side askAssistant flow in `src/components/help/AssistantPanel.tsx`. |
| `src/components/TurnstileGate.tsx` | REWRITE | `src/components/auth/TurnstileWidget.tsx` | Site key hardcoded (line 31) moves to env. The old gate wraps the whole app and only stores `trove_turnstile_verified` in sessionStorage (line 135, 202), so it is bypassable. New: widget token is passed to `completeProfile`, verified server-side and consumed once (G13). |

### 6b. src/components/HelpCenter

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/components/HelpCenter/HelpCenter.tsx` | REWRITE | `src/components/help/HelpCenter.tsx`, `ArticleSearch.tsx`, `AssistantPanel.tsx` | 688 lines; split by concern. Replace Fuse.js with the BM25 engine (T0). AI calls move from the browser OpenRouter key (line 51-55, 102) to the `ai` callable askAssistant (T1) with labels "From Help Center" / "AI answer, may be wrong", limit copy, 2,000-char counter, signed-out "Sign in to ask" (D7). Render as plain text (G16). |

### 6c. src/components/ReportBuilder

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/components/ReportBuilder/ColorPicker.tsx` | REWRITE | `src/components/reports/ThemePicker.tsx` | Free hex input replaced by 4-6 contrast-checked preset themes (D16). |
| `src/components/ReportBuilder/DownloadButton.tsx` | PORT | `src/components/reports/DownloadButton.tsx` | Kept; add generating/failed/ready states (D8). |
| `src/components/ReportBuilder/ReportBuilder.tsx` | REWRITE | `src/components/reports/ReportBuilder.tsx` | Sections, date range, theme, CSV export for the two new report types. T1. |
| `src/components/ReportBuilder/ReportPreview.tsx` | REWRITE | `src/components/reports/ReportPreview.tsx` | Preview for new sections; letter preview before issue (D8). |
| `src/components/ReportBuilder/SectionSelector.tsx` | PORT | `src/components/reports/SectionSelector.tsx` | Same UI; section keys from `shared/reports.ts`. |

### 6d. src/components/board (cork-board design system)

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/components/board/index.tsx` | DROP | — | Cork-board primitives (Pin, PaperNote, PhotoFrame, tilt). 1,008 lines. Cut by plan constraint. |
| `src/components/board/WhyRecommended.tsx` | REWRITE | `src/components/explore/WhyChips.tsx` | The "why recommended" idea stays: one-line reason / chips from `explainSignals` (D1, D17). |

### 6e. src/components/brand

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/components/brand/Logo.tsx` | DROP | — | Trove mini-pinboard brand mark. New logo waits for the team's design doc. |

### 6f. src/components/feed

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/components/feed/PostCard.tsx` | DROP | — | Impact stories feed cut (gate UC1). |
| `src/components/feed/PostComments.tsx` | DROP | — | Feed cut. |
| `src/components/feed/PostComposer.tsx` | DROP | — | Feed cut. |

### 6g. src/components/home

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/components/home/CategoryBand.tsx` | DROP | — | Zero imports (dead) and Trove hero design. |
| `src/components/home/DealsLedger.tsx` | DROP | — | Trove home hero component (cut). |
| `src/components/home/FeaturedBoard.tsx` | DROP | — | Trove home hero component (cut). |
| `src/components/home/HeroSection.tsx` | DROP | — | Trove hero (cut). |
| `src/components/home/HomeTopListsBoard.tsx` | DROP | — | Trove home component (cut). Collections can surface on Explore instead. |
| `src/components/home/RecentlyViewedRail.tsx` | DROP | — | Home rail cut with `recentlyViewed`. |

### 6h. src/components/lists

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/components/lists/ListComments.tsx` | DROP | — | Collections are coordinator-authored; no community comments (gate UC1). |
| `src/components/lists/ListLikeButton.tsx` | DROP | — | No community likes on collections. |
| `src/components/lists/PublishListDialog.tsx` | DROP | — | Volunteers no longer publish lists; coordinators author collections in the org portal. |
| `src/components/lists/TopListCard.tsx` | REWRITE | `src/components/collections/CollectionCard.tsx` | Card for a curated collection; drop pinboard fan styling. T2. |
| `src/components/lists/TopListsRail.tsx` | DROP | — | Feed companion rail; feed cut. |

### 6i. src/components/onboarding

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/components/onboarding/OnboardingTour.tsx` | REWRITE | `src/components/onboarding/OnboardingTour.tsx` | Same guided-tour engine; volunteer and coordinator paths. Restyle; remove `brand/Logo` import. T1. |
| `src/components/onboarding/tourSteps.ts` | REWRITE | `src/components/onboarding/tourSteps.ts` | New steps (Explore, signup, My Shifts, Impact, kiosk, hours approval); remove feed/lists steps. |

### 6j. src/components/social

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/components/social/FollowButton.tsx` | DROP | — | Follows cut (gate UC1). |
| `src/components/social/FollowListDialog.tsx` | DROP | — | Follows cut. |

### 6k. src/components/storefront

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/components/storefront/StorefrontStroll.tsx` | DROP | — | Trove visual design (cut). The whole folder is also dead: nothing imports `storefront/index.ts`. |
| `src/components/storefront/StorefrontTile.tsx` | DROP | — | Cut (dead). |
| `src/components/storefront/facade.ts` | DROP | — | Cut (dead). |
| `src/components/storefront/facade.test.ts` | DROP | — | Tests a dropped module. |
| `src/components/storefront/index.ts` | DROP | — | Cut (dead barrel). |
| `src/components/storefront/panMath.ts` | DROP | — | Cut (dead). |
| `src/components/storefront/panMath.test.ts` | DROP | — | Tests a dropped module. |

### 6l. src/components/ui

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/components/ui/button.tsx` | DROP | — | Zero imports. Regenerated by shadcn CLI (`components.json`) with token classes. |
| `src/components/ui/input.tsx` | DROP | — | Zero imports. Regenerated by shadcn CLI. |
| `src/components/ui/skeleton.tsx` | PORT | `src/components/ui/skeleton.tsx` | Kept; restyle. |

## 7. src/pages

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/pages/AccessibilityStatementPage.tsx` | REWRITE | `src/pages/public/AccessibilityStatementPage.tsx` | Re-text; describe E3 controls (text size, contrast, reduced motion); replace placeholder `support@trove.app`. |
| `src/pages/AuthPage.tsx` | REWRITE | `src/pages/auth/AuthPage.tsx`, `SignInForm.tsx`, `SignUpForm.tsx`, `ForgotPasswordForm.tsx` | 1,144 lines with one ~915-line component (line 204-1117): split. Sign-up starts with the birth-date gate before account creation (G18, D10). DEMO_MODE "Sign in as..." switcher (X5). T0/T1. |
| `src/pages/BusinessAuthPage.tsx` | DROP | — | Separate business sign-in flow. One auth flow; coordinator role comes from membership docs. |
| `src/pages/BusinessDetailPage.tsx` | REWRITE | `src/pages/volunteer/OrganizationPage.tsx` + `src/components/org-page/*` | 1,526 lines: split (OrgHeader, UpcomingOpportunities, ImpactTotals, Reviews, About). Unverified chip (D23). Deals tab becomes opportunities; supports and photo upload by visitors DROP. T1 (reviews T2). |
| `src/pages/BusinessPortalPage.tsx` | REWRITE | `src/pages/org/OrgLandingPage.tsx` | Coordinator entry: org switcher when the user has memberships, otherwise "Register your organization". T1. |
| `src/pages/BusinessRegisterPage.tsx` | REWRITE | `src/pages/org/RegisterOrganizationPage.tsx` | 590 lines. Calls `registerOrganization` (adult only, G14); EIN `NN-NNNNNNN`; time zone field (X14). No client writes to `organizations` (G17). T1. |
| `src/pages/BusinessReportBuilderPage.tsx` | REWRITE | `src/pages/org/OrgReportPage.tsx` | Organization participation report. T1. |
| `src/pages/DashboardPage.tsx` | REWRITE | `src/pages/org/dashboard/DashboardPage.tsx`, `TodayCard.tsx`, `NeedsAttention.tsx`, `UpcomingShifts.tsx`, `Analytics.tsx` | 997 lines: split. Today/next shift with "Start kiosk", Needs attention queue (D9), upcoming, Recharts analytics. Deals CRUD becomes opportunity/instance editing via callables. T0/T1. |
| `src/pages/DealsPage.tsx` | REWRITE | `src/pages/volunteer/OpportunitiesPage.tsx` | Browse upcoming opportunities (may fold into an Explore tab per SPEC Screens). Signup button state matrix (D5). T1. |
| `src/pages/ExplorePage.tsx` | REWRITE | `src/pages/volunteer/explore/ExplorePage.tsx`, `FilterBar.tsx`, `LocationBar.tsx`, `ResultsList.tsx`, `RecommendedRail.tsx` | 1,375 lines: split. Leads with promotion banner and Recommended (D1, D13). Voice search (Web Speech, line 65-80) optional. Location stored as geohash precision 5. T1. |
| `src/pages/FeedPage.tsx` | DROP | — | Feed cut (gate UC1). |
| `src/pages/HomePage.tsx` | REWRITE | `src/pages/public/HomePage.tsx` | Landing page without the cork-board hero; routes to Explore or org registration. |
| `src/pages/ImpactPage.tsx` | REWRITE | `src/pages/volunteer/ImpactPage.tsx` | Support history becomes the impact dashboard: approved hours, orgs helped, streak, milestones 25/50/100 (E4), CountUp (D15), 0/25 empty state (D6). T1. |
| `src/pages/ListDetailPage.tsx` | REWRITE | `src/pages/volunteer/CollectionPage.tsx` | Collection detail without likes/comments. T2. |
| `src/pages/MigratePage.tsx` | DROP | — | Not routed (dead). Pulls in `mockData.ts` and the Mapbox token. |
| `src/pages/NotFoundPage.tsx` | PORT | `src/pages/public/NotFoundPage.tsx` | Re-text; replace `board/` imports. |
| `src/pages/OnboardingPage.tsx` | REWRITE | `src/pages/onboarding/OnboardingPage.tsx` | Birth date first, cause interests, skills, availability (skippable), progress, ends on "3 shifts that match you" (D10); calls `completeProfile` with Turnstile token. T1. |
| `src/pages/PrivacyPolicyPage.tsx` | REWRITE | `src/pages/public/PrivacyPolicyPage.tsx` | Rewrite for minors (13+), private birth date, contact snapshots, retention note (TODOS). |
| `src/pages/ProfilePage.tsx` | REWRITE | `src/pages/volunteer/ProfilePage.tsx` | 694 lines. Profile edit via `updateProfile`; Tier 1 notifications list; "Your track record" (D12); letters list. Deal claims tab becomes My Shifts (NEW page). |
| `src/pages/PublicProfilePage.tsx` | DROP | — | Public volunteer profiles cut (gate UC1). |
| `src/pages/SavedPage.tsx` | REWRITE | `src/pages/volunteer/SavedPage.tsx` | Saved orgs and opportunities; publish-to-community DROP. T2. |
| `src/pages/TermsOfServicePage.tsx` | REWRITE | `src/pages/public/TermsOfServicePage.tsx` | Re-text for volunteering and minors. |
| `src/pages/TopListsPage.tsx` | REWRITE | `src/pages/volunteer/CollectionsPage.tsx` | Published collections wall. T2. |
| `src/pages/UserReportBuilderPage.tsx` | REWRITE | `src/pages/volunteer/HoursReportPage.tsx` | Volunteer hours report plus letter preview then issue (D8). T0 (letter) / T1 (report). |

## 8. src/ (entry, router, hooks, store, layouts, styles)

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `src/main.tsx` | REWRITE | `src/main.tsx` | Drop `board.css`/`motion.css`/`app.css` imports and the whole-app `TurnstileGate`. Owner check read the self-writable `businessOwners/{uid}` doc (line 50-53); new role state comes from membership docs and claims. |
| `src/router.tsx` | REWRITE | `src/router.tsx` | D2 shells: volunteer routes, `/org/:orgId/*`, `/admin`, `/org/:orgId/kiosk/:instanceId`, `/verify/:code`. Remove `/feed`, `/u/:uid`, `/business-auth`. Keep `lazyWithReload` + route `errorElement`. |
| `src/hooks/useBusinessSuggestions.ts` | REWRITE | `src/hooks/useSearchSuggestions.ts` | Autocomplete over orgs + opportunities. |
| `src/hooks/useDebouncedValue.ts` | PORT | `src/hooks/useDebouncedValue.ts` | Generic. |
| `src/hooks/useExploreFilters.ts` | REWRITE | `src/hooks/useExploreFilters.ts` | URL-backed filters for cause area, date, type, skills, near me. |
| `src/hooks/useGeolocation.ts` | PORT | `src/hooks/useGeolocation.ts` | Keep; store a precision-5 geohash, not exact coordinates (privacy section). |
| `src/hooks/useRecentlyViewed.ts` | DROP | — | Module dropped with `recentlyViewed.ts`. |
| `src/hooks/useReportGenerator.ts` | REWRITE | `src/hooks/useReportGenerator.ts` | Calls the report op through the typed callable client instead of `fetch("/api/reports/generate")` (line 66). |
| `src/store/appStore.ts` | REWRITE | `src/store/appStore.ts` | Toasts, command palette, and save-dialog slices kept. Filter slice re-modeled. `isBusinessOwner` replaced by server-derived memberships. `userLocation` exact [lng, lat] (line 94) replaced by geohash. |
| `src/layouts/AppLayout.tsx` | REWRITE | `src/layouts/VolunteerLayout.tsx`, `CoordinatorLayout.tsx`, `KioskLayout.tsx` | Bottom tab bar on mobile, top nav on desktop, org switcher, header notification badge (D2, D13). Kiosk layout hides the shell. Footer `support@trove.app` placeholder replaced. |
| `src/styles/app.css` | DROP | — | 1,561 lines of Trove styles. Base styles are rebuilt on tokens. |
| `src/styles/board.css` | DROP | — | Cork-board styles (cut). |
| `src/styles/motion.css` | DROP | — | Trove motion. Motion tokens with reduced-motion zeroing move into the new `tokens.css` (D18). |
| `src/styles/storefront.css` | DROP | — | Storefront styles (cut). |
| `src/styles/tailwind.css` | REWRITE | `src/styles/tailwind.css` | `@import "tailwindcss"` plus `@theme` mapping to CSS variables from `tokens.css` (Tailwind 4 bullet). |
| `src/styles/tokens.css` | DROP | — | Trove tokens (cut). Replaced by a new neutral `src/styles/tokens.css` (NEW, TD1) with status tokens (D14) and `[data-contrast=high]` set. |

## 9. functions/ (package and config)

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `functions/.eslintrc.js` | REWRITE | `functions/eslint.config.js` | Keep google + typescript-eslint rules; add a rule that bans `FieldValue.serverTimestamp` (G6) and a check that every export uses `defineCallable` (X8). |
| `functions/.gitignore` | PORT | `functions/.gitignore` | Add the standalone deploy dir (G3). |
| `functions/.secret.local.example` | REWRITE | `functions/.secret.local.example` | `TURNSTILE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `KIOSK_MASTER_SECRET` (HKDF master, G21). |
| `functions/package-lock.json` | DROP | — | Replaced by the workspace lockfile plus the deploy dir's own lockfile (G3). |
| `functions/package.json` | REWRITE | `functions/package.json` | Remove `express` (mock API only), `genkit` and `genkit-cli` (unused), the `genkit:start` script (points at missing `src/genkit-sample.ts`). Move `@types/pdfkit` to devDependencies. Align `firebase-admin` with the root (root had ^14, functions ^13). Add `zod`, `date-fns-tz`, `qrcode`, Anthropic SDK, esbuild build. |
| `functions/tsconfig.json` | PORT | `functions/tsconfig.json` | Raise `target` from es2017 to es2022 (Node 22); bundling via esbuild includes `shared/` (X6). |
| `functions/tsconfig.dev.json` | PORT | `functions/tsconfig.dev.json` | Point at the new eslint config file. |

## 10. functions/src (incl. reports/pdf/*)

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `functions/src/index.ts` | REWRITE | `functions/src/index.ts`, `functions/src/lib/turnstile.ts`, `functions/src/http/health.ts` | 1,044 lines: one Express `onRequest` `api` over in-memory mock data. New index exports exactly: `volunteer`, `coordinator`, `kiosk`, `admin`, `ai` callables (G4), `supersedeLetters` + `recomputeVolunteerStats` triggers, `runDueJobs` scheduler, `health`. Keep `verifyTurnstileToken` (line 373-406) as `lib/turnstile.ts` (PORT logic). Keep `/health` (line 526). `/reports/generate` (line 569-620) becomes a report op. DROP: mock types/data (line 18-318), all mock routes (line 622-1028), `requireCaptchaAndFingerprint` (trusts client headers), in-memory `ipReviewCounter`, `cors: true`. |
| `functions/src/reports/dataFetcher.ts` | REWRITE | `functions/src/reports/data/volunteerHours.ts`, `functions/src/reports/data/orgParticipation.ts` | 596 lines of business/user fetchers. New fetchers read approved HoursLogs only, exclude unverified orgs from letters, and snapshot evidence (G19). Keep the defensive `asString/asNumber/timestampToISO` helpers. |
| `functions/src/reports/reportService.ts` | REWRITE | `functions/src/reports/reportService.ts` | Same validate-sections then fetch then render flow, invoked from `defineCallable`. Authorization derives orgId from the target resource (G2). Theme presets instead of free hex (D16). Remove "Trove Report" titles (line 109-110, 123). |
| `functions/src/reports/types.ts` | REWRITE | `functions/src/reports/types.ts` (+ `shared/reports.ts`) | New report data shapes; section keys shared with the client. |
| `functions/src/reports/pdf/pdfGenerator.ts` | PORT | `functions/src/reports/pdf/pdfGenerator.ts` | `PdfReportBuilder` layout engine kept. Remove Trove strings (line 90-91, 369). Embed fonts and add server-side QR for letters (G22); Function memory 512 MB or more. |
| `functions/src/reports/pdf/helpers/colorUtils.ts` | PORT | `functions/src/reports/pdf/helpers/colorUtils.ts` | Kept; validates preset accents. |
| `functions/src/reports/pdf/helpers/imageLoader.ts` | PORT | `functions/src/reports/pdf/helpers/imageLoader.ts` | Keep the SSRF guard for org logos. Remove dead `loadRepoAsset` (line 157-164, never called, reads `process.cwd()/..`). Note DNS-check-then-fetch race (resolve at line 126, fetch at 133). |
| `functions/src/reports/pdf/helpers/layoutConstants.ts` | PORT | `functions/src/reports/pdf/helpers/layoutConstants.ts` | Kept. |
| `functions/src/reports/pdf/helpers/starRating.ts` | PORT | `functions/src/reports/pdf/helpers/starRating.ts` | Kept for the optional org reviews section (T2). |
| `functions/src/reports/pdf/sections/bizContact.ts` | REWRITE | `functions/src/reports/pdf/sections/orgContact.ts` | Org contact and address. |
| `functions/src/reports/pdf/sections/bizDescription.ts` | REWRITE | `functions/src/reports/pdf/sections/orgMission.ts` | Mission and cause areas. |
| `functions/src/reports/pdf/sections/bizHeader.ts` | REWRITE | `functions/src/reports/pdf/sections/orgHeader.ts` | Org name, verified state, date range. |
| `functions/src/reports/pdf/sections/bizHours.ts` | REWRITE | `functions/src/reports/pdf/sections/orgHoursByMonth.ts` | Business opening-hours table becomes hours by opportunity/month; reuse the table layout. |
| `functions/src/reports/pdf/sections/bizOwnerNotes.ts` | REWRITE | `functions/src/reports/pdf/sections/coordinatorNotes.ts` | Free-text notes section. |
| `functions/src/reports/pdf/sections/bizPerformance.ts` | REWRITE | `functions/src/reports/pdf/sections/orgAttendance.ts` | Signups, attendance rate, no-shows, top volunteers (display names only). |
| `functions/src/reports/pdf/sections/bizPhotos.ts` | DROP | — | Photo gallery has no place in an hours/participation report. |
| `functions/src/reports/pdf/sections/bizReviews.ts` | REWRITE | `functions/src/reports/pdf/sections/orgReviews.ts` | Experience review snapshot. T2. |
| `functions/src/reports/pdf/sections/userActivitySummary.ts` | REWRITE | `functions/src/reports/pdf/sections/volunteerSummary.ts` | Totals: approved hours, orgs helped, shifts completed. |
| `functions/src/reports/pdf/sections/userFavorites.ts` | DROP | — | Saved items are not part of an hours report. |
| `functions/src/reports/pdf/sections/userLikedComments.ts` | DROP | — | Social feature; no equivalent. |
| `functions/src/reports/pdf/sections/userProfileInfo.ts` | REWRITE | `functions/src/reports/pdf/sections/volunteerIdentity.ts` | Minimal identity only (first name + last initial for minors); no birth date or contact. |
| `functions/src/reports/pdf/sections/userReviews.ts` | DROP | — | Volunteer's own reviews are not part of an hours report. |
| `functions/src/reports/pdf/sections/userWishlist.ts` | DROP | — | No equivalent. |

## 11. Firestore and Storage rules + tests

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `firestore.rules` | REWRITE | `firestore.rules` | Full new matrix (ceo + eng blocks): organizations/opportunities/series/instances client-write denied, signups/hoursLogs/letters/notifications Function-write only, `letterVerifications` get-by-id only, public `users/{uid}` allowlist, `users/{uid}/private` preference-key allowlist, `aiUsage`/`instanceSecrets`/`jobRuns` no client access, collections publish rule, reviews keyed by signupId. Admin via custom claim, not the hardcoded uid (line 22). No feed/follows/supports/list-comment/report rows (gate UC1). Add a read rule for the search index artifact if kept. |
| `firestore.rules.test.ts` | REWRITE | `tests/rules/*.rules.test.ts` (one file per collection) | Keep the harness pattern (`initializeTestEnvironment`, `withSecurityRulesDisabled` seed helper, allow + deny per row). Old cases for businesses/deals/dealClaims/supports/follows/lists/posts/reports DROP. Add every new row incl. cross-org and kiosk-token denials (G2, G15). |
| `storage.rules` | REWRITE | `storage.rules` | Old rules allow 10-20 MB uploads and gate business photos with a Firestore `get`. New (G17): `image/*` for org photos/avatars, `application/pdf` for letters/reports, under 5 MB, owner-only paths for letters/reports. Storage rules tests added (NEW). |

## 12. e2e/

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `e2e/feed.spec.ts` | DROP | — | Feed cut. |
| `e2e/lists.spec.ts` | REWRITE | `e2e/collections.spec.ts` | Collections wall and detail render; no like/comment flows. T2. |
| `e2e/profiles.spec.ts` | DROP | — | Public profiles and follows cut. Its "Explore search autocomplete" case (line 34) moves into `e2e/explore.spec.ts`. |
| `e2e/regression.spec.ts` | REWRITE | `e2e/smoke.spec.ts`, `e2e/explore.spec.ts` | Keep: home renders, org page renders, search handoff to Explore, filters, protected route redirect, 404 page, signed-out save redirects to sign-in. Run on emulator seed, not live data. |
| `e2e/ux.spec.ts` | PORT | `e2e/command-palette.spec.ts` | Same two command palette cases with new entries. T2. |

## 13. seed/

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `seed/README.md` | REWRITE | `seed/README.md` | Document `npm run seed:demo`, demo accounts, `--shift-starts-in`, reset. |
| `seed/backfill-photos.ts` | DROP | — | Trove photo pipeline; references a service-account key file by name (line 12). |
| `seed/build-photo-catalog.ts` | DROP | — | Trove photo pipeline. |
| `seed/businesses-snapshot.json` | DROP | — | 9,792-line Trove catalog snapshot (101 yelpcdn URLs). |
| `seed/config.ts` | DROP | — | OSM metro targets. |
| `seed/dump-businesses.ts` | DROP | — | Dumps the old project's businesses; references the key file (line 9). |
| `seed/lib/accounts.ts` | REWRITE | `seed/demo/accounts.ts` | Creates admin, owner/coordinator, adult volunteer, minor volunteer with fixed demo passwords; sets the admin custom claim; prints the credentials table (X5). |
| `seed/lib/backfillAggregates.ts` | DROP | — | Stats are owned by `recomputeVolunteerStats` (trigger). |
| `seed/lib/buildSearchIndex.ts` | REWRITE | `seed/demo/buildSearchIndex.ts` | Same sharded artifact build over orgs + opportunities. |
| `seed/lib/categoryMap.ts` | DROP | — | OSM tag to Trove category mapping. |
| `seed/lib/categoryMap.test.ts` | DROP | — | Module dropped. |
| `seed/lib/chainFilter.ts` | DROP | — | Chain-business filter for OSM ingest. |
| `seed/lib/chainFilter.test.ts` | DROP | — | Module dropped. |
| `seed/lib/clean.ts` | REWRITE | `seed/demo/clean.ts` | Same "delete everything tagged with seedSource" idea for `demo:reset` and `resetDemoData`. |
| `seed/lib/content.ts` | REWRITE | `shared/demo/dataset.ts` | Deterministic demo content (San Antonio nonprofits, shifts, signups, hours, schemaVersion per X18). In `shared/` so `resetDemoData` can reuse it. |
| `seed/lib/content.test.ts` | REWRITE | `shared/demo/dataset.test.ts` | Same determinism and shape checks. |
| `seed/lib/firebase.ts` | REWRITE | `seed/demo/firebase.ts` | Admin SDK pointed at emulators under `demo-fbla2027`; no service account. |
| `seed/lib/ingest.ts` | DROP | — | OSM ingest. |
| `seed/lib/mapBusiness.ts` | DROP | — | OSM element mapper. |
| `seed/lib/mapBusiness.test.ts` | DROP | — | Module dropped. |
| `seed/lib/overpass.ts` | DROP | — | Overpass query builder. |
| `seed/lib/photos.ts` | DROP | — | Pexels/Picsum photo sourcing. |
| `seed/lib/topLists.ts` | REWRITE | `seed/demo/collections.ts` | Curated collections authored by the seeded coordinator (468 lines; expect much smaller). |
| `seed/migrate-mockdata.ts` | DROP | — | Migrates Trove mock data; references the key file (line 10-11). |
| `seed/package-lock.json` | DROP | — | Seed becomes part of the root workspace. |
| `seed/package.json` | DROP | — | Scripts move to root `seed:demo` / `demo:reset` (X7). |
| `seed/seed.ts` | REWRITE | `seed/demo/seed.ts` | Entry point; supports `--shift-starts-in` (X12). |
| `seed/seedTopLists.ts` | DROP | — | Merged into `seed/demo/seed.ts`. |
| `seed/source-business-photos.ts` | DROP | — | Scrapes business websites for photos. |
| `seed/sourced-photos.json` | DROP | — | Output of the photo scraper. |
| `seed/tsconfig.json` | REWRITE | `seed/tsconfig.json` | Include `shared/` instead of `../src/lib/types.ts`. |

## 14. scripts/

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `scripts/run-seed-deals.mjs` | DROP | — | Writes deals to the old project with the Firebase CLI's stored OAuth token. |
| `scripts/seed-deals.mjs` | DROP | — | Deals seed using a service-account key. |
| `scripts/seed-feed.mjs` | DROP | — | Feed seed (feed cut) using a service-account key. |

## 15. public/

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `public/manifest.webmanifest` | DROP | — | PWA removed from Tier 3 (not approved). Re-add a plain manifest after the design doc if wanted. |
| `public/og-default.svg` | REWRITE | `public/og-default.svg` | New Open Graph image with the product name. T3. |
| `public/photos/biz-bakery-B8IhI2fa.jpg` | DROP | — | Trove business photo. |
| `public/photos/biz-barber-Cyg_1FLq.jpg` | DROP | — | Trove business photo. |
| `public/photos/biz-bookstore-D0dEe6pG.jpg` | DROP | — | Trove business photo. |
| `public/photos/biz-coffee-DP_oHjwF.jpg` | DROP | — | Trove business photo. |
| `public/photos/biz-florist-Cxw_498y.jpg` | DROP | — | Trove business photo. |
| `public/photos/biz-restaurant-D4dLyBZJ.jpg` | DROP | — | Trove business photo. |
| `public/robots.txt` | REWRITE | `public/robots.txt` | Hardcoded `https://trove.app` sitemap; disallow `/org`, `/admin`, kiosk routes. T3. |
| `public/sitemap.xml` | REWRITE | `public/sitemap.xml` | Hardcoded `trove.app` URLs; new public routes. T3. |
| `public/trove-icon.svg` | DROP | — | Trove brand icon. |
| `public/trove-mark.svg` | DROP | — | Trove favicon. |

## 16. docs/

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| `docs/design_doc_extracted.txt` | DROP | — | Text dump of last year's design doc. |
| `docs/plans/social-feed-plan.md` | DROP | — | Feed plan (feed cut). |
| `docs/project_outline_extracted.txt` | DROP | — | Text dump of last year's outline. |
| `docs/trove-redesign-strategy.md` | DROP | — | Trove redesign strategy. |
| `docs/trove-website-guardrails.md` | DROP | — | Trove naming and visual guardrails. |
| `docs/website_requirements_matrix.md` | REWRITE | `docs/RUBRIC_MAP.md` | Same "requirement to implementation location" idea, for the 2026-27 rubric, plus the competitor table. |

---

## 17. NEW (target files with no Trove equivalent)

| Old path | Disposition | Target path in new repo | Reason / notes |
|---|---|---|---|
| — | NEW | `shared/schemas.ts` (+ `src/lib/validation/` re-exports) | zod schemas for every callable input and stored doc; single definition for client and Functions. |
| — | NEW | `shared/stateMachine.ts` (+ test) | Signup status transitions with actors (state machine bullet, org-cancel bullet). 100% coverage (G27). |
| — | NEW | `shared/hours.ts` (+ test) | Hours clamp to the scheduled window, rounded to 15 min (G12). |
| — | NEW | `shared/reliability.ts` (+ test) | Reliability formula, exclusions, cold start, 12-month window (T3 guardrails). |
| — | NEW | `shared/ics.ts` (+ test) | Per-shift `.ics`, VTIMEZONE from org time zone, METHOD:CANCEL with SEQUENCE+1 (E2, X14). |
| — | NEW | `shared/clock.ts` (+ test) | Single clock with DEMO_MODE-only offset (G6, X12). |
| — | NEW | `shared/config.ts` | Limits and windows with env overrides (X13). |
| — | NEW | `shared/errors.ts` (+ test) | Error catalog `{code, httpsCode, message, fix, helpSlug}` (X9). |
| — | NEW | `shared/timezone.ts` (+ test) | date-fns-tz helpers and display formatter with zone label (G10, D24). |
| — | NEW | `shared/milestones.ts` (+ test) | 25/50/100-hour thresholds and streak weeks (E4). |
| — | NEW | `shared/kioskCode.ts` (+ test) | HKDF per-instance secret, 30 s HMAC window, `timingSafeEqual` compare (G21). |
| — | NEW | `shared/plannerParse.ts` (+ test) | Deterministic shift planner parser (count, date, time range, cause keywords). T1 client-side. |
| — | NEW | `functions/src/lib/defineCallable.ts` (+ test) | Auth resolvers that load the target resource (G2), zod validation, profile gate (G11), rate limits, structured logs, error mapping (X8). |
| — | NEW | `functions/src/lib/rateLimit.ts`, `functions/src/lib/log.ts` | Per-user limits (AI, check-in) and `{fn, uid, instanceId, outcome, ms, requestId}` logs. |
| — | NEW | `functions/src/ops/volunteer/*.ts` (+ one test each) | completeProfile, updateProfile, signup, cancelSignup (incl. promotion release), extendSeriesSignup, submitManualHours, issueLetter, markNotificationsRead, redeemInvite. |
| — | NEW | `functions/src/ops/coordinator/*.ts` (+ tests) | registerOrganization, updateOrganization, createInvite, upsertOpportunity, upsertSeries, createInstance, updateInstance, cancelInstance, setAttendance, approveHours, rejectHours, finalizeShift, extendSeries, rankVolunteers, revokeLetter, startKiosk, generateReport. |
| — | NEW | `functions/src/ops/kiosk/*.ts` (+ tests) | issueKioskCode, checkIn, checkOut (windows, 10-per-10-min limit, stale code). |
| — | NEW | `functions/src/ops/admin/*.ts` (+ tests) | verifyOrganization, runDueJobs (callable), resetDemoData (admin + DEMO_MODE), advanceDemoClock, resetRateLimits. |
| — | NEW | `functions/src/ops/ai/askAssistant.ts`, `shiftPlannerParse.ts` (+ tests) | Claude via Functions secret, per-user and global caps (G16). shiftPlannerParse T2. |
| — | NEW | `functions/src/triggers/supersedeLetters.ts`, `recomputeVolunteerStats.ts` (+ tests) | Letter superseding; bounded stats/contact-snapshot recompute (G1). |
| — | NEW | `functions/src/jobs/runDueJobs.ts` (+ test) | Only scheduler: waitlist cutoff, finalizeShift, extendSeries; lease doc and `nextActionAt` paging (G8). |
| — | NEW | `functions/src/reports/pdf/sections/letter*.ts` | Verified hours letter: header, volunteer, org/hours table, verify URL + QR, issue date (D8). T0. |
| — | NEW | `src/pages/kiosk/KioskPage.tsx` + `src/components/kiosk/*` | Code with countdown ring, QR, live roster AnimatedList, offline state, locked route, session-expired screen (D4, X15). T0. |
| — | NEW | `src/pages/volunteer/CheckInPage.tsx` | Phone typed-code entry (primary) and QR scan (progressive, G20). T0. |
| — | NEW | `src/pages/public/VerifyPage.tsx` (+ component tests) | `/verify/:code` valid / superseded / revoked states (D3). T0. |
| — | NEW | `src/pages/volunteer/MyShiftsPage.tsx` | Confirmed and waitlisted shifts, cancel, `.ics` download, cancellation download. T1. |
| — | NEW | `src/components/signup/SignupButton.tsx` (+ tests) | Signup / waitlist state matrix with waitlist position (D5). T1. |
| — | NEW | `src/components/hours/*` | Manual hours submission, coordinator approve/reject with reason, Needs attention rows (D9). |
| — | NEW | `src/components/letters/*` | Letter preview, issue, excluded-hours note, revoke reason enum. |
| — | NEW | `src/components/notifications/*` | Tier 1 list on Profile + header badge; Tier 2 bell with AnimatedList. |
| — | NEW | `src/pages/org/OpportunityEditorPage.tsx`, `RosterPage.tsx`, `MembersPage.tsx`, `ShiftPlannerPanel.tsx` | Opportunity/series editing, roster with attendance overrides, invites, planner UI (D17). |
| — | NEW | `src/pages/admin/AdminPage.tsx` | Verify orgs, run due jobs, reset demo, advance clock, last job run (G23). |
| — | NEW | `src/components/a11y/PreferencesControls.tsx` | Text size 100/125/150%, high contrast, reduced motion (E3, D18, D21). |
| — | NEW | `src/components/milestones/MilestoneCelebration.tsx` | Milestone moment and badge card (E4). |
| — | NEW | `src/components/bits/*` | Vendored React Bits (CountUp, AnimatedList, SpotlightCard, FadeContent) with source URL header and token classes. |
| — | NEW | `src/lib/toUserError.ts` (+ test) | Maps HttpsError codes to friendly copy + requestId (D22). |
| — | NEW | `src/styles/tokens.css` | Neutral interim tokens (TD1), status tokens (D14), high-contrast set, motion tokens. |
| — | NEW | `src/content/help/*.md` | Help articles with front matter, BM25-indexed at build (X16). |
| — | NEW | `scripts/demo.mjs`, `doctor.mjs`, `build-functions.mjs`, `set-admin-claim.mjs`, `check-tokens.mjs`, `check-functions-index.mjs`, `check-spec.mjs` | X1, X3, G3, admin claim script, check scripts (X7). |
| — | NEW | `tests/rules/*.rules.test.ts`, `tests/storage/*.rules.test.ts` | Rules tests for every matrix row incl. denials. |
| — | NEW | `e2e/tier0.spec.ts`, `kiosk.spec.ts`, `onboarding.spec.ts`, `navigation.spec.ts`, `a11y.spec.ts` | Tier 0 gate, kiosk offline/stale code, onboarding, per-role navigation, axe + keyboard path. |
| — | NEW | `docs/SPEC.md`, `docs/DEMO.md`, `docs/ARCHITECTURE.md`, `docs/RUBRIC_MAP.md` | Build inputs and runbooks (G26, X16, X17). |
| — | NEW | `LICENSE`, `CONTRIBUTING.md`, `.nvmrc`, `components.json`, `.github/dependabot.yml` | X2, X18, X20, shadcn config. |

---

## 18. Known errors and bugs to fix while porting

Secret values are redacted to their first 6 characters.

### Secrets and environment-specific IDs

1. **Mapbox secret token committed.** `migrate.ts:473` `const MAPBOX_TOKEN = "sk.eyJ...";` and `update-mock-addresses.ts:8` `process.env.VITE_TROVE_MAPBOX_TOKEN || "sk.eyJ..."`. Not ported; token must be revoked in the old Mapbox account (design doc).
2. **Partial Mapbox secret in the audit doc.** `SECURITY_AUDIT_2026-06-18.md:116` and `:278` print the last 22 characters of the same `sk.` token while claiming it is redacted. Do not copy this file.
3. **Hardcoded Firebase web config.** `src/lib/firebase.ts:14-22` `apiKey: "AIzaSy..."`, `projectId: "fblaslc2026"`, `appId: "1:9729..."`, `measurementId: "G-LVV2..."`. Move to `VITE_FIREBASE_*` (X4).
4. **Hardcoded Turnstile site key.** `src/components/TurnstileGate.tsx:31` `const TURNSTILE_SITE_KEY = "0x4AAA...";`. Move to env; use Cloudflare test keys locally.
5. **Hardcoded admin uid.** `firestore.rules:22` `request.auth.uid in ['8SVbsy...']`. The comment at lines 16-19 says it is a placeholder that "matches no real uid", which is false. Replace with the `admin` custom claim.
6. **OAuth client credentials in source.** `apply-yelp-photos.mjs:26-28` `CLIENT_ID = "563584..."`, `CLIENT_SECRET = "j9iVZf..."` (the public firebase-tools client, still flagged by secret scanners), `PROJECT = "fblaslc2026"`.
7. **Service-account key file named in tracked files.** `.gitignore:60` `fblaslc2026-firebase-adminsdk-fbsvc-15b8b6...json`; also `seed/backfill-photos.ts:12`, `seed/dump-businesses.ts:9`, `seed/migrate-mockdata.ts:10-11`. Leaks the key id; rotate that key in the old project.
8. **AI keys shipped to the browser.** `src/components/HelpCenter/HelpCenter.tsx:54-55` reads `VITE_TROVE_OPENROUTER_KEY` and sends it from the client (line 102); `src/components/TroveChat.tsx:30` puts `VITE_TROVE_GEMINI_KEY` in a request URL (`...:generateContent?key=${key}`, line 37). The `.env.example` lines 5-12 encourage this. AI moves to the `ai` callable.
9. **Dev proxy to the old project.** `vite.config.mjs:28` `target: "https://us-central1-fblaslc2026.cloudfunctions.net"`.
10. **Hardcoded production domain.** `src/components/SeoMeta.tsx:18` `const baseUrl = "https://trove.app";`, `public/robots.txt`, `public/sitemap.xml`, `src/layouts/AppLayout.tsx:346` `mailto:support@trove.app` (placeholder per `AccessibilityStatementPage.tsx:13`).

### Trust and rules bugs (client-trusted writes)

11. **Deal claim limit is client-enforced.** `src/lib/firestore.ts:896-950` runs `claimDeal` as a client transaction, but `firestore.rules:141-159` lets any signed-in user bump `claimedCount` by 1 with no matching claim, and `dealClaims` create (`:162-170`) never checks `maxClaims`. Anyone can over-claim or inflate counts. The new signup/waitlist logic runs only in the `signup` Function (G7).
12. **"Secure" token uses Math.random.** `src/lib/firestore.ts:929-930` `// Generate a secure, 8-character alphanumeric token` then `Math.random().toString(36)...`. New codes use HMAC (kiosk) and `crypto.randomBytes` (verify codes).
13. **Business rating can be set to any number.** `firestore.rules:118-127` lets any signed-in user change `rating` (only `is number`) while bumping `reviewCount`, with no review required. New aggregates are Function-written.
14. **Search index artifact is never readable.** `src/lib/search/indexArtifact.ts:36` reads `searchIndex/*`, but `firestore.rules` has no `searchIndex` match (default deny); the error is swallowed at line 41-43, so every client silently rebuilds the index from the full `businesses` collection.
15. **Non-atomic business registration.** `src/lib/firestore.ts:764-797` writes `businesses`, then `businessOwners`, then photos with `Promise.allSettled` (photo failures silently ignored). Replaced by the transactional `registerOrganization` Function.
16. **Role check reads a self-writable doc.** `src/main.tsx:50-53` sets `isBusinessOwner` from `businessOwners/{uid}`, which `firestore.rules:134-136` lets the user write with any `businessId`. UI-only today, but the pattern must not carry over (memberships + claims).
17. **Turnstile gate is client-only.** `src/components/TurnstileGate.tsx:135` trusts `sessionStorage["trove_turnstile_verified"] === "1"`; the verification result is not bound to any server action. Fixed by G13.
18. **Mock API trusts client headers.** `functions/src/index.ts:421-445` blocks only when the client-sent `x-bot-score` header exceeds 0.9 and requires an `x-device-fingerprint` header the client invents. Mock routes such as `/users/:id/follow` (`:943`) and `/businesses/:id/reviews/:reviewId/respond` (`:962`) mutate state with no auth at all. Whole Express app dropped.
19. **Open CORS and weak CSP.** `functions/src/index.ts:1038-1043` `onRequest({ cors: true, ... })`. `firebase.json:61` CSP has no `default-src` or `script-src` and allows `https://openrouter.ai`.
20. **Exact user location kept in client state.** `src/store/appStore.ts:94` `userLocation: [number, number] | null;` stores precise coordinates; the new privacy rule is a precision-5 geohash.

### Dead code

21. **Unrouted page.** `src/pages/MigratePage.tsx` is not in `src/router.tsx`; it is the only importer of the 2,249-line `src/lib/mockData.ts`.
22. **Unused components.** `TroveChat.tsx`, `MiniMap.tsx`, `Reveal.tsx`, `EmptyState.tsx`, `ui/button.tsx`, `ui/input.tsx`, `home/CategoryBand.tsx`, and the entire `components/storefront/` folder have zero importers. `src/lib/chatSystemPrompt.ts` and `src/lib/categoryColors.ts` are only used by dead components.
23. **Duplicate utility.** `src/lib/utils.ts` duplicates `src/lib/cn.ts` and has no importers.
24. **Dead server helper.** `functions/src/reports/pdf/helpers/imageLoader.ts:157-164` `loadRepoAsset` is exported but never called and resolves `process.cwd()/..`, which does not exist in a deployed Function.
25. **Stale comment.** `src/components/TroveChat.tsx:32` says "Call Gemini 1.5 Flash" but the endpoint (line 37) uses `gemini-2.5-flash`.

### Dependencies and tooling

26. **Unused root dependencies** in `package.json`: `@dataconnect/generated` (line 23, local generated SDK, zero imports), `@google/generative-ai` (line 24, zero imports), `@radix-ui/react-tabs` (line 29, zero imports), `@testing-library/react` (line 56, no component tests), `playwright` (line 63, duplicates `@playwright/test`). `fuse.js` (line 37) and `lenis` (line 38) each have one importer that is being replaced. Build tools `autoprefixer`, `postcss`, `tailwindcss` sit in `dependencies`.
27. **Unused or broken Functions dependencies** in `functions/package.json`: `genkit` and `genkit-cli` (lines 32-33) unused; script `genkit:start` (line 4) runs `src/genkit-sample.ts`, which does not exist; `express` (line 20) only serves mock routes; `@types/pdfkit` (line 19) belongs in devDependencies.
28. **Version drift.** Root `firebase-admin` is `^14.1.0` (`package.json:61`) while Functions use `^13.6.0` (`functions/package.json:21`). CI uses Node 20 (`ci.yml:29`) while Functions declare Node 22 (`functions/package.json:16`). Functions `tsconfig.json` targets es2017 on a Node 22 runtime.
29. **CI gaps.** `.github/workflows/ci.yml` never builds Functions, never runs `test:rules` or e2e, and `npm audit --audit-level=high || true` (line 42) can never fail.
30. **e2e against live data.** `playwright.config.ts:20-23` documents that specs hit LIVE Firestore, forcing `workers: 1` and retries. New suite runs on emulators + seed.
31. **Plan correction.** The plan's constraint names "Sora/Inter brand" fonts; Trove at this commit actually loads Fraunces and Satoshi (`index.html:20-21`). Both are dropped either way.

### Oversized files (over 800 lines) and how they split

| File | Lines | Disposition | Split |
|---|---|---|---|
| `src/lib/mockData.ts` | 2,249 | DROP | — |
| `src/styles/app.css` | 1,561 | DROP | Rebuilt on tokens. |
| `src/pages/BusinessDetailPage.tsx` | 1,526 | REWRITE | `OrganizationPage` + `src/components/org-page/*` (5 parts). |
| `src/pages/ExplorePage.tsx` | 1,375 | REWRITE | `ExplorePage`, `FilterBar`, `LocationBar`, `ResultsList`, `RecommendedRail`. |
| `src/lib/firestore.ts` | 1,335 | REWRITE | `src/lib/data/{reviews,saved,collections,profile,organizations,storage}.ts`; trusted writes move to Functions. |
| `src/pages/AuthPage.tsx` | 1,144 | REWRITE | `AuthPage` + `SignInForm`, `SignUpForm`, `ForgotPasswordForm`. |
| `functions/src/index.ts` | 1,044 | REWRITE | Index of 5 callables + triggers + scheduler + health; handlers in `ops/<endpoint>/<op>.ts`. |
| `src/components/board/index.tsx` | 1,008 | DROP | — |
| `src/pages/DashboardPage.tsx` | 997 | REWRITE | `dashboard/{DashboardPage,TodayCard,NeedsAttention,UpcomingShifts,Analytics}.tsx`. |
| `src/lib/api.ts` | 953 | REWRITE | `api.ts` (callable map), `data/explore.ts`, `data/organizations.ts`, `geo/geocode.ts`. |

Near the limit and also split on rewrite: `src/pages/ProfilePage.tsx` (694), `src/components/HelpCenter/HelpCenter.tsx` (688), `functions/src/reports/dataFetcher.ts` (596), `src/pages/BusinessRegisterPage.tsx` (590). Many old components are single functions of several hundred lines (for example `AuthPage` at about 915 lines), far over the 50-line function guideline.

---

## 19. Summary

Counts are rows in sections 1 to 16 (one row per old file; `src/dataconnect-generated/**` counts as one row) plus rows in section 17.

| Disposition | Rows |
|---|---|
| PORT | 57 |
| REWRITE | 117 |
| DROP | 122 |
| NEW | 43 |
| **Old-file rows (PORT + REWRITE + DROP)** | **296** |

The 296 old-file rows are 293 non-generated tracked files, 1 row for the 15 generated Data Connect files, and 2 untracked `*.tsbuildinfo` files. Coverage was checked by matching every `git ls-files` path at `f9f6793` against this document.
