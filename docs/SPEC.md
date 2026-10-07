# Volunteer Management App: Build Specification

| | |
|---|---|
| Status | Authoritative build spec; replaces PORT_PLAN.md for implementation |
| Date | 2026-10-06 |
| Competition | FBLA 2026-27 Coding & Programming, "Serving the Community: Nonprofit Volunteer Management" |
| Build inputs | this file, TODOS.md (backlog), docs/PORT_LEDGER.md (port dispositions). The PORT_PLAN.md review record is history only. |
| Product name | placeholder constant in `src/lib/brand.ts` |

Code comments and tests cite this file by anchor, for example `SPEC#fn-signup` or `SPEC#rules-signups`.

## Table of contents

1. [Product summary and scope](#scope)
2. [Architecture](#architecture)
3. [Data model](#data-model)
4. [Roles and authorization](#roles)
5. [API (callable operations)](#api)
6. [Signup state machine](#state-machine)
7. [Formulas and time](#formulas)
8. [Feature subsystems: kiosk, letters, notifications, AI, help, reports, calendar](#subsystems)
9. [Screens and UX](#screens)
10. [Developer experience](#dx)
11. [Query catalogue and indexes](#queries)
12. [Test requirements](#tests)
13. [Build order and schedule](#schedule)
14. [Appendix A: Traceability](#appendix-a)
15. [Appendix B: Resolved conflicts](#appendix-b)

---

<a id="scope"></a>
## 1. Product summary and scope

### 1.1 What the product is

A web app that lets nonprofits recruit, schedule, check in, and keep verified records for volunteers, and lets volunteers (many of them high-school students) find shifts, sign up, check in on their phone, and get a verifiable hours letter. It is a domain-first port of last year's app (Trove, `russy457/fblaslc2026` @ `f9f6793`): pure engines (search, PDF pipeline, help center, Turnstile, onboarding tour) are reused, everything domain-specific is rewritten. Per-file port decisions live in `docs/PORT_LEDGER.md`.

Four headline features:

| # | Feature | Where specified |
|---|---|---|
| H1 | Live 3-device check-in: kiosk tablet shows a rotating 6-digit code, volunteer enters it on a phone, coordinator laptop roster updates live | [#kiosk](#kiosk), [#fn-checkin](#fn-checkin) |
| H2 | Shift planner: plain-English shift request becomes a draft shift; volunteers ranked by match + reliability | [#ai](#ai), [#screen-planner](#screen-planner) |
| H3 | Verified hours letters (PDF) with a public `/verify/:code` page | [#letters](#letters), [#fn-issueletter](#fn-issueletter) |
| H4 | Waitlist with auto-promotion and a fair reliability record | [#fn-signup](#fn-signup), [#reliability](#reliability) |

### 1.2 Tiers

Nothing outside Tier 0 starts until the Tier 0 Playwright e2e passes in CI. No feature is cut by tiering; tiers are build order.

| Tier | Contents |
|---|---|
| **Tier 0** (demo loop) | Seeded users, org, and one shift instance; signup (confirmed seats only) and cancel; startKiosk + typed kiosk code; checkIn/checkOut; finalizeShift via runDueJobs; auto-approved kiosk hours; recomputeVolunteerStats; one letter template + issueLetter + `/verify`; BM25 help search; demo clock; health; Firestore and Storage rules for those collections. |
| **Tier 1** | Waitlist (transactional, promotion, 2 h cutoff, walk-up); reliability score; QR scanning; reports (PDF + CSV); onboarding + completeProfile + Turnstile; Explore polish (recommended shifts, smart filters); org registration, invites, members, org edits, admin verification; opportunity/instance CRUD; hours approval and Needs attention; setAttendance and disputes; manual hours; letter revocation and supersede trigger; minimal notifications list + header badge; askAssistant (AI Q&A); deterministic shift-planner parser; saved items; E1 demo dataset + reset; E2 .ics; E3 accessibility controls; E4 milestones; legal pages. |
| **Tier 2** | Recurring series (upsertSeries, extendSeries, whole-series signup, extendSeriesSignup); rankVolunteers + inviteVolunteers; shiftPlannerParse (AI); reliability charts in reports; coordinator/admin-authored curated collections; org experience reviews; command palette; optional Mapbox map; notifications bell menu (AnimatedList); cookie consent. |
| **Tier 3** | SEO polish (meta tags, sitemap, structured data for org pages). |

### 1.3 Cut and out of scope

| Item | Disposition | Reason |
|---|---|---|
| Impact stories feed | Cut | Not in prompt or rubric; minor-privacy risk |
| Follows | Cut | Same |
| Public volunteer profiles (`/u/:uid`), adult bio and opt-in public fields | Cut | Same; `users/{uid}` keeps only roster/letter/badge-card fields |
| Volunteer-authored lists (`users/{uid}/lists`) | Cut | Collections are coordinator/admin-authored only |
| Public org "impact this month" chart (E8) | Skipped | Duplicates the org participation report |
| PWA | Not approved | |
| LAN/hotspot emulator demo, mkcert local TLS, LAN URL QR | Dropped | Demo target is the deployed website only |
| Email, SMS, push delivery | Out of scope | Alerts are in-app only |
| Mobile app, production multi-region, load testing beyond demo scale | Out of scope | |
| Final visual identity (palette, type, brand, imagery) | Deferred | Team's own design doc; interim neutral tokens ship until then |
| No-emulator mock mode (TD3) | Deferred | TODOS.md |
| Coordinator CSV roster import (E5) | Deferred | TODOS.md |
| Spanish UI (E6) | Deferred | TODOS.md |
| Training/certification prerequisites (E7) | Deferred | TODOS.md |
| Data retention/export automation, contact-snapshot retention, avatar moderation | Deferred | TODOS.md; documented manually on the privacy page |
| Identity Platform blocking functions | Deferred | TODOS.md |

### 1.4 Constraints

- **No Firebase project init until the team's new account exists.** No `.firebaserc`, no `firebase init`, no deploy until then. `firebase.json`, rules, and indexes exist as hand-written files. Deploy to the new Blaze project happens before the first competition round (5+ months out), and one real `firebase deploy --only functions` rehearsal happens as soon as the project exists.
- **Local development runs on emulators** (Auth, Firestore, Functions, Storage) under project id `demo-fbla2027`. All scripts pass `--project demo-fbla2027`.
- **No secrets in git.** Web config comes from `VITE_FIREBASE_*` env vars. AI, Turnstile secret, kiosk master secret, and deployed demo password are Functions secrets. The old repo's `migrate.ts` and `update-mock-addresses.ts` are not ported. gitleaks runs in CI. Team action outside the code: revoke the old Mapbox `sk.` token, rotate the old OpenRouter key and Turnstile secret, restrict or retire the old Firebase project.
- **Design deferred to the team's design doc.** Screens are built now with React Bits (TS + Tailwind variants via the shadcn CLI) and taste-skill layout rules. Every color, font, radius, spacing step, and motion value is a token in `src/styles/tokens.css`; Tailwind 4 `@theme` variables are defined from those tokens; vendored React Bits components use only token-mapped classes. The interim token set is neutral: one neutral ramp, one accent, semantic status colors (TD1). No mockups (TD2).
- **Stack (rubric: language selection):** React 18 + TypeScript + Vite, React Router, TanStack Query, Zustand, react-hook-form + zod, Firebase (Auth, Firestore, Storage, Cloud Functions v2 on Node 22, Blaze plan), Tailwind CSS 4, React Bits, Recharts, pdfkit, date-fns + date-fns-tz, Vitest, Playwright, @firebase/rules-unit-testing, Mapbox GL (optional, public `pk.` token).
- **Licensing.** Repo is MIT. React Bits source is MIT + Commons Clause (no selling the components); attributed in README and in each vendored file header with source URL and date.
- **Billing owner** of the Blaze project is a team adult (adviser or parent). Budget alert at $5.
- **Venue has wifi;** no offline mode.

---

<a id="architecture"></a>
## 2. Architecture

### 2.1 Overview

```
   Volunteer phone        Kiosk tablet (kiosk custom token)        Coordinator laptop
          \                         |                                    /
           +------------ React SPA (Vite, Tailwind 4, React Bits) --------------+
           | src/pages/*  src/hooks/*  src/lib/data/* (reads, onSnapshot)        |
           | src/lib/api.ts (typed client for {endpoint, op})  Zustand  TanStack |
           +-----------------------------+---------------------------------------+
                                         | httpsCallable({op, ...})     | Firestore reads
                                         v                              v
   shared/  zod schemas, errors, state machine, hours, reliability, ics, clock, config, ops list
         ^ imported by client and Functions; bundled into the functions deploy dir by esbuild
   +-------------------- Cloud Functions (Node 22, v2) ------------------------------+
   | callables: volunteer | coordinator | kiosk | admin | ai   (defineCallable, op)  |
   | triggers:  recomputeVolunteerStats (bounded)   supersedeLetters                 |
   | scheduler: runDueJobs (every 5 min, lease + nextActionAt)                       |
   | http:      health                                                               |
   | lib: reports/PDF (pdfkit, 512 MB)  ai/ (Anthropic)  turnstile/  kioskCode/      |
   +----------------------------+---------------------------------------------------+
                                | Admin SDK (rules do not apply; each op authorizes itself)
                                v
        Firestore (rules: clients read; client writes only for allowlisted prefs,
                   saved items, collections, reviews)          Storage (rules)
                                |
        Secrets: ANTHROPIC_API_KEY, TURNSTILE_SECRET, KIOSK_MASTER_SECRET, DEMO_ACCOUNT_PASSWORD
        External: Anthropic API, Cloudflare Turnstile siteverify, Mapbox (client, optional)
```

### 2.2 Layers

| Layer | Path | Responsibility |
|---|---|---|
| Client SPA | `src/` | Pages in feature folders (`src/pages/volunteer`, `src/pages/org`, `src/pages/kiosk`, `src/pages/admin`, `src/pages/public`), hooks, components. Reads Firestore directly (`src/lib/data/*.ts` repositories, one file per domain, each under 800 lines). All trusted writes go through `src/lib/api.ts`. |
| Shared domain | `shared/` | `schemas/*.ts` (zod, one per domain), `errors.ts` (catalog), `stateMachine.ts`, `hours.ts`, `reliability.ts`, `ics.ts`, `clock.ts`, `config.ts`, `ops.ts` (endpoint to op list), `kioskCode.ts` (window math; HMAC itself runs server-side), `format.ts` (time display). 100% line and branch coverage. |
| Functions | `functions/src/` | `index.ts` (exports only), `endpoints/{volunteer,coordinator,kiosk,admin,ai}.ts` (op dispatch tables), `ops/<op>.ts` (one handler per op, one test per op), `triggers/`, `jobs/runDueJobs.ts`, `lib/defineCallable.ts`, `lib/auth.ts` (resource resolvers), `lib/log.ts`, `reports/` (ported pdfkit pipeline, one file per section), `ai/`, `turnstile/`. |
| Data | Firestore + Storage | See [#data-model](#data-model). |
| Deploy artifact | `functions/deploy/` (generated, gitignored) | Bundled `lib/index.js`, a `package.json` with runtime deps only (no workspace or `shared` entry), and its own lockfile. CI runs `npm ci` in a clean copy and an `emulators:exec` smoke test against the bundle. |

### 2.3 Function exports

`functions/src/index.ts` exports exactly:

| Export | Kind | Notes |
|---|---|---|
| `volunteer` | onCall | ops in [#api](#api); memory 512 MB (letters, reports) |
| `coordinator` | onCall | memory 512 MB (org reports) |
| `kiosk` | onCall | `minInstances: 1` set only on competition day via env `KIOSK_MIN_INSTANCES` |
| `admin` | onCall | |
| `ai` | onCall | timeout 30 s |
| `recomputeVolunteerStats` | Firestore trigger group: `onHoursLog` (`hoursLogs/{id}` written), `onSignup` (`signups/{id}` written) | bounded, see [#fn-stats](#fn-stats) |
| `supersedeLetters` | Firestore trigger on `hoursLogs/{id}` written | see [#fn-supersede](#fn-supersede) |
| `runDueJobs` | onSchedule every 5 minutes; also `admin` op `runDueJobs` | the only scheduler |
| `health` | onRequest GET | returns `{ok, version, demoMode, lastJobRunAt}` |

`check:functions-index` asserts this export list, that every op is registered through `defineCallable`, and that `shared/ops.ts`, the endpoint dispatch tables, and the typed client map in `src/lib/api.ts` list the same ops.

### 2.4 Trust rules

- Every mutation of shared or server-owned state is a callable op. Rules let clients write only: allowlisted preference keys in `users/{uid}/private/profile`, `users/{uid}/saved/*`, `collections/*` (coordinators/admins), and `reviews/*` (Tier 2).
- Functions use the Admin SDK, so **Firestore rules do not bind them.** Each op enforces its own authorization (resource-derived, [G2](#auth-resolvers)), input schema, allowed state transitions, idempotency, and audit fields, as listed in [#api](#api).
- Functions write timestamps from `clock.now()` only, never `FieldValue.serverTimestamp()` (ESLint `no-restricted-properties` in `functions/src`).
- Firestore stores instants as `Timestamp` (UTC). Each organization has an IANA `timeZone`; all display, thresholds that depend on calendar days, and `.ics` output use it through date-fns-tz.

---

<a id="data-model"></a>
## 3. Data model

### 3.1 Terms

| Term | Meaning |
|---|---|
| **organization** (`orgId`) | A nonprofit. Prose says "organization", code says `org`. |
| **opportunity** (`opportunityId`) | The listing: what the volunteering is (title, description, cause area, skills, min age, location, type). Has one or more instances. |
| **instance** (`instanceId`) | One dated, timed occurrence of an opportunity, with capacity, waitlist, and roster. UI copy calls it a "shift". Signups, check-in, and hours attach to instances. |
| **series** (`seriesId`) | A weekly recurrence rule that materializes instances for a recurring opportunity (Tier 2). |
| **signup** | One volunteer's place on one instance. Id `{instanceId}_{uid}`. |
| **hours log** | Credited minutes for one signup, or a manual off-platform entry. |
| **letter** | An issued hours letter (PDF + evidence snapshot). Its public projection is a **letter verification**. |
| **coordinator** | A member of an org with role `owner` or `coordinator`. "Org coordinators" in this spec means both roles. |

Common conventions: every server-written doc has `createdAt` and `updatedAt` (`Timestamp` from `clock.now()`). `uid` is a Firebase Auth uid. Enums are lowercase kebab strings defined once in `shared/schemas`. `CauseArea` enum: `hunger-food-security`, `education-youth`, `health-wellness`, `environment`, `animal-welfare`, `housing-homelessness`, `seniors`, `arts-culture`, `disaster-relief`, `community-development`.

Writer column: **F** = Functions only, **C** = client under rules, **S** = seed/admin script.

<a id="dm-organizations"></a>
### 3.2 organizations/{orgId} (Tier 0 seeded; registration Tier 1)

| Field | Type | Writer | Notes |
|---|---|---|---|
| name | string 2-80 | F | change resets `verified` to false |
| mission | string <= 500 | F | |
| causeAreas | CauseArea[] 1-3 | F | |
| ein | string `^\d{2}-\d{7}$` | F | change resets `verified` to false |
| address | {line1, city, state, zip} | F | public |
| geo | {lat, lng, geohash} or null | F | from seed or Mapbox geocode |
| contactEmail | string email | F | |
| contactPhone | E.164 string or null | F | |
| website | URL or null | F | |
| timeZone | IANA string, default `America/Chicago` | F | |
| photoPaths | string[] <= 6 | F | Storage `orgs/{orgId}/photos/*` |
| ownerUid | string | F | server-controlled |
| verified | bool | F | only `verifyOrganization` sets true |
| verifiedAt, verifiedBy | Timestamp, uid or null | F | audit |
| hasActivity | bool | F | true once any signup, hours log, or letter exists for the org |
| archived | bool, one-way | F | archived orgs are hidden from Explore |
| archivedAt | Timestamp or null | F | |

<a id="dm-members"></a>
### 3.3 organizations/{orgId}/members/{uid} (Tier 0 seeded)

| Field | Type | Writer | Notes |
|---|---|---|---|
| uid | string | F | duplicated for collection-group query (org switcher) |
| orgId | string | F | |
| role | `owner` or `coordinator` | F | exactly one owner per org |
| displayName | string | F | |
| canViewContacts | bool | F | false when the member is under 18 (G14); refreshed by recomputeVolunteerStats |
| invitedBy | uid or null | F | |
| joinedAt | Timestamp | F | |

### 3.4 organizations/{orgId}/letterRefs/{letterId} (Tier 0)

Projection so org coordinators can list letters that count their org's hours (rules cannot test membership against an array of orgs on the letter).

| Field | Type | Writer |
|---|---|---|
| letterId, uid, displayName | string | F |
| minutesForOrg | int | F |
| status | `valid`, `superseded`, `revoked` | F |
| issuedAt | Timestamp | F |

### 3.5 invites/{inviteId} (Tier 1)

`inviteId` = SHA-256 hex of the invite code. The code itself is returned once by `createInvite` and never stored.

| Field | Type | Writer |
|---|---|---|
| orgId | string | F |
| role | `coordinator` | F |
| createdBy | uid (owner) | F |
| expiresAt | Timestamp (created + 7 days) | F |
| redeemedBy, redeemedAt | uid, Timestamp or null | F |

<a id="dm-opportunities"></a>
### 3.6 opportunities/{opportunityId} (Tier 0 seeded; CRUD Tier 1)

| Field | Type | Writer | Notes |
|---|---|---|---|
| orgId | string | F | |
| orgName, orgVerified | string, bool | F | denormalized; refreshed by updateOrganization/verifyOrganization |
| title | string 4-80 | F | |
| description | string <= 2000 | F | |
| causeArea | CauseArea | F | |
| type | `one-time`, `recurring`, `virtual`, `skilled` | F | |
| skills | string[] <= 10, each <= 40 | F | |
| minAge | int 13-21, default 13 | F | |
| location | {address, geo} or null | F | null when `type == virtual` |
| seriesId | string or null | F | Tier 2 |
| status | `active` or `archived` | F | |
| nextInstanceStart | Timestamp or null | F | for Explore sort |
| createdBy | uid | F | |

### 3.7 series/{seriesId} (Tier 2)

| Field | Type | Writer |
|---|---|---|
| orgId, opportunityId | string | F |
| rule | {weekdays: int[] 0-6, startTime `HH:mm`, endTime `HH:mm`} in org timeZone | F |
| capacity | int 1-200 | F |
| startsOn, endsOn | `YYYY-MM-DD`, `YYYY-MM-DD` or null | F |
| materializedThrough | Timestamp | F |
| nextExtendAt | Timestamp | F (materializedThrough minus 7 days) |
| status | `active` or `ended` | F |

<a id="dm-instances"></a>
### 3.8 instances/{instanceId} (Tier 0)

| Field | Type | Writer | Notes |
|---|---|---|---|
| orgId, opportunityId | string | F | |
| seriesId | string or null | F | |
| title, orgName, orgVerified, minAge, timeZone | denormalized | F | |
| start, end | Timestamp | F | end > start, duration <= 12 h |
| capacity | int 1-200 | F | |
| signupCount | int | F | seats taken: confirmed + checked-in + completed |
| waitlist | [{uid, signupId, seq}] ordered by seq, length <= capacity | F | |
| waitlistSeq | int, monotonic | F | next seq to assign |
| checkedInCount | int | F | |
| status | `scheduled`, `cancelled`, `finalized` | F | |
| cutoffAt | Timestamp (start - 2 h) | F | |
| finalizeAt | Timestamp (end + 30 min) | F | |
| cutoffDoneAt, finalizedAt | Timestamp or null | F | idempotency markers set in transactions |
| nextActionAt | Timestamp or null | F | min of pending cutoffAt/finalizeAt; null when finalized |
| sequence | int | F | `.ics` SEQUENCE; +1 on time change or cancel |
| cancelledAt, cancelledBy, cancelReason | | F | audit |

### 3.9 instanceSecrets/{instanceId} (Tier 0)

| Field | Type | Writer | Notes |
|---|---|---|---|
| salt | 32 random bytes, base64 | F | per-instance kiosk key = HKDF-SHA256(KIOSK_MASTER_SECRET, salt, info `kiosk:{instanceId}:v{keyVersion}`) |
| keyVersion | int | F | |

No client access. Kiosk codes are never stored.

<a id="dm-signups"></a>
### 3.10 signups/{instanceId}_{uid} (Tier 0)

| Field | Type | Writer | Notes |
|---|---|---|---|
| instanceId, opportunityId, orgId, uid | string | F | |
| displayName | string | F | first name + last initial |
| instanceStart, instanceEnd | Timestamp | F | denormalized for queries |
| status | `confirmed`, `waitlisted`, `checked-in`, `completed`, `no-show`, `excused`, `cancelled` | F | [#state-machine](#state-machine) |
| waitlistSeq | int or null | F | |
| walkUp | bool | F | signed up after cutoff |
| promotedAt | Timestamp or null | F | |
| lateCancel | bool | F | only confirmed signups cancelled < 24 h before start by the volunteer |
| cancelReason | `volunteer`, `promotion-release`, `waitlist-cutoff`, `org-cancelled` or null | F | |
| cancelledAt | Timestamp or null | F | |
| checkInAt, checkOutAt | Timestamp or null | F | |
| autoCompleted | bool | F | completed by finalizeShift or mid-shift cancel |
| excuseReason | `late-promotion`, `coordinator` or null | F | |
| attendance | {by, at, note} or null | F | audit for setAttendance |
| disputeOpen | bool | F | |
| dispute | {note, openedAt, resolvedAt, resolvedBy} or null | F | |
| history | [{from, to, actor, op, at}] <= 20 | F | audit trail |

<a id="dm-signupcontacts"></a>
### 3.11 signupContacts/{signupId} (Tier 0)

Kept apart from `signups` so the kiosk token can read the roster without contact data, and so snapshot refreshes do not fire the signups trigger.

| Field | Type | Writer | Notes |
|---|---|---|---|
| orgId, instanceId, uid | string | F | |
| hidden | bool | F | true when volunteer is a minor and org is unverified (T4); PII fields are then absent |
| fullName, email | string | F | |
| phone | E.164 or null | F | |
| isMinor | bool | F | |
| reliability | {attended, noShows, lateCancels, total, score or null, isNew} | F | coordinator-only (T3) |
| frozen | bool | F | set true at finalize; frozen snapshots never refresh |
| refreshedAt | Timestamp | F | |

<a id="dm-hourslogs"></a>
### 3.12 hoursLogs/{logId} (Tier 0)

`logId` = `signupId` for shift logs (one log per signup); `manual_{sha256(uid|requestNonce)}` for manual logs.

| Field | Type | Writer | Notes |
|---|---|---|---|
| uid, orgId | string | F | |
| instanceId, signupId | string or null | F | null for manual |
| source | `kiosk`, `finalize`, `coordinator`, `manual`, `org-cancel` | F | |
| date | Timestamp | F | shift start, or service date for manual |
| minutes | int, multiple of 15, 0-720 | F | [#hours](#hours) |
| status | `approved`, `pending`, `rejected` | F | only approved counts |
| needsReview | bool | F | |
| description | string <= 500 | F | manual only |
| reviewedBy, reviewedAt, rejectReason | | F | audit |

<a id="dm-letters"></a>
### 3.13 letters/{letterId} (Tier 0)

`letterId` = first 32 hex of SHA-256(`uid|scopeKey|requestNonce`).

| Field | Type | Writer | Notes |
|---|---|---|---|
| uid, displayName | string | F | |
| scope | {orgId or `ALL`, from `YYYY-MM-DD`, to `YYYY-MM-DD`} | F | |
| scopeKey | `{orgId or ALL}:{from}:{to}` | F | same scope = exact match |
| orgIds | string[] | F | orgs whose hours are counted |
| verifyCode | 26-char base32 (128 bits) | F | |
| status | `valid`, `superseded`, `revoked` | F | |
| evidence | {logIds[], perOrg: [{orgId, orgName, verified, minutes}], totalMinutes, excludedUnverifiedMinutes, excludedUnverifiedCount, from, to} | F | frozen at issuance (G19) |
| rendererVersion | string | F | |
| pdfPath | string | F | `letters/{uid}/{letterId}.pdf` |
| pdfStatus | `generating`, `ready`, `failed` | F | |
| issuedAt | Timestamp | F | |
| supersededAt, supersededBy, supersededReason | Timestamp, letterId or null, `reissued` or `hours-changed` | F | |
| revokedAt, revokedBy | Timestamp, uid | F | |
| revokeReason | `issued-in-error`, `hours-disputed`, `duplicate`, `other` | F | |
| revokeNote | string <= 500 or null | F | private |

<a id="dm-verifications"></a>
### 3.14 letterVerifications/{verifyCode} (Tier 0)

Minimal public projection only.

| Field | Type | Writer |
|---|---|---|
| displayName | first name + last initial | F |
| orgNames | string[] (verified orgs only) | F |
| totalMinutes | int (verified orgs only) | F |
| from, to | `YYYY-MM-DD` | F |
| issuedAt | Timestamp | F |
| status | `valid`, `superseded`, `revoked` | F |
| supersededByIssuedAt | Timestamp or null | F |
| revokeReasonLabel | enum label or null | F |

### 3.15 notifications/{uid}/items/{itemId} (Tier 1)

| Field | Type | Writer |
|---|---|---|
| type | `waitlist-promoted`, `waitlist-closed`, `shift-cancelled`, `shift-changed`, `hours-approved`, `hours-rejected`, `attendance-changed`, `letter-superseded`, `letter-revoked`, `dispute-opened` (to coordinators), `shift-invite` (Tier 2) | F |
| title, body | string | F |
| link | app path | F |
| data | {instanceId?, signupId?, letterId?} | F |
| read | bool | F (markNotificationsRead) |

Shift reminders are not stored: the client computes them from confirmed signups starting within 24 h.

<a id="dm-users"></a>
### 3.16 users/{uid} (Tier 0)

Allowlisted projection, written only by Functions through a strict zod schema.

| Field | Type | Writer |
|---|---|---|
| displayName | first name + last initial | F |
| avatarPath | string or null | F |
| badges | subset of `hours-25`, `hours-50`, `hours-100` | F |
| totalApprovedHours | number, 2 decimals | F |
| orgsHelpedCount | int | F |
| streakWeeks | int | F |

<a id="dm-private"></a>
### 3.17 users/{uid}/private/profile (Tier 0 seeded; completeProfile Tier 1)

| Field | Type | Writer | Notes |
|---|---|---|---|
| firstName, lastName, fullName | string | F | |
| email | string | F | from Auth |
| phone | E.164 or null | F | |
| birthDate | `YYYY-MM-DD` | F | set once; admin-only correction |
| isMinor | bool | F | cached; server decisions recompute age from birthDate (G11) |
| interests | CauseArea[] <= 10 | F | |
| skills | string[] <= 20, each <= 40 | F | |
| availability | {mon..sun: {morning, afternoon, evening: bool}} | F | |
| zip, homeGeohash | string, geohash precision 5 or null | F | never an exact address |
| profileComplete, profileCompletedAt | bool, Timestamp | F | |
| reliability | {attended, noShows, lateCancels, total, score or null, isNew, windowFrom} | F | visible to the volunteer |
| textSize | 100, 125, 150 | C | |
| contrast | `normal`, `high` | C | |
| reducedMotion | bool | C | |
| notificationPrefs | {discoverable: bool} | C | discoverable = may be ranked for orgs they have not served |
| milestonesSeen | int[] subset of 25, 50, 100 | C | |

### 3.18 users/{uid}/saved/{kind}_{refId} (Tier 1)

| Field | Type | Writer |
|---|---|---|
| kind | `org` or `opportunity` | C |
| refId | string | C |
| savedAt | request.time | C |

### 3.19 collections/{collectionId} (Tier 2)

| Field | Type | Writer |
|---|---|---|
| title | string 4-80 | C |
| description | string <= 500 | C |
| items | [{kind: `org` or `opportunity`, refId}] <= 30 | C |
| orgId | string or null (null = admin-authored) | C |
| authorUid | uid | C |
| published | bool | C |
| updatedAt | request.time | C |

### 3.20 reviews/{signupId} (Tier 2)

| Field | Type | Writer |
|---|---|---|
| orgId, uid, displayName | string | C (author) |
| rating | int 1-5 | C (author) |
| tags | subset of `well-organized`, `welcoming`, `meaningful-impact`, `good-communication`, `accessible` | C |
| text | string <= 1000 | C |
| response | {text <= 1000, by, at} or null | C (org coordinator) |
| createdAt, updatedAt | request.time | C |

### 3.21 Server-only collections

| Collection | Fields | Tier |
|---|---|---|
| aiUsage/{uid} | hourWindowStart, hourCount, day `YYYY-MM-DD`, dayCount | 1 |
| aiUsage/_global | day, count | 1 |
| rateLimits/{uid}_{bucket} | windowStart, count | 0 |
| turnstileTokens/{sha256} | consumedAt, expiresAt (10 min) | 1 |
| jobLeases/runDueJobs | holder (runId), expiresAt (now + 4 min) | 0 |
| jobRuns/{runId} | trigger `schedule` or `admin`, startedAt, finishedAt, processed {cutoffs, finalized, seriesExtended}, more bool, errors [{id, code}], outcome `ok`, `partial`, `error`, `skipped-lease` | 0 (admin read) |
| demoClock/global | offsetMs, setBy, setAt | 0 (signed-in read) |
| reports/{reportId} | ownerUid, kind `volunteer-hours` or `org-participation`, orgId or null, params {from, to, sections[], themeId}, status `generating`, `ready`, `failed`, pdfPath | 1 (owner read) |

Seed data carries `meta/seed.schemaVersion`; `demo:reset` rebuilds when it differs.

### 3.22 Storage

| Path | Read | Write | Constraints |
|---|---|---|---|
| `orgs/{orgId}/photos/{file}` | public | org coordinators (rules read members doc) | `image/*`, < 5 MB |
| `avatars/{uid}/{file}` | signed-in | self | `image/*`, < 5 MB |
| `letters/{uid}/{letterId}.pdf` | owner uid | Functions only | `application/pdf` |
| `reports/{uid}/{reportId}.pdf` | owner uid | Functions only | `application/pdf` |

---

<a id="roles"></a>
## 4. Roles and authorization

### 4.1 Roles

| Role | How assigned | Can |
|---|---|---|
| visitor | not signed in | Browse Explore, org pages, opportunity pages, help articles (BM25 only), `/verify` |
| volunteer | any signed-in user with a completed profile | Sign up, check in/out, view own hours, issue letters, AI Q&A, saved items, reviews (Tier 2) |
| coordinator | `organizations/{orgId}/members/{uid}` role `coordinator`, via invite | Manage that org's opportunities, instances, roster, kiosk, hours approval, attendance, reports |
| owner | members doc role `owner`, created by registerOrganization | Coordinator powers + org edits, invites, member removal, letter revocation for letters counting the org |
| admin | custom claim `admin: true`, set by `scripts/set-admin-claim.mjs` (service account); client forces an ID token refresh after the script runs | Verify orgs, run due jobs, demo controls, revoke any letter, birth-date correction, admin-authored collections |
| kiosk | custom token from startKiosk with claims `kioskInstanceId`, `kioskOrgId`, `kioskExp` (12 h) | Call `kiosk.issueKioskCode` for its instance; read that instance and its signups. Nothing else. |

A user can be a volunteer and a member of several orgs. The org switcher shows only orgs where the user has a members doc.

<a id="minors"></a>
### 4.2 Minor safety

| Rule | Enforcement |
|---|---|
| Under 13 never creates an account (G18) | Onboarding asks birth date before the Auth account is created and stops with "You must be 13 or older to use this app" plus kind copy pointing to a parent or guardian. completeProfile repeats the check; if it fails it deletes the Auth user and any Firestore/Storage data for that uid and logs no PII. |
| Age is computed at each decision (G11) | `ageOn(birthDate, clock.now(), tz)` in shared; `isMinor` is a cache for display and rules only |
| Minors cannot sign up for shifts of unverified orgs (G14) | signup op, error `MINOR_UNVERIFIED_ORG` |
| Only adults register orgs (G14) | registerOrganization, error `ADULT_REQUIRED` |
| Minor coordinators see no contact snapshots (G14) | members.canViewContacts = false; rules on signupContacts |
| Unverified orgs see display names only for minors (T4) | signupContacts.hidden = true; refreshed when verified flips |
| Public projections use first name + last initial | displayName derived by Functions for everyone |
| Volunteer location is coarse | homeGeohash precision 5 (about 5 km) |
| Shift minAge enforced | signup op checks age at instance start, error `AGE_BELOW_MIN` |

<a id="rules-matrix"></a>
### 4.3 Firestore rules matrix

Helpers: `signedIn()` (has auth and no kiosk claim), `isAdmin()` (`token.admin == true`), `isMember(orgId)` (members doc exists with role owner or coordinator), `isOwner(orgId)`, `isKioskFor(instanceId)` (`token.kioskInstanceId == instanceId && token.kioskExp > request.time`). "none" means denied for every client.

| Collection | Read | Create | Update | Delete |
|---|---|---|---|---|
| <a id="rules-organizations"></a>organizations | public | none | none | none |
| organizations/{id}/members | isMember(id), or own doc | none | none | none |
| organizations/{id}/letterRefs | isMember(id) | none | none | none |
| invites | isOwner(resource.orgId) | none | none | none |
| opportunities | public | none | none | none |
| series | public | none | none | none |
| instances | public | none | none | none |
| instanceSecrets | none | none | none | none |
| <a id="rules-signups"></a>signups | own uid; isMember(resource.orgId); isKioskFor(resource.instanceId) | none | none | none |
| <a id="rules-signupcontacts"></a>signupContacts | isMember(resource.orgId) and members doc canViewContacts == true | none | none | none |
| hoursLogs | own uid; isMember(resource.orgId) | none | none | none |
| letters | own uid; isAdmin() | none | none | none |
| letterVerifications | `get` public by exact id; `list` denied | none | none | none |
| notifications/{uid}/items | uid == auth.uid | none | none | none |
| users/{uid} | uid == auth.uid; isAdmin() | none | none | none |
| <a id="rules-private"></a>users/{uid}/private/profile | uid == auth.uid | none | self, only if `diff().affectedKeys().hasOnly([textSize, contrast, reducedMotion, notificationPrefs, milestonesSeen])` and each passes its type check | none |
| users/{uid}/saved/{id} | self | self; id == `{kind}_{refId}`; schema check | none | self |
| collections | `published == true`; or isMember(orgId); or isAdmin() | signedIn author; orgId != null requires isMember(orgId); orgId == null requires isAdmin(); schema check | same as create, authorUid unchanged | isMember(orgId) or isAdmin() |
| reviews/{signupId} | public | author: `get(signups/{signupId})` has uid == auth.uid, status == completed, orgId == request.orgId; doc id is the signupId so one review per signup | author: only rating, tags, text, updatedAt; or isMember(orgId): only response | author; isAdmin() |
| aiUsage, rateLimits, turnstileTokens, jobLeases | none | none | none | none |
| jobRuns | isAdmin() | none | none | none |
| demoClock | signed in (incl. kiosk) | none | none | none |
| reports | ownerUid == auth.uid | none | none | ownerUid == auth.uid |

Rules tests cover every row, including at least one denied case per row, the minor and extra-key cases for private profile, a kiosk token reading another instance, and a second review create for the same signup.

### 4.4 Function-side authorization

Rules do not apply to Admin-SDK Functions. `defineCallable` enforces, in order: App Check (when `APPCHECK_ENFORCE`), auth kind, profile gate (G11: every volunteer and coordinator op except completeProfile requires `profileComplete`), resource resolution and role check (below), input schema, rate limit, handler, structured log.

<a id="auth-resolvers"></a>
Resource-derived resolvers (G2). When an op names a resource id, the resolver loads that resource and derives `orgId` from it; a client-supplied `orgId` is accepted only for ops that create a new resource under an org.

| Resolver | Loads | Derives | Grants when |
|---|---|---|---|
| `signedIn` | none | none | auth present, not a kiosk token |
| `volunteerOf(signupId)` | signup | uid | signup.uid == caller |
| `coordinatorOfInstance(instanceId)` | instance | orgId | caller is owner/coordinator of orgId |
| `coordinatorOfSignup(signupId)` | signup | orgId | same |
| `coordinatorOfLog(logId)` | hours log | orgId | same; bulk ops require all logs share one orgId |
| `coordinatorOfOpportunity(opportunityId)` | opportunity | orgId | same |
| `coordinatorOfSeries(seriesId)` | series | orgId | same |
| `coordinatorOfOrg(orgId)` | org | orgId | same (create-type ops only) |
| `ownerOfOrg(orgId)` | org | orgId | caller role owner |
| `letterRevoker(letterId)` | letter | orgIds | admin, or owner of any org in letter.orgIds |
| `kioskOrCoordinator(instanceId)` | instance | orgId | kiosk token for that instance, or coordinator of orgId |
| `admin` | none | none | admin claim |

Every coordinator op has a cross-org denial test (coordinator of org A targets a resource of org B, expects `PERMISSION_DENIED`), and a kiosk-token denial test.

---

<a id="api"></a>
## 5. API (callable operations)

### 5.1 Conventions

- Client calls `api.<endpoint>.<op>(input)`, which sends `httpsCallable(endpoint)({op, ...input})`. Input and output schemas live in `shared/schemas/ops/*.ts`.
- Every op returns `{ok: true, data, requestId}` or throws an `HttpsError` whose `details` is `{code, params, requestId}` with `code` from the [error catalog](#errors).
- Every op logs one structured JSON line: `{fn: "<endpoint>.<op>", uid, orgId, instanceId, outcome, code, ms, requestId}`. No names, emails, phones, or birth dates in logs.
- `requestNonce` is a client UUID generated once per user intent (per click, reused on retry). It makes create-type ops idempotent.
- Writes that read-then-write shared state run in one Admin-SDK transaction; `aborted` contention is retried up to 3 times with backoff, then `CONTENTION`.
- "Tier" is the tier that must ship the op. Every op has one handler file `functions/src/ops/<op>.ts` and one test file.

### 5.2 Operation table

Errors list op-specific codes; every op can also return `AUTH_REQUIRED`, `PROFILE_INCOMPLETE` (except completeProfile), `PERMISSION_DENIED`, `NOT_FOUND`, `INVALID_INPUT`, `CONTENTION`, `INTERNAL`.

| Endpoint.op | Auth resolver | Input | Output | Idempotency | Transitions | Errors | Audit | Tier |
|---|---|---|---|---|---|---|---|---|
| <a id="fn-completeprofile"></a>volunteer.completeProfile | signedIn (gate exempt) | firstName, lastName (1-40), birthDate, interests?, skills?, availability?, phone?, zip?, turnstileToken | displayName, isMinor | Already complete: returns current values; a different birthDate is refused | none | AGE_UNDER_13 (checked first), TURNSTILE_FAILED, BIRTHDATE_LOCKED | profileCompletedAt, turnstileVerifiedAt | 1 |
| volunteer.updateProfile | signedIn | firstName?, lastName?, interests?, skills?, availability?, phone?, zip?, avatarPath? | displayName | Set semantics | none | none extra | updatedAt | 1 |
| <a id="fn-signup"></a>volunteer.signup | signedIn; loads instance | instanceId | signupId, status, waitlistPosition?, waitlistSize? | Doc id `{instanceId}_{uid}`; an active signup is returned unchanged | (none) to confirmed; (none) to waitlisted | SHIFT_FULL, WAITLIST_CLOSED, SHIFT_STARTED, SHIFT_CANCELLED, AGE_BELOW_MIN, MINOR_UNVERIFIED_ORG, SIGNUP_CANCELLED_BEFORE | history | 0 (waitlist, walk-up: 1) |
| volunteer.signupSeries | signedIn; loads series | seriesId | results [{instanceId, date, outcome: confirmed, waitlisted, skipped, reason?}], coversThrough | Per-instance signup idempotency | as signup, per date | as signup, per date (reported, not thrown) | history | 2 |
| volunteer.extendSeriesSignup | signedIn; loads series | seriesId | same as signupSeries, only dates after the previous coversThrough | same | same | same | history | 2 |
| <a id="fn-cancelsignup"></a>volunteer.cancelSignup | volunteerOf(signupId) | signupId, release? | status, lateCancel, promotedSignupId? | Already cancelled: returns current | confirmed to cancelled; waitlisted to cancelled; head of waitlist: waitlisted to confirmed | SHIFT_STARTED, INVALID_TRANSITION, RELEASE_NOT_ALLOWED | cancelledAt, history | 0 (promotion, release: 1) |
| volunteer.submitManualHours | signedIn; loads org by orgId | orgId, date, minutes (15-720, step 15), description (10-500), requestNonce | logId, status `pending` | logId from nonce | log created `pending` | DATE_OUT_OF_RANGE | createdAt | 1 |
| volunteer.requestAttendanceReview | volunteerOf(signupId) | signupId, note (10-500) | disputeOpen | Open dispute: returns current | none (sets disputeOpen) | INVALID_TRANSITION (status must be no-show), DISPUTE_WINDOW_CLOSED (over 30 days) | dispute.openedAt; notification to org coordinators | 1 |
| <a id="fn-issueletter"></a>volunteer.issueLetter | signedIn | scope {orgId or ALL, from, to}, requestNonce | letterId, verifyCode, pdfStatus, totalMinutes, excludedUnverifiedMinutes | letterId = hash(uid, scopeKey, requestNonce); existing letter returned, PDF re-rendered if `failed` | letter (none) to valid; previous same-scope valid to superseded | NO_APPROVED_HOURS | issuedAt, rendererVersion | 0 (one template, scope ALL only in Tier 0) |
| volunteer.generateVolunteerReport | signedIn | from, to, sections[], themeId, requestNonce | reportId, status | reportId from nonce | none | none extra | createdAt | 1 |
| volunteer.markNotificationsRead | signedIn | itemIds (<= 100) or all: true | updated | Set semantics | none | none extra | none | 1 |
| <a id="fn-issuekioskcode"></a>kiosk.issueKioskCode | kioskOrCoordinator(instanceId) | instanceId | code, windowEndsAt, secondsRemaining, qrPayload | Pure function of the 30 s window | none | KIOSK_NOT_OPEN, SHIFT_CANCELLED, KIOSK_SESSION_EXPIRED | log only | 0 (qrPayload: 1) |
| <a id="fn-checkin"></a>kiosk.checkIn | signedIn volunteer | instanceId, code | status, checkInAt, checkOutOpensAt | Already checked in: returns existing checkInAt | confirmed to checked-in | CHECKIN_NOT_OPEN, KIOSK_CODE_INVALID, NOT_SIGNED_UP, RATE_LIMITED, SHIFT_CANCELLED | history | 0 |
| <a id="fn-checkout"></a>kiosk.checkOut | signedIn volunteer | instanceId, code | status, minutes, orgName, totalApprovedHours | Already completed: returns the existing log (log id = signupId) | checked-in to completed | CHECKOUT_NOT_OPEN, CHECKOUT_CLOSED, NOT_CHECKED_IN, KIOSK_CODE_INVALID, RATE_LIMITED | history | 0 |
| <a id="fn-registerorganization"></a>coordinator.registerOrganization | signedIn; adult; email verified | name, mission, causeAreas, ein, address, contactEmail, contactPhone?, website?, timeZone, requestNonce | orgId | orgId from hash(uid, nonce) | none | ADULT_REQUIRED, EIN_INVALID, EMAIL_NOT_VERIFIED | createdAt, ownerUid | 1 |
| coordinator.updateOrganization | ownerOfOrg(orgId) | orgId, action `update` (patch of editable fields), `archive`, or `delete` | orgId, verified | Set semantics; archive is one-way | none | ORG_HAS_ACTIVITY (delete), ORG_HAS_UPCOMING_SHIFTS (archive), EIN_INVALID | updatedAt, archivedAt | 1 |
| coordinator.createInvite | ownerOfOrg(orgId) | orgId | code (10 chars base32, shown once), expiresAt | Each call issues a new code | none | none extra | createdBy | 1 |
| coordinator.redeemInvite | signedIn | code | orgId, role | Redeemed by caller: returns ok | none | INVITE_INVALID, ALREADY_MEMBER | redeemedBy, redeemedAt | 1 |
| coordinator.removeMember | ownerOfOrg(orgId) | orgId, uid | none | Missing member: ok | none | CANNOT_REMOVE_OWNER | log | 1 |
| coordinator.upsertOpportunity | create: coordinatorOfOrg(orgId); update: coordinatorOfOpportunity | opportunity fields, requestNonce on create | opportunityId | Create id from nonce | none | none extra | createdBy, updatedAt | 1 |
| coordinator.createInstance | coordinatorOfOpportunity | opportunityId, start, end, capacity (1-200), requestNonce | instanceId | instanceId from nonce; also writes instanceSecrets | none | INSTANCE_TIME_INVALID | createdAt | 1 |
| coordinator.updateInstance | coordinatorOfInstance | instanceId, start?, end?, capacity? | instanceId, sequence, promoted[] | Unchanged input: no-op | waitlisted to confirmed (capacity increase before cutoff) | CAPACITY_BELOW_SIGNUPS (params excess), SHIFT_STARTED, INSTANCE_TIME_INVALID | sequence, history | 1 |
| <a id="fn-cancelinstance"></a>coordinator.cancelInstance | coordinatorOfInstance | instanceId, reason (3-200) | cancelledSignups, completedSignups | Already cancelled: returns counts | waitlisted to cancelled; confirmed to cancelled; checked-in to completed (mid-shift) | SHIFT_ENDED | cancelledAt, cancelledBy, cancelReason | 1 |
| coordinator.upsertSeries | coordinatorOfOpportunity | opportunityId, rule, capacity, startsOn, endsOn? | seriesId, materialized | Instance ids `{seriesId}_{YYYYMMDD}` | none | SERIES_RULE_INVALID | createdBy | 2 |
| coordinator.extendSeries | coordinatorOfSeries (also called by runDueJobs) | seriesId | created, materializedThrough | Deterministic instance ids | none | none extra | log | 2 |
| <a id="fn-startkiosk"></a>coordinator.startKiosk | coordinatorOfInstance | instanceId | customToken, expiresAt | Each call mints a new token | none | KIOSK_NOT_OPEN, SHIFT_CANCELLED | log (kioskStartedBy) | 0 |
| <a id="fn-finalizeshift"></a>coordinator.finalizeShift | coordinatorOfInstance (also called by runDueJobs) | instanceId | noShows, excused, autoCompleted, alreadyFinalized | finalizedAt marker; per-signup status checks | confirmed to no-show; confirmed to excused; checked-in to completed; waitlisted to cancelled | SHIFT_NOT_ENDED, SHIFT_CANCELLED | finalizedAt, history | 0 |
| <a id="fn-setattendance"></a>coordinator.setAttendance | coordinatorOfSignup | signupId, to (`excused`, `completed`, `no-show`, `keep`), minutes? (required for completed), note (3-500) | status, logId? | Target equals current: no-op | no-show to excused; no-show to completed; completed to no-show | INVALID_TRANSITION, MINUTES_REQUIRED | attendance {by, at, note}, history | 1 |
| <a id="fn-approvehours"></a>coordinator.approveHours | coordinatorOfLog (all logs one org) | logIds (1-50) | approved | Already approved: skipped | log pending to approved | INVALID_TRANSITION | reviewedBy, reviewedAt | 1 |
| coordinator.rejectHours | coordinatorOfLog | logId, reason (3-500) | none | Already rejected: no-op | log pending to rejected | INVALID_TRANSITION | reviewedBy, reviewedAt, rejectReason | 1 |
| <a id="fn-revokeletter"></a>coordinator.revokeLetter | letterRevoker(letterId) | letterId, reason enum, note? | none | Already revoked: no-op | letter valid or superseded to revoked | none extra | revokedAt, revokedBy, revokeReason | 1 |
| coordinator.generateOrgReport | coordinatorOfOrg(orgId) | orgId, from, to, sections[], themeId, requestNonce | reportId, status | reportId from nonce | none | none extra | createdAt | 1 |
| coordinator.rankVolunteers | coordinatorOfInstance, or coordinatorOfOrg for a draft | instanceId, or orgId + draft {causeArea, skills, start, end} | candidates [{ref, displayName, score, why[]}] (<= 20) | Read-only | none | none extra | log | 2 |
| coordinator.inviteVolunteers | coordinatorOfInstance | instanceId, refs (<= 20) | sent | Notification id `invite_{instanceId}_{uid}` | none | REF_EXPIRED | log | 2 |
| admin.verifyOrganization | admin | orgId, verified, note | none | Set semantics | none | none extra | verifiedAt, verifiedBy, note | 1 |
| <a id="fn-runduejobs"></a>admin.runDueJobs | admin | none | runId, outcome, processed | Lease | as cutoff and finalizeShift | none extra | jobRuns | 0 |
| admin.resetDemoData | admin; DEMO_MODE | shiftStartsInMin? (default 10) | counts | Full reseed | none | DEMO_MODE_REQUIRED | log | 1 |
| admin.setDemoClock | admin; demo clock allowed | offsetMs, or advanceMinutes | offsetMs, now | Set semantics | none | DEMO_MODE_REQUIRED | demoClock.setBy, setAt | 0 |
| admin.resetRateLimits | admin; DEMO_MODE | none | deleted | Set semantics | none | DEMO_MODE_REQUIRED | log | 1 |
| admin.correctBirthDate | admin | uid, birthDate, note | isMinor | Set semantics | none | AGE_UNDER_13 | birthDateCorrectedBy, birthDateCorrectedAt | 1 |
| <a id="fn-askassistant"></a>ai.askAssistant | signedIn | question (<= 2,000 chars), route? | answer, source (`ai` or `help`), limited, articles [{slug, title}] | none | none | INPUT_TOO_LONG | aiUsage | 1 |
| ai.shiftPlannerParse | coordinatorOfOrg(orgId) | orgId, text (<= 2,000 chars) | draft, source (`ai` or `parser`) | none | none | INPUT_TOO_LONG | aiUsage | 2 |

Outside the callables: `scripts/set-admin-claim.mjs` (admin claim) and the client writes allowed by [#rules-matrix](#rules-matrix).

### 5.3 Signup and cancel

**signup(instanceId)**, one transaction over the instance doc and the signup doc:

1. Load instance. `status == cancelled`: `SHIFT_CANCELLED`. `now >= start`: `SHIFT_STARTED`.
2. Existing signup doc: if status is active (confirmed, waitlisted, checked-in, completed) return it unchanged; if `cancelled` throw `SIGNUP_CANCELLED_BEFORE` (a cancelled signup is final; see [Appendix B](#appendix-b)).
3. Age at instance start from the private birthDate: below `minAge` gives `AGE_BELOW_MIN` ("You must be at least N to join this shift."). Minor and `orgVerified == false` gives `MINOR_UNVERIFIED_ORG`.
4. Seat check: `signupCount < capacity` gives `confirmed` (`walkUp = now >= cutoffAt`), `signupCount += 1`.
5. Else if `now < cutoffAt` and `waitlist.length < capacity`: `waitlisted` with `waitlistSeq = instance.waitlistSeq`, append `{uid, signupId, seq}`, `waitlistSeq += 1`.
6. Else if `now >= cutoffAt`: `WAITLIST_CLOSED` ("This shift is full and its waitlist has closed."). Else `SHIFT_FULL` ("This shift and its waitlist are full.").
7. Write signupContacts (hidden when T4 applies) and set `org.hasActivity = true` if false.

Waitlist position = 1 + number of entries with a smaller `seq`. Output `waitlistPosition` and `waitlistSize`.

**cancelSignup(signupId, release?)**, one transaction over instance + signup + promoted signup:

1. `now >= start`: `SHIFT_STARTED`. Status must be `confirmed` or `waitlisted`, else `INVALID_TRANSITION`.
2. Waitlisted: remove from `waitlist`; `cancelReason volunteer`, `lateCancel false`.
3. Confirmed: `signupCount -= 1`. With `release == true`: allowed only when `promotedAt` is set and (`now - promotedAt <= 24 h` or `start - promotedAt < 24 h`), else `RELEASE_NOT_ALLOWED`; sets `cancelReason promotion-release`, `lateCancel false`. Otherwise `cancelReason volunteer`, `lateCancel = (start - now < 24 h)`.
4. Promotion: if a seat was freed, `now < cutoffAt`, and the waitlist is non-empty, the entry with the lowest `seq` becomes `confirmed` with `promotedAt = now`, `signupCount += 1`, and receives a `waitlist-promoted` notification with Confirm and Can't make it actions. After the cutoff, freed seats are open to walk-up signups.

### 5.4 Check-in and check-out

Both require the current kiosk code. Order of checks: rate limit (10 attempts per user per 10 minutes shared by checkIn and checkOut, bucket `checkin`; excess gives `RATE_LIMITED` "Too many attempts, wait a minute." with `retryAfterSec`), instance status, time window, code, signup status.

| Op | Window (instance times) | Required status | Effect |
|---|---|---|---|
| checkIn | `start - 30 min <= now <= end`; outside: `CHECKIN_NOT_OPEN` "Check-in for this shift is not open right now." with `opensAt` | confirmed (else `NOT_SIGNED_UP`; checked-in returns existing) | status checked-in, `checkInAt = now`, `checkedInCount += 1` |
| checkOut | `checkInAt + 15 min <= now <= end + 30 min`; early: `CHECKOUT_NOT_OPEN` with `opensAt`; late: `CHECKOUT_CLOSED` | checked-in (else `NOT_CHECKED_IN`; completed returns existing log) | status completed, `checkOutAt = now`; `hoursLogs/{signupId}` with `source kiosk`, minutes per [#hours](#hours), `status approved` |

Code validation: accept the code for window `w = floor(nowMs / 30000)` or `w - 1`, compared with `crypto.timingSafeEqual` on equal-length buffers. Wrong or stale code: `KIOSK_CODE_INVALID` "That code is wrong or expired. Enter the code shown on the kiosk now."

### 5.5 finalizeShift

Runs when `now >= finalizeAt` (from runDueJobs) or when a coordinator calls it after `end` (`SHIFT_NOT_ENDED` before). If `finalizedAt` is set it returns `alreadyFinalized: true`. Each signup is processed in its own small transaction that re-checks status (safe to retry); the instance is marked last.

| Signup status at finalize | Result |
|---|---|
| confirmed, promoted within 24 h of start (`start - promotedAt < 24 h`) | excused, `excuseReason late-promotion` |
| confirmed (other) | no-show |
| checked-in without check-out | completed, `autoCompleted true`; hours log `source finalize`, minutes computed with `checkOutAt = end`, `status pending`, `needsReview true` |
| waitlisted (cutoff did not run) | cancelled, `cancelReason waitlist-cutoff` |
| completed, no-show, excused, cancelled | unchanged |

Then signupContacts for the instance get `frozen = true`, and the instance gets `status finalized`, `finalizedAt = now`, `nextActionAt = null`.

### 5.6 Letters

**issueLetter** (G19):

1. Validate scope: `from <= to`, range <= 4 years, `to` not in the future.
2. Compute `letterId`. If it exists, return it; if `pdfStatus == failed`, re-render.
3. Load the uid's approved logs in range (and org, if scoped). Read each org's current `verified`. Include only verified orgs; count excluded minutes and logs. Zero included minutes: `NO_APPROVED_HOURS` ("You have no approved hours from verified organizations in this range.").
4. Transaction: create the letter (`status valid`) with the frozen `evidence` snapshot (log ids, per-org verification state and minutes, totals, range, rendererVersion, pdfPath); create `letterVerifications/{verifyCode}` (128 random bits from `crypto.randomBytes(16)`, RFC 4648 base32 without padding, 26 chars); create `letterRefs` in each counted org; mark any other `valid` letter with the same uid + scopeKey `superseded` (`supersededReason reissued`, `supersededBy` = new id) and update its projection (`status superseded`, `supersededByIssuedAt`).
5. Render the PDF ([#letters](#letters)) to Storage; set `pdfStatus ready` or `failed`.

A later change to a counted log never edits the snapshot; it only changes `status` through supersedeLetters. Overlapping but different ranges are separate letters.

**revokeLetter**: reason enum `issued-in-error`, `hours-disputed`, `duplicate`, `other`, plus an optional private note. Sets `revoked` on the letter, its letterRefs, and the projection (`revokeReasonLabel` only, never the note). Notifies the volunteer (`letter-revoked`).

### 5.7 setAttendance, approveHours, rejectHours

| setAttendance `to` | Allowed from | Effect |
|---|---|---|
| excused | no-show | `excuseReason coordinator`; no hours |
| completed | no-show | `hoursLogs/{signupId}` with `source coordinator`, `status approved`, minutes = input (multiple of 15, 0 to scheduled length) |
| no-show | completed | hours log `status rejected`, `rejectReason attendance-changed` (fires supersedeLetters) |
| keep | no-show with an open dispute | closes the dispute without a status change |

Every call requires a note, closes any open dispute (`dispute.resolvedAt`, `resolvedBy`), writes `attendance {by, at, note}`, appends history, and notifies the volunteer (`attendance-changed`).

approveHours moves `pending` logs to `approved` (bulk up to 50, all from one org); rejectHours moves one `pending` log to `rejected` with a required reason. Approved logs change only through setAttendance. Both notify the volunteer (`hours-approved`, `hours-rejected`). Rejected logs never count.

### 5.8 registerOrganization and updateOrganization

registerOrganization requires age >= 18 (`ADULT_REQUIRED`), `auth.token.email_verified` (`EMAIL_NOT_VERIFIED`; seeded accounts are verified), and a valid EIN (`EIN_INVALID` "Enter the EIN as NN-NNNNNNN."). One transaction writes `organizations/{orgId}` (`verified false`, `hasActivity false`, `archived false`) and `members/{uid}` (`role owner`, `canViewContacts true`).

updateOrganization (owner only):
- `update`: editable fields are name, mission, causeAreas, ein, address, contactEmail, contactPhone, website, timeZone, photoPaths. Changing name or ein sets `verified = false`. Any change to `verified` refreshes `orgVerified` on opportunities and future instances and re-applies T4 hiding on open signupContacts.
- `archive`: one-way; refused with `ORG_HAS_UPCOMING_SHIFTS` while future scheduled instances have active signups.
- `delete`: allowed only when `hasActivity == false`, else `ORG_HAS_ACTIVITY` ("This organization has volunteer history, so it can be archived but not deleted.").

`verified`, `hasActivity`, `archived`, and `ownerUid` are never editable through `update`.

### 5.9 completeProfile and Turnstile (G13)

1. Age from birthDate at `clock.now()`. Under 13: delete the Auth user and any docs and files under the uid, then `AGE_UNDER_13`. Age runs before Turnstile so a signed-in under-13 user is always deleted, even though the stop screen shows no Turnstile widget.
2. If `TURNSTILE_ENABLED`, POST the token to Cloudflare siteverify with `TURNSTILE_SECRET`, then in a transaction create `turnstileTokens/{sha256(token)}` with a 10-minute expiry; an existing record means replay. Missing, invalid, or replayed: `TURNSTILE_FAILED`. When disabled (emulator), Functions log one warning line at startup.
3. Validate profile fields: interests from CauseArea, skills <= 20 items of <= 40 chars, availability flags, phone E.164, zip 5 digits mapped to a geohash-5 centroid from the bundled San Antonio ZIP table (or null).
4. Write the private profile (`profileComplete true`) and `users/{uid}` (displayName = first name + last initial).

### 5.10 Kiosk tokens and codes (G15, G21)

- **startKiosk** is allowed from `start - 60 min` to `finalizeAt` (`KIOSK_NOT_OPEN` otherwise). It mints `createCustomToken("kiosk_{instanceId}_{random8}", {kioskInstanceId, kioskOrgId, kioskExp: now + 12 h})`. The client signs the coordinator out on that device and signs in with the custom token, so the coordinator session is not left on the kiosk.
- `defineCallable` rejects kiosk tokens on every op except `kiosk.issueKioskCode` for the matching instance, and rejects tokens past `kioskExp` with `KIOSK_SESSION_EXPIRED`.
- **issueKioskCode** is allowed from `start - 30 min` to `end + 30 min`. Key = HKDF-SHA256(`KIOSK_MASTER_SECRET`, salt from instanceSecrets, info `kiosk:{instanceId}:v{keyVersion}`, 32 bytes). Code = HMAC-SHA256(key, 8-byte big-endian window index) with RFC 4226 dynamic truncation, mod 10^6, zero-padded to 6 digits. `secondsRemaining = 30 - (floor(nowMs / 1000) mod 30)`. `qrPayload = {APP_BASE_URL}/checkin?i={instanceId}&c={code}`.
- Codes are never stored or logged. Relay limitation: a person at the kiosk can relay the code to an absent volunteer within about 60 seconds. This is accepted for a supervised kiosk; the coordinator's live arrivals list supports spot checks. Documented in DEMO.md and the help article `kiosk-check-in`.

<a id="fn-runduejobs-detail"></a>
### 5.11 runDueJobs (G8)

1. Lease: transaction on `jobLeases/runDueJobs`; if `expiresAt > now` and another run holds it, write a jobRuns doc with `outcome skipped-lease` and stop. Otherwise take it for 4 minutes.
2. Query `instances where nextActionAt <= now orderBy nextActionAt limit 200`.
3. For each instance: if `cutoffDoneAt == null` and `now >= cutoffAt`, run the cutoff handler (one transaction: every waitlisted signup becomes cancelled with `cancelReason waitlist-cutoff`, `lateCancel false`, plus a `waitlist-closed` notification; `waitlist = []`; `cutoffDoneAt = now`). Then, if `finalizedAt == null` and `now >= finalizeAt`, run finalizeShift. Set `nextActionAt` to `finalizeAt`, or null when finalized.
4. Tier 2: `series where nextExtendAt <= now limit 50`; run extendSeries for each.
5. Write `jobRuns/{runId}` (counts, errors, `more` when a page was full) and release the lease. Per-instance failures are logged and retried on the next tick.

Schedule: every 5 minutes. Admins can run it any time ("Run due jobs now" on the admin page; also shown as a labeled demo control on the coordinator dashboard when DEMO_MODE is on). Overlapping runs cannot double-process: the lease serializes runs, and the per-instance markers make each step a no-op on repeat. Scheduled functions do not fire on the emulator, so local runs use the admin action.

<a id="fn-stats"></a>
### 5.12 Triggers (G1)

**recomputeVolunteerStats**
- Fires on any `hoursLogs` write, and on `signups` writes only when `before.status != after.status` (create and delete count as changes). Other signup writes return immediately.
- Recomputes for the affected uid: totalApprovedHours, orgsHelpedCount, badges, streakWeeks (public doc); reliability and the isMinor cache (private); the displayName projection.
- Writes `users/{uid}`, `users/{uid}/private/profile`, and the uid's member docs (`canViewContacts`) only when a value differs.
- Refreshes signupContacts only for that uid's non-frozen signups with status confirmed or waitlisted and `instanceStart` within now..now + 8 weeks, and only when a value differs. Past signups keep their frozen snapshot.
- Sets `organizations/{orgId}.hasActivity = true` when false.
- Never writes `hoursLogs` or `signups`, so it cannot retrigger itself.

<a id="fn-supersede"></a>
**supersedeLetters**
- Fires on `hoursLogs` writes where `status` or `minutes` changed.
- Finds `letters where evidence.logIds array-contains logId and status == valid`; for each: `status superseded`, `supersededReason hours-changed`, `supersededAt = now`; the same on letterRefs and the projection; a `letter-superseded` notification ("Your letter's hours changed. Issue a new letter to get a current one.").

---

<a id="state-machine"></a>
## 6. Signup state machine

Implemented once in `shared/stateMachine.ts` as `assertTransition(from, to, actor)`; every Function calls it before writing a status.

### 6.1 Allowed transitions

| # | From | To | Actor (op) | Conditions | Side effects |
|---|---|---|---|---|---|
| 1 | (none) | confirmed | signup | seat free, `now < start` | `signupCount += 1`; `walkUp` if `now >= cutoffAt` |
| 2 | (none) | waitlisted | signup | no seat, `now < cutoffAt`, waitlist < capacity | waitlist append with `seq` |
| 3 | waitlisted | confirmed | cancelSignup (promotion), updateInstance (capacity increase) | `now < cutoffAt`, lowest seq first | `promotedAt`, `waitlist-promoted` notification |
| 4 | waitlisted | cancelled | cancelSignup (volunteer); runDueJobs cutoff; cancelInstance | | `cancelReason` volunteer, waitlist-cutoff, or org-cancelled; `lateCancel false` |
| 5 | confirmed | cancelled | cancelSignup (volunteer or release); cancelInstance | `now < start` for volunteer | `lateCancel` only for volunteer cancels < 24 h before start; system and release cancels `false`; promotion check |
| 6 | confirmed | checked-in | checkIn | check-in window, valid code | `checkInAt` |
| 7 | checked-in | completed | checkOut; finalizeShift; cancelInstance (mid-shift) | checkOut window; or `now >= finalizeAt`; or cancel during the shift | hours log (approved for checkOut; pending + needsReview otherwise, with checkout time = `end` or the cancel time) |
| 8 | confirmed | no-show | finalizeShift | not a late promotion | none |
| 9 | confirmed | excused | finalizeShift | `start - promotedAt < 24 h` | `excuseReason late-promotion` |
| 10 | no-show | excused | setAttendance | note required | `excuseReason coordinator` |
| 11 | no-show | completed | setAttendance | note + minutes required | approved hours log |
| 12 | completed | no-show | setAttendance | note required | hours log rejected |

### 6.2 Diagram

```
                   signup (no seat, before cutoff)         signup (seat)
     (none) --------------------------------> WAITLISTED --+   (none) -----> CONFIRMED
                                                  |        |                    |  |  |
                     promote (cancel / capacity)  |        +------------------->+  |  |
                                                  v                                |  |
                                              CONFIRMED                            |  |
                                                                                   |  |
   WAITLISTED --volunteer / cutoff / org-cancel--> CANCELLED <--volunteer / org----+  |
                                                                                      |
   CONFIRMED --checkIn--> CHECKED-IN --checkOut / finalize / mid-shift cancel--> COMPLETED
   CONFIRMED --finalize--> NO-SHOW --setAttendance--> EXCUSED
   CONFIRMED --finalize (late promotion)--> EXCUSED
   NO-SHOW --setAttendance--> COMPLETED --setAttendance--> NO-SHOW
```

### 6.3 Rejected transitions (examples; everything not in 6.1 is rejected)

| From | To | Why rejected |
|---|---|---|
| any non-initial | waitlisted | waitlisting happens only at creation |
| cancelled | any | terminal; re-signup is refused with `SIGNUP_CANCELLED_BEFORE` |
| excused | any | terminal |
| completed | checked-in, confirmed | no reopening a finished shift |
| checked-in | no-show, cancelled, confirmed | arrival is recorded; finalize completes it |
| no-show | confirmed, checked-in | attendance changes go only through setAttendance targets |
| confirmed | completed | must pass through checked-in, except via setAttendance from no-show |
| waitlisted | checked-in | must be confirmed first |

The unit test enumerates all 7 x 7 status pairs (plus initial) with each actor and asserts allowed pairs succeed only with the listed actors.

---

<a id="formulas"></a>
## 7. Formulas and time

All functions below live in `shared/` and are covered at 100% lines and branches.

<a id="hours"></a>
### 7.1 Hours (G12)

```
rawMinutes = (min(checkOutAt, scheduledEnd) - max(checkInAt, scheduledStart)) / 60000
minutes    = max(0, floor(rawMinutes / 15 + 0.5) * 15)        // nearest 15, ties round up
```

- finalizeShift auto-completion uses `checkOutAt = scheduledEnd`; mid-shift cancel uses `checkOutAt = cancel time`.
- Verified letters never credit time outside the scheduled window. Coordinators adjust with setAttendance.
- `totalApprovedHours = round2(sum(approved minutes) / 60)`.
- A kiosk check-out that credits 0 minutes is never auto-approved: the log is written `pending` with `needsReview: true` and 0 minutes, checkOut returns `needsReview: true`, and the volunteer sees "0 hours counted, your coordinator will review".

Table test (shift 9:00-13:00 local unless noted):

| Check-in | Check-out | Credited minutes |
|---|---|---|
| 8:45 | 13:10 | 240 |
| 9:07 | 12:52 | 225 |
| 9:08 | 12:52 | 225 (224 raw) |
| 9:00 | 9:20 | 15 |
| 9:00 | 9:22:30 | 30 (22.5 raw, tie rounds up) |
| 8:31 | 8:50 | 0 (before start) |
| 9:10 | none (finalize, out = 13:00) | 225 (230 raw) |
| 9:00 | cancel at 11:00 | 120 |
| America/Denver, 2027-03-14 1:00-4:00 local (spring forward) | in 1:00, out 4:00 | 120 |
| America/Denver, 2027-11-07 1:00-3:00 local (fall back) | in 1:00, out 3:00 | 180 |

<a id="reliability"></a>
### 7.2 Reliability

```
window   = volunteer's last 20 finished signups, newest first, with instanceStart within the last 12 months,
           EXCLUDING: excused (any reason), early cancels (lateCancel == false, cancelReason volunteer),
           system cancels (waitlist-cutoff, org-cancelled), promotion releases, and anything that was never confirmed
finished = completed | no-show | (cancelled with lateCancel == true)
attended = count(completed); noShows = count(no-show); lateCancels = count(lateCancel)
score    = attended / (attended + noShows + 0.5 * lateCancels)
if window size < 3: isNew = true, score = null (ranking uses 0.8)
```

Guardrails (T3): visible only to the volunteer (private profile) and to coordinators of orgs where the volunteer has a signup (signupContacts); shown with its inputs; never used to block signup; never shown in discovery, the kiosk, or any public surface; volunteers can open a review request on a no-show (`requestAttendanceReview`).

Display (D12): neutral text "Attended 8 of 10 recent shifts" (`attended` of `attended + noShows + lateCancels`), never a colored score badge; "New volunteer" tag when `isNew`; volunteer view titled "Your track record" with a Request review action per no-show.

### 7.3 Thresholds

| Name | Rule | Config key |
|---|---|---|
| Waitlist cutoff | `cutoffAt = start - 2 h`; at cutoff remaining waitlisted signups are cancelled (`waitlist-cutoff`, not counted) with a notification; no promotion after it | `WAITLIST_CUTOFF_MIN` = 120 |
| Signup window | confirmed or waitlisted until cutoff; after cutoff confirmed only if a seat is free (walk-up); never at or after start | |
| Late cancel | volunteer cancel of a confirmed signup with `start - now < 24 h` sets `lateCancel` | `LATE_CANCEL_HOURS` = 24 |
| Late promotion | `start - promotedAt < 24 h`: a no-show becomes excused `late-promotion` | `LATE_PROMOTION_HOURS` = 24 |
| Promotion release | `now - promotedAt <= 24 h` or a late promotion | `RELEASE_WINDOW_HOURS` = 24 |
| Check-in window | `start - 30 min` to `end` | `CHECKIN_OPEN_BEFORE_MIN` = 30 |
| Check-out window | `checkInAt + 15 min` to `end + 30 min` | `CHECKOUT_MIN_AFTER_CHECKIN_MIN` = 15, `CHECKOUT_GRACE_MIN` = 30 |
| Finalize | `finalizeAt = end + 30 min` | |
| Kiosk code | 30 s windows; current and previous accepted | `KIOSK_ROTATION_SEC` = 30 |
| Series window | instances materialized 8 weeks ahead; extend when within 7 days of `materializedThrough` | `SERIES_WINDOW_WEEKS` = 8 |
| Milestones | 25, 50, 100 approved hours | `MILESTONES` |
| Dispute window | 30 days after the shift | `DISPUTE_WINDOW_DAYS` = 30 |

<a id="clock"></a>
### 7.4 Single clock (G6) and demo clock (X12)

- `shared/clock.ts` exports `createClock({offsetSource})` with `now(): Date`. Functions create one clock per invocation; the offset is read from `demoClock/global` on every request when `DEMO_MODE` is on (no cache, so all instances agree right after `setDemoClock`); with `DEMO_MODE` off the offset is 0 and nothing is read.
- The offset is honored only when `DEMO_MODE == true` and (`projectId` starts with `demo-` or `ALLOW_DEMO_CLOCK == true`). The competition project sets both flags; any other project ignores the doc.
- Every window check, kiosk code, job, age check, and stored timestamp in Functions uses `clock.now()`. ESLint forbids `FieldValue.serverTimestamp` and bare `Date.now()` / `new Date()` in `functions/src` outside `clock.ts`.
- The client reads `demoClock/global` when `VITE_DEMO_MODE` is true and applies the same offset to countdowns and "opens at" text.
- Admin page: "Advance clock 15 min" (`setDemoClock {advanceMinutes: 15}`) and "Reset clock". The seed accepts `--shift-starts-in <minutes>` (default 10). e2e tests use the same op.

### 7.5 Time zones (G10, X14)

- Instants are stored as `Timestamp`. Every org has `timeZone` (default `America/Chicago`); instances copy it.
- All zone math uses date-fns-tz (`fromZonedTime`, `toZonedTime`, `formatInTimeZone`): series materialization, display, `.ics` TZID, and calendar-day rules (age on a date, streak weeks, letter ranges).
- Display: every shift time shows in the org zone with a zone label, for example "Sat, Oct 17, 9:00 AM CDT".
- Age uses the instance start date in the org zone for shift eligibility, and `clock.now()` in America/Chicago for account rules.
- Streak: consecutive ISO weeks (Monday start, org zone of each log) with at least one approved log, counted back from the current week; the current week does not break the streak until it ends.
- Table tests cross the March and November DST changes with a non-Chicago org (America/Denver) for materialization, thresholds, display, and `.ics`.

---

<a id="subsystems"></a>
## 8. Feature subsystems

<a id="kiosk"></a>
### 8.1 Kiosk (H1)

Three devices: coordinator laptop (roster), kiosk tablet (code), volunteer phone (entry). The FBLA guidelines allow "no more than three personal devices"; the demo uses exactly three.

1. Coordinator opens `/org/:orgId/kiosk/:instanceId` on the tablet while signed in and taps **Start kiosk**. startKiosk returns a custom token; the tablet signs out the coordinator and signs in as the kiosk.
2. The kiosk calls issueKioskCode at each window boundary (and on `visibilitychange` and reconnect), shows the 6-digit code at least 120 px tall, a 30 s countdown ring, and (Tier 1, secure context only) a QR of `qrPayload` next to it.
3. The volunteer opens My Shifts, taps **Check in**, and types the code (Tier 0) or scans the QR with the in-app scanner (Tier 1). checkIn runs; the phone shows "Checked in at 9:02, check-out opens 9:17".
4. Kiosk and laptop listen to `signups where instanceId == X` (onSnapshot). Arrivals animate into the kiosk list (AnimatedList); the laptop roster also reads signupContacts for contact and reliability.
5. Check-out is a separate button on the phone with the same code entry. After checkOut the phone shows the demo arc ([#screen-demo-arc](#screen-demo-arc)).

Kiosk lock: the kiosk route renders without the app shell or nav; browser back is intercepted with a confirm; **Exit kiosk** opens a coordinator sign-in form, and a successful sign-in ends the kiosk session. When the kiosk token expires (12 h) or is rejected, the screen shows "Kiosk session expired, coordinator sign-in" and returns to the same instance after sign-in and a new startKiosk.

QR is progressive enhancement (G20): the QR and the scanner render only when `window.isSecureContext` is true (deployed HTTPS, or localhost in dev). Typed code is the rehearsed primary path. The phone scanner accepts only `qrPayload` URLs from `APP_BASE_URL`.

<a id="letters"></a>
### 8.2 Letters and /verify (H3)

PDF (pdfkit, embedded fonts, server-side QR, one page, Letter size):

```
+-----------------------------------------------------------------+
| [product name]                     Verified Volunteer Hours     |
| Issued Oct 17, 2026                Letter code ABCD-EFGH-...     |
+-----------------------------------------------------------------+
| Volunteer: Jordan Rivera (full name; PDF is private to the owner)|
| Period: Aug 1, 2026 to Oct 15, 2026                             |
+-----------------------------------------------------------------+
| Organization                         Verified   Hours           |
| Alamo Community Pantry               Yes        12.25           |
| Westside Literacy Project            Yes         6.00           |
|                                       Total     18.25           |
| (Hours from unverified organizations are not included.)         |
+-----------------------------------------------------------------+
| Verify this letter at {APP_BASE_URL}/verify/{code}     [ QR ]   |
| The verify page shows the current status and totals.            |
+-----------------------------------------------------------------+
```

`/verify` has a code entry box; `/verify/:code` normalizes input (uppercase, strip spaces and dashes) and does a single `get` on `letterVerifications/{code}`. Page order (D3):

1. Status band with icon + text, never color alone: **Valid** ("This letter is current."), **Superseded** ("A newer letter was issued on DATE" or "The hours on this letter changed after it was issued."), **Revoked** ("This letter was revoked: REASON LABEL").
2. Display name (first name + last initial), total verified hours, date range, organizations.
3. Issue date and code.
4. "What this means": hours come from shift check-ins or coordinator-approved records at verified organizations; edited PDFs will not match this page.

Not found: "We couldn't find a letter with that code. Check the code and try again." Signed-out access works; App Check limits scripted traffic on the deployed site.

### 8.3 Notifications

| Tier | Surface |
|---|---|
| 1 | Header badge with unread count (`99+` cap) that opens `/me/notifications` directly; minimal list grouped by day with Mark all read; promotion banner on Explore |
| 2 | Bell menu with AnimatedList of the latest 10, same data |

Alerts are in-app only; help text says so. Reminders are computed client-side from confirmed signups starting within 24 h and shown on My Shifts and Explore; they are never stored.

| Type | Title copy | Link |
|---|---|---|
| waitlist-promoted | "You're in! {Day} {time}" with Confirm / Can't make it | `/opportunity/:instanceId` |
| waitlist-closed | "The waitlist for {title} closed" | shift |
| shift-cancelled | "{title} on {date} was cancelled by the organization" | shift |
| shift-changed | "{title} moved to {new time}" | shift |
| hours-approved / hours-rejected | "{n} hours approved at {org}" / "Hours at {org} were not approved: {reason}" | `/impact` |
| attendance-changed | "Your attendance for {title} was updated" | `/me/shifts` |
| letter-superseded / letter-revoked | "Your letter's hours changed" / "A letter was revoked" | `/impact` |
| dispute-opened | "{name} asked for a review of {title}" (coordinators) | dashboard |
| shift-invite (Tier 2) | "{org} invited you to {title}" | shift |

<a id="ai"></a>
### 8.4 AI (H2, Q&A)

| Feature | Op | Caller | Fallback |
|---|---|---|---|
| Help Q&A | `ai.askAssistant` (Tier 1) | signed-in user with a complete profile | top 3 BM25 help articles |
| Shift planner AI parse + description | `ai.shiftPlannerParse` (Tier 2) | coordinator of `orgId` | deterministic parser (Tier 1, client-side in `shared/plannerParse.ts`, also used server-side) |
| Volunteer ranking | `coordinator.rankVolunteers` (Tier 2) | coordinator | always deterministic; no AI |

Limits (shared/config, env-overridable): per user 20 calls/hour and 100/day (`aiUsage/{uid}`), global daily cap `AI_GLOBAL_DAILY_CAP` = 500 (`aiUsage/_global`; when exceeded, AI is off for everyone until the next UTC day), input 2,000 chars, output 1,024 tokens, request timeout 10 s.

Rules:
- Provider: Anthropic, model id from env `AI_MODEL`; key `ANTHROPIC_API_KEY` is a Functions secret, never a `VITE_` variable.
- `AI_ENABLED=false`, missing key (one log line at startup), 429, timeout, refusal, or output that fails its zod schema: return the fallback with `source help` or `parser`. Over the per-user limit: `limited: true` with articles.
- The system prompt contains help-article text and route context only: no user data, no private fields. The model has no tools.
- Answers render as plain text (or markdown sanitized to text formatting); never HTML, never `dangerouslySetInnerHTML`.
- The deterministic parser extracts count, weekday or date, time range, location keywords, and cause keywords from sentences like "need 12 people Sat 9-1 sorting at the food bank".

Ranking (Tier 2): candidates are the org's past volunteers (completed signups) plus volunteers with `notificationPrefs.discoverable == true`; minors are included only when the org is verified. Score = match score (skills, interests, availability for the shift's weekday/time block, distance from homeGeohash) x reliability (0.8 for new volunteers). Returns display names, a score, "why" chips, and an opaque `ref` (HMAC-signed uid, 1 h expiry) for inviteVolunteers. Volunteers' own recommended shifts are ranked client-side from their private profile without reliability.

### 8.5 Search and help

- Search: the ported Trove engine (inverted index, BM25, trie autocomplete, Levenshtein typo tolerance, geohash) with new adapters for organizations and opportunities. Explore smart filters: cause area, date range, weekday/time block, type, distance (needs coordinates), seats available, eligible for my age, verified organizations only.
- Help articles live in `src/content/help/*.md` with front matter `slug`, `title`, `tags`, `roles`. A build step writes `src/content/help/index.json`; the BM25 index is built from it at load.
- Required articles: getting-started, find-and-sign-up, waitlist-and-promotion, kiosk-check-in (incl. relay limitation), check-out-and-hours, manual-hours, verified-letters, verify-a-letter, track-record, calendar-export (incl. best-effort cancel note), accessibility-settings, alerts-are-in-app, privacy-and-minors, ai-assistant, coordinator-start-kiosk, coordinator-approve-hours, coordinator-attendance, coordinator-reports, org-verification, and one article per error `helpSlug`.
- Signed-out: BM25 article search only; the Ask box says "Sign in to ask".
- Help route context: each route maps to suggested articles (ported `helpRouteContext`).

### 8.6 Reports

| Report | Op | Sections |
|---|---|---|
| Volunteer hours report | `volunteer.generateVolunteerReport` | summary, hours by organization, hours by month (chart), shift list, milestones |
| Organization participation report | `coordinator.generateOrgReport` | summary (signups, attendance rate = completed / (completed + no-show), total approved hours), hours by opportunity, hours by month, attendance breakdown by status, top volunteers (display names), reliability distribution (Tier 2 charts) |

- PDF via the ported pdfkit pipeline, one file per section in `functions/src/reports/pdf/sections/`, embedded fonts, server-side charts and QR, Function memory 512 MB. Image or font failures omit that element with a note.
- Customization: section toggles, date range, and one of 6 preset themes (D16): `neutral`, `blue`, `green`, `purple`, `orange`, `high-contrast`, each defined from tokens and contrast-checked to 4.5:1 for text on its accent. No free hex input.
- CSV export is client-side from data the user can already read (volunteer: own logs; coordinator: org signups and logs), using the same aggregation functions from `shared/`.
- Output is stored at `reports/{uid}/{reportId}.pdf`; the builder shows generating, failed (retry with the same nonce), and ready (download) states.

<a id="ics"></a>
### 8.7 Calendar export (E2)

- Per-signup download (no subscribed feed) from the Signed up button and My Shifts.
- `UID = {signupId}@{APP_HOST}`, `TZID` = the org `timeZone` with a matching `VTIMEZONE`, `SEQUENCE` = instance `sequence`, `DTSTAMP` from the clock, location and org name.
- Cancelled signups keep a "Download cancellation" link: `METHOD:CANCEL`, `STATUS:CANCELLED`, `SEQUENCE` + 1.
- Cancellation is best-effort: Google Calendar imports may not apply it. The UI says "If your calendar still shows this shift, delete the event." The help article and DEMO.md say the same.

---

<a id="screens"></a>
## 9. Screens and UX

Screen classes: volunteer, coordinator, kiosk, and admin screens are OPERATE (app UI, no marketing sections); `/verify` and Help are READ; the signed-out home is PERSUADE with one section only.

<a id="screen-nav"></a>
### 9.1 Navigation shell (D2)

| Role | Shell | Routes |
|---|---|---|
| Visitor | Top bar: Explore, Help, Verify, Sign in | `/`, `/explore`, `/opportunity/:instanceId`, `/organizations/:orgId`, `/help`, `/help/:slug`, `/verify`, `/verify/:code`, `/login`, `/privacy`, `/terms`, `/accessibility`, 404 |
| Volunteer | Mobile: bottom tab bar Explore, My Shifts, Impact, Help. Desktop (>= 1024 px): top nav with the same items. Header: notification badge, avatar menu (Profile, Saved, Organizations, Sign out) | adds `/onboarding`, `/me/shifts`, `/checkin`, `/impact`, `/impact/letters/new`, `/impact/report`, `/me/notifications`, `/me/profile`, `/me/saved`, `/join` |
| Coordinator | Under `/org/:orgId/*`; org switcher shown only when the user has at least one membership; side nav on desktop, top tabs under 768 px | `/org/register`, `/org/:orgId/dashboard`, `/org/:orgId/shifts`, `/org/:orgId/shifts/new`, `/org/:orgId/shifts/:instanceId`, `/org/:orgId/reports`, `/org/:orgId/settings` |
| Kiosk | No shell, locked | `/org/:orgId/kiosk/:instanceId` |
| Admin | `/admin`, gated by the admin claim | `/admin` |

Users without a complete profile are routed to `/onboarding` before any volunteer or coordinator route (G11). Tier 2 adds `/collections/:id`, the command palette (Ctrl/Cmd+K), and the Explore map toggle.

<a id="screen-inventory"></a>
### 9.2 Screen inventory (D1)

| Screen | Job | Above the fold, in order | Primary action | Secondary | Tier |
|---|---|---|---|---|---|
| Home `/` (signed out) | Say what this is | One-line pitch; Find shifts; "Verify a letter" link | Find shifts | Sign in | 1 |
| Explore `/explore` | Find a shift worth doing | Promotion/upcoming banner; Recommended (SpotlightCard, one-line why); search + filters; organizations | Open the top recommended shift | Clear filters, save, map (Tier 2) | 0 (list), 1 (recommended, filters) |
| Opportunity `/opportunity/:instanceId` | Decide and sign up | Date, time with zone, place, seats left; signup button ([#signup-matrix](#signup-matrix)); description; organization with Unverified chip if needed | Signup button | Other dates, Add to calendar, save | 0 |
| Organization `/organizations/:orgId` | Trust the org | Name + verification chip; mission; upcoming shifts | Open next shift | Reviews (Tier 2), save | 1 |
| My Shifts `/me/shifts` | Get to the next shift and check in | Next shift with Check in / Check out entry and "Check-in opens H:MM"; reminders; upcoming list; past list | Check in (when open) | Cancel, calendar, Request review on a no-show | 0 |
| Check-in `/checkin` | Enter the kiosk code | Shift name; 6-digit code field; Scan QR (secure context); result | Submit code | Switch to scan or typed | 0 (typed), 1 (QR) |
| Impact `/impact` | See progress, get proof | Total approved hours + next milestone progress; letters list; track record | Get verified letter | Download report, badge card | 0 (total, letters), 1 (milestones, track record) |
| Letter builder `/impact/letters/new` | Issue a letter | Scope (org or all, date range); preview with per-org hours and "Hours excluded: N from unverified orgs"; Issue | Issue letter | Download PDF, copy verify link | 0 (scope all, all-time), 1 (scopes) |
| Notifications `/me/notifications` | Catch up | List grouped by day | Mark all read | Open item | 1 |
| Profile `/me/profile` | Keep details current | Name; interests; skills; availability; accessibility settings | Save | Discoverable toggle | 1 |
| Saved `/me/saved` | Return to saved items | Saved shifts; saved orgs | Open item | Remove | 1 |
| Help `/help` | Answer a question | Search box; matching articles; assistant panel | Search | Ask (signed in) | 0 (BM25), 1 (assistant) |
| Onboarding `/onboarding` | Get a usable profile fast | Birth date step first; progress indicator | Continue | Skip optional steps | 1 |
| Login `/login` | Sign in | Email + password; DEMO_MODE "Sign in as..." switcher | Sign in | Create account | 0 |
| Verify `/verify/:code` | Prove a letter is real | Status band; name, hours, range, orgs; issue date + code; What this means | (read only) | Verify another code | 0 |
| Coordinator Dashboard `/org/:orgId/dashboard` | Run today | Today/next shift with Start kiosk; Needs attention; upcoming shifts; analytics (attendance rate, hours this month) | Start kiosk | Create shift, Run due jobs (DEMO_MODE) | 0 (today, upcoming), 1 (Needs attention, analytics) |
| Shift roster `/org/:orgId/shifts/:instanceId` | Watch arrivals, fix attendance | Shift header with counts; live roster (name, status, check-in/out times, contact or hidden note, track record) | Start kiosk | Attendance actions, cancel shift, edit | 0 |
| Shifts `/org/:orgId/shifts`, `/new` | Plan shifts | Planner text box; structured form; ranked volunteers panel (Tier 2) | Create shift | Edit, cancel | 1 |
| Kiosk `/org/:orgId/kiosk/:instanceId` | Show the code, welcome arrivals | Shift title; 6-digit code + countdown ring; QR; checked-in count; arrivals list | (none; display) | Exit kiosk | 0 |
| Reports `/org/:orgId/reports`, `/impact/report` | Build a report | Report type; date range; sections; theme; Generate | Generate PDF | Export CSV | 1 |
| Org settings `/org/:orgId/settings` | Maintain the org | Profile fields; verification status; members; invites; archive/delete | Save | Create invite, remove member | 1 |
| Org register `/org/register` | Register a nonprofit | Form (name, mission, causes, EIN, address, contact, time zone) | Register | | 1 |
| Admin `/admin` | Keep the system honest | Orgs awaiting verification; last runDueJobs run time and recent jobRuns; demo controls (DEMO_MODE: Advance clock 15 min, Reset clock, Reset rate limits, Reset demo data) | Run due jobs now | Verify org | 0 (jobs, clock), 1 (rest) |

<a id="screen-kiosk-states"></a>
### 9.3 Kiosk and phone check-in states (D4)

Kiosk:

| State | Shows | Announce (aria-live) |
|---|---|---|
| Loading code | Spinner where the code goes, shift title | "Loading code" |
| Live | Code, 30 s countdown ring, QR (secure context), count, arrivals | "New code" on change (polite) |
| Code changed | New code fades in; ring restarts | "New code" |
| Offline | Code dimmed + "Reconnecting, codes paused"; never shows an expired code as live | "Connection lost, codes paused" |
| Denied / session expired | "Kiosk session expired, coordinator sign-in" + sign-in form | assertive |
| Shift not open | "Check-in opens at H:MM" (30 min before start) | |
| Shift ended | "This shift has ended. Exit kiosk to return." | |
| Cancelled | "This shift was cancelled." | |
| Empty roster | "No arrivals yet" | |
| Arrival | Row animates in (AnimatedList; static under reduced motion) | "{name} checked in" |
| Row styles | checked-in (success token + check icon), checked-out (neutral + done icon), no-show (danger + x icon, after finalize), walk-up (tag "Walk-up") | |

Phone check-in:

| State | Shows |
|---|---|
| Not open | Disabled Check in with "Check-in opens H:MM" |
| Typed entry | 6 numeric inputs (one field, `inputmode=numeric`, autocomplete one-time-code), Submit |
| Scanner (Tier 1) | Camera view; camera denied: "Camera blocked. Type the code instead." and focus moves to the code field; QR unreadable after 10 s: same fallback |
| Pending | Button shows pending until the Function returns (no optimistic UI) |
| Success | "Checked in at 9:02, check-out opens 9:17" |
| Errors | The catalog message for CHECKIN_NOT_OPEN, KIOSK_CODE_INVALID, NOT_SIGNED_UP, RATE_LIMITED (with countdown), SHIFT_CANCELLED |
| Check-out disabled | "Check-out opens 9:17" |
| Check-out closed | CHECKOUT_CLOSED message |
| Checked out | Demo arc screen |

<a id="signup-matrix"></a>
### 9.4 Signup button matrix (D5)

| Condition (evaluated in order) | Label | Enabled | Extra |
|---|---|---|---|
| Instance cancelled | Cancelled by organization | no | Download cancellation (if signed up) |
| Own signup confirmed or checked-in | Signed up | n/a | Cancel; Add to calendar; "Check-in opens H:MM" |
| Own signup waitlisted | Waitlisted #N of M | n/a | Leave waitlist |
| Own signup cancelled | Cancelled | no | Download cancellation |
| `now >= start` | Shift started | no | |
| Under minAge | Ages N+ | no | reason text "You must be at least N to join this shift." |
| Minor and org unverified | Not available yet | no | "Volunteers under 18 can join after this organization is verified." |
| Seat free | Sign up | yes | Walk-up note after cutoff |
| No seat, before cutoff, waitlist has room | Join waitlist (#N) | yes | N = position you would get |
| Otherwise | Full | no | |
| Signed out | Sign up (opens sign-in, then returns) | yes | |

No optimistic UI for trusted writes: the button shows pending until the Function returns, then re-renders from the snapshot. Whole-series result (Tier 2) is a date list with confirmed / waitlisted / skipped chips and "Series signup covers through DATE" with a one-click Extend.

<a id="screen-empty"></a>
### 9.5 Empty states (D6)

| Where | Line | Action |
|---|---|---|
| Impact at 0 hours | "0 of 25 hours to your first milestone" (progress bar, not zeros) | Find shifts |
| My Shifts, none | "No shifts yet." | Find shifts |
| Organization with no opportunities | "No upcoming shifts right now." | Save organization |
| Dashboard after registration | "Your organization is ready." | Create your first shift |
| Needs attention, none | "Nothing needs your review." | none (view upcoming) |
| Notifications, none | "No alerts yet. Alerts appear here, in the app only." | none |
| Explore filtered to nothing | "No shifts match these filters." | Clear filters |
| Recommendations without interests | "Add interests to see shifts picked for you." | Add interests |
| Help search, no results | "No articles match." | Ask (signed in) or Sign in to ask |
| Map unavailable (no token) | "Map unavailable; showing the list." | none |
| Letters, none | "No approved hours yet. Hours appear after you check out of a shift." | Find shifts |
| Kiosk roster | "No arrivals yet" | none |

<a id="screen-assistant"></a>
### 9.6 Assistant panel (D7)

One panel on Help (and openable from any page). Each answer carries a label: "From Help Center" or "AI answer, may be wrong". Character counter appears near 2,000. Over the limit: "You've reached today's assistant limit; here are matching help articles." Signed out: article results plus "Sign in to ask". Answers are plain text with article links.

<a id="screen-letter-flow"></a>
### 9.7 Letter flow (D8)

Preview (client-side from readable logs and org verified flags) then Issue. The preview shows per-org hours and, inline, "Hours excluded: N from unverified orgs". States: generating (progress), failed ("We couldn't create the PDF." + Retry, same nonce), ready (Download PDF, Copy verify link, the code). PDF layout in [#letters](#letters).

<a id="screen-needs-attention"></a>
### 9.8 Needs attention queue (D9)

One list on the coordinator Dashboard grouped by shift, containing: `needsReview` logs, pending manual logs, and open attendance disputes. Inline Approve / Reject; Reject opens a required reason field; disputes open setAttendance with a required note. Bulk "Approve all" applies to kiosk-verified (needsReview) rows of one shift.

<a id="screen-onboarding"></a>
### 9.9 Onboarding (D10)

1. Birth date (first, before account creation). Under 13: "You must be 13 or older to use this app" plus "Ask a parent or guardian about volunteering together." No account is created.
2. Create account (email + password, Turnstile widget).
3. Name (first, last), phone optional.
4. Interests (cause areas).
5. Skills (skippable).
6. Availability (skippable).
7. ZIP (skippable).
8. Finish: completeProfile, then "3 shifts that match you".

A progress indicator shows the step count. The client validates the date first; completeProfile enforces it.

<a id="screen-demo-arc"></a>
### 9.10 Demo arc (D11)

After checkOut the phone shows "N hours logged at ORG", animated progress to the next milestone (static under reduced motion), and the primary CTA "Get verified letter". The "Run due jobs" control appears only when DEMO_MODE is on and is labeled "Demo control". DEMO.md scripts the arc screen by screen: Explore, Opportunity sign up, kiosk Start, phone check-in, clock advance, check-out, demo arc, issue letter, `/verify`.

<a id="screen-promotion"></a>
### 9.11 Promotion visibility (D13)

Promoted and upcoming signups appear as a banner on Explore ("You're in! Saturday 9 AM" with Confirm and Can't make it). Confirm marks the notification read; Can't make it calls `cancelSignup {release: true}`. The header badge opens the notification list directly.

<a id="screen-status-tokens"></a>
### 9.12 Status tokens (D14, TD1)

| Token | Statuses | Icon |
|---|---|---|
| `--status-success` | verified org, valid letter, completed, approved | check |
| `--status-warning` | waitlisted, needsReview, pending | clock |
| `--status-danger` | revoked, no-show, rejected | x |
| `--status-neutral` | cancelled, excused, superseded, unverified | dash / info |

Every status renders icon + text label; color is never the only signal. Status components use only these tokens (checked by `check:tokens`).

<a id="screen-reactbits"></a>
### 9.13 React Bits placement (D15)

| Component | Only used for |
|---|---|
| AnimatedList | live roster arrivals (kiosk, roster); notifications bell (Tier 2) |
| CountUp | Impact total on first view after a change, and the milestone moment; not on every revisit |
| SpotlightCard | recommended shift cards on Explore |
| FadeContent / AnimatedContent | route transitions |

Others need a stated purpose in a code comment. Each vendored file in `src/components/bits/` has a header with source URL, date, and license, and uses token-mapped classes only (no hex; checked in CI).

<a id="screen-planner"></a>
### 9.14 Shift planner UI (D17)

A text box with the example placeholder "need 12 people Sat 9-1 sorting at the food bank". Parse fills the structured form inline; parsed fields are highlighted and editable. Tier 2 adds AI parse and a side panel of ranked volunteers with "why" chips, display names only, and Invite.

### 9.15 Breakpoints (D19)

| Surface | Contract |
|---|---|
| Volunteer screens | mobile-first, designed at 375 px |
| Coordinator screens | desktop-first; tables become stacked rows under 768 px |
| Kiosk | landscape at 1024 px+; code at least 120 px tall |
| Screenshot tests | 375, 768, 1440 |

<a id="a11y"></a>
### 9.16 Accessibility contract (D18, D20, D21, E3)

- Touch targets at least 44 x 44 px.
- Visible focus states from tokens; focus restored after modals, signup submit, scanner failure, and route changes (focus the page `h1`).
- aria-live: kiosk code changes, waitlist promotion, form errors, roster arrivals, toasts.
- Status never by color alone; plain, age-appropriate copy.
- Text size 100 / 125 / 150% via a root font-size token; contrast `normal` / `high` via `[data-contrast=high]` token set; reduced motion via `prefers-reduced-motion` or the in-app toggle (motion tokens become 0 ms; static milestone variant). Preferences are stored in localStorage and copied to `users/{uid}/private/profile` when signed in.
- Full keyboard path through sign up, check-in code entry, and the kiosk.
- axe reports zero serious or critical issues on Explore, Opportunity, Dashboard, Kiosk, and Verify. Tier 0 screens are tested at 150% text + high contrast without overflow.

<a id="screen-errors"></a>
### 9.17 Error presentation (D22)

`toUserError(err)` (shared) returns `{title, message, fix, helpSlug, requestId}` from the catalog. UI shows friendly copy and a collapsed "Details" with a copyable requestId; Details is expanded by default for coordinators and admins. Unknown errors show "Something went wrong (ref: ID)". Network failures show a retry toast; nothing is silently dropped.

### 9.18 Unverified organization UI (D23)

An "Unverified" chip with tooltip "Hours here won't appear on verified letters until this organization is verified" on org and opportunity pages, visible before signup. Roster rows for minors in unverified orgs show "Contact hidden until your organization is verified".

### 9.19 Time display (D24)

All shift times render in the org zone with a zone label (`shared/format.ts`). The signup confirmation and the phone check-in screen show "Check-in opens H:MM".

---

<a id="dx"></a>
## 10. Developer experience

### 10.1 Prerequisites and quickstart (X1, X2)

- Node 22 (`.nvmrc`, `package.json` `engines`), matching the Functions runtime. JDK 21+ for the emulators. `firebase-tools` is a devDependency used through npx (no global install).
- README starts with the quickstart, exactly:
  1. Prerequisites: Node 22, JDK 21+.
  2. `npm ci`
  3. `copy .env.example .env.local` (macOS/Linux: `cp`)
  4. `npm run demo`
- Recommendation (TE3): keep the repo outside a synced OneDrive folder; doctor warns when it is inside one.

### 10.2 Emulator config

Hand-written `firebase.json` (no `.firebaserc`): emulator ports auth 9099, firestore 8080, functions 5001, storage 9199, ui 4000; Vite on 5173; rules files `firestore.rules`, `storage.rules`; indexes `firestore.indexes.json`; functions source = the generated deploy directory; Hosting public dir `dist` with an SPA rewrite to `/index.html` and security headers (CSP allowing self, Firebase, Turnstile, Mapbox, Google Fonts; HSTS; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy: camera=(self), microphone=(), geolocation=(self)`). Every script passes `--project demo-fbla2027` unless deploying.

<a id="scripts"></a>
### 10.3 Scripts (X7)

All scripts are cross-platform (Node scripts, cross-env, rimraf; no `rm -rf`, no inline `VAR=x`). CI runs `npm run verify` on windows-latest and ubuntu-latest.

| Script | Does |
|---|---|
| `dev` | Vite dev server (expects emulators running) |
| `demo` | One-command demo ([#demo](#demo)) |
| `demo:reset` | Clears emulator data and reseeds (also when seed `schemaVersion` changed) |
| `emulators` | `firebase emulators:start --project demo-fbla2027` |
| `seed:demo` | Seeds running emulators; `--shift-starts-in <min>` (default 10) |
| `doctor` | Environment checks ([#doctor](#doctor)) |
| `typecheck` | `tsc -b` across root, `shared`, `functions` |
| `lint` | ESLint incl. the no-serverTimestamp / clock rule in `functions/src` |
| `test` | Vitest for `src` and `shared` (shared coverage threshold 100% lines and branches) |
| `test:rules` | Rules tests under `emulators:exec` (firestore, storage) |
| `test:functions` | Function op and trigger tests under `emulators:exec` |
| `test:e2e` | Playwright under `emulators:exec` with the App Check debug provider |
| `check:tokens` | Fails on hex/rgb colors outside `tokens.css`, in `src/components/bits`, and in status components not using status tokens |
| `check:functions-index` | Export list, op lists (shared, endpoints, `src/lib/api.ts`), every op via defineCallable, one test per op |
| `check:spec` | No chain-of-replacement wording (the plan's "s"-suffixed form of "supersede") in this file; no older Tailwind major referenced in repo configs or docs; every `SPEC#anchor` cited in code or tests exists here |
| `build` | `vite build` and the functions bundle + deploy directory |
| `verify` | typecheck, lint, check:*, test, build, test:rules, test:functions, test:e2e |
| `deploy` | `scripts/deploy.mjs --project <id>`: rules + indexes, then functions, then hosting; refuses without an explicit project |

Admin claim: `node scripts/set-admin-claim.mjs --project <id> --email <email>` (service account from env path, never committed).

<a id="demo"></a>
### 10.4 npm run demo

1. Runs doctor checks that block (Node, Java, ports).
2. Creates `functions/.secret.local` if missing (random `KIOSK_MASTER_SECRET`, Cloudflare test `TURNSTILE_SECRET`).
3. `firebase emulators:exec --project demo-fbla2027` running, via concurrently: the seed (`--shift-starts-in 10`) and Vite on `localhost:5173`.
4. Prints: coordinator dashboard link, kiosk link for the seeded instance, volunteer Explore link, the demo credentials table, and the emulator UI link.

It does not print LAN URLs or QR codes; phones are used only against the deployed site. The only demo target is the deployed Firebase Hosting site; emulators are for development and tests.

<a id="doctor"></a>
### 10.5 Doctor (X3)

| Check | Failure output (problem / cause / fix) |
|---|---|
| Node version 22 | "Node X found / wrong version / install Node 22 or run nvm use" |
| Java present (21+) | "Java not found / emulators need a JDK / install JDK 21" |
| Ports 9099, 8080, 5001, 9199, 4000, 5173 free | "Port 8080 busy / another emulator or app / stop it or run demo:reset" |
| `.env.local` present and valid (same zod schema as the app) | names the missing variable and points to `.env.example` |
| Workspace deps installed | "Run npm ci" |
| Repo inside synced OneDrive | warning only |

Each check has a unit test.

<a id="env"></a>
### 10.6 Environment (X4)

`.env.example` works with zero edits for local runs. `src/lib/firebase.ts` validates env with zod and fails naming the missing variable and pointing to `.env.example`.

| Client variable | Local default | Deployed |
|---|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_STORAGE_BUCKET` | dummy values | real web config |
| `VITE_FIREBASE_PROJECT_ID` | `demo-fbla2027` | new project id |
| `VITE_USE_EMULATORS` | `true` | `false` |
| `VITE_TURNSTILE_SITE_KEY` | `1x00000000000000000000AA` (Cloudflare test key, always passes) | real site key |
| `VITE_APPCHECK_SITE_KEY` | blank (debug provider) | reCAPTCHA Enterprise key |
| `VITE_MAPBOX_TOKEN` | blank (map hidden) | optional public `pk.` token, URL-restricted |
| `VITE_DEMO_MODE` | `true` | `true` on the competition project |

| Functions variable | Kind | Local | Deployed |
|---|---|---|---|
| `DEMO_MODE`, `ALLOW_DEMO_CLOCK` | env | `true` | `true` (competition project) |
| `AI_ENABLED` | env | `false` | `true` |
| `AI_MODEL` | env | blank | model id |
| `APPCHECK_ENFORCE` | env | `false` | `true` |
| `TURNSTILE_ENABLED` | env | `false` (logged at startup) | `true` |
| `APP_BASE_URL` | env | `http://localhost:5173` | hosting URL |
| `KIOSK_MIN_INSTANCES` | env | `0` | `1` on competition day only |
| limit overrides ([#config](#config)) | env | unset | unset |
| `ANTHROPIC_API_KEY` | secret | blank (fallback) | `functions:secrets:set` |
| `TURNSTILE_SECRET` | secret | Cloudflare test secret `1x0000000000000000000000000000000AA` | real secret |
| `KIOSK_MASTER_SECRET` | secret | generated into `.secret.local` | Secret Manager |
| `DEMO_ACCOUNT_PASSWORD` | secret | unused (seed uses the fixed local password) | Secret Manager |

`.env.local`, `functions/.secret.local`, service-account files, and `functions/deploy/` are gitignored.

<a id="demo-accounts"></a>
### 10.7 Demo accounts and seed (X5, E1)

| Role | Email | Name | Notes |
|---|---|---|---|
| Admin | `admin@demo.fbla2027.test` | Ada Admin | admin claim set by the seed |
| Owner / coordinator | `coordinator@demo.fbla2027.test` | Olivia Ortiz | owner of Alamo Community Pantry (verified) |
| Adult volunteer | `volunteer@demo.fbla2027.test` | Jordan Rivera (19) | history: 22.5 approved hours, so the demo check-out crosses the 25-hour milestone; reliability from 8 past shifts |
| Minor volunteer | `minor@demo.fbla2027.test` | Sam Lee (15) | shows minor rules (hidden contact at the unverified org, blocked unverified signup) |

Local password is a fixed value printed by the seed; deployed accounts use `DEMO_ACCOUNT_PASSWORD`. Seed data: three San Antonio nonprofits (two verified, one unverified), opportunities across cause areas, one instance starting in `--shift-starts-in` minutes with capacity 3 and one seat left, a full instance with a waitlist, past finalized instances with logs and one valid letter. All seeded accounts have `emailVerified` and complete profiles. The DEMO_MODE login screen shows "Sign in as..." with the four roles. `admin.resetDemoData` (admin + DEMO_MODE) runs the same seed module server-side for the deployed site.

### 10.8 Workspaces and Functions build (X6, G3)

- npm workspaces: root (app), `functions`, `shared`. `npm ci` at the root installs all.
- `functions` build: esbuild bundles `functions/src` and `shared/` into `functions/deploy/lib/index.js`; writes `functions/deploy/package.json` with runtime deps only (no workspace or `shared` entry) and its lockfile. Deploy never imports `../shared`.
- CI: `npm ci` in a clean copy of `functions/deploy`, then an `emulators:exec` smoke test (health + one callable) against the bundle.
- One real `firebase deploy --only functions` rehearsal as soon as the Blaze project exists; logged in DEMO.md.

<a id="definecallable"></a>
### 10.9 defineCallable and "Add a new op" (X8, G2)

```ts
// functions/src/ops/checkIn.ts  (SPEC#fn-checkin)
export const checkIn = defineCallable({
  endpoint: 'kiosk',
  op: 'checkIn',
  input: checkInInput,                         // shared/schemas/ops/kiosk.ts
  auth: signedIn(),                            // or coordinatorOfInstance('instanceId'), admin(), ...
  rateLimit: { bucket: 'checkin', max: config.checkinRateMax, windowSec: config.checkinRateWindowSec },
  handler: async ({ input, caller, clock, db, log }) => { /* ... */ },
});
```

defineCallable centralizes: App Check, auth kind, kiosk-token scoping, profile gate, resource resolution, zod validation, rate limits, the error catalog mapping, requestId, and the structured log.

Recipe (also in docs/ARCHITECTURE.md and CONTRIBUTING.md): (1) add input/output schema in `shared/schemas/ops/`; (2) add the op to `shared/ops.ts`; (3) write `functions/src/ops/<op>.ts` with defineCallable; (4) register it in the endpoint dispatch table; (5) add it to `src/lib/api.ts`; (6) add or update the rules row if it touches a new collection; (7) write the op test incl. cross-org and kiosk-token denial; (8) add a row to [#api](#api).

<a id="errors"></a>
### 10.10 Error catalog (X9)

`shared/errors.ts` entries are `{code, httpsCode, message(params), fix, helpSlug}`. Functions throw by code; `toUserError` maps code to copy + help link. Unit test: every entry has a message, a fix, and a helpSlug or explicit null.

| Code | httpsCode | Message | Fix | helpSlug |
|---|---|---|---|---|
| AUTH_REQUIRED | unauthenticated | Please sign in to continue. | Sign in. | null |
| PROFILE_INCOMPLETE | failed-precondition | Finish setting up your profile first. | Complete onboarding. | getting-started |
| PERMISSION_DENIED | permission-denied | You don't have access to that. | Ask the organization owner. | null |
| NOT_FOUND | not-found | We couldn't find that. | Check the link. | null |
| INVALID_INPUT | invalid-argument | Some fields need attention. ({fields}) | Fix the highlighted fields. | null |
| CONTENTION | aborted | Busy right now. Try again. | Try again. | null |
| INTERNAL | internal | Something went wrong (ref: {requestId}). | Try again; share the ref with your coordinator. | null |
| AGE_UNDER_13 | failed-precondition | You must be 13 or older to use this app | Ask a parent or guardian. | privacy-and-minors |
| AGE_BELOW_MIN | failed-precondition | You must be at least {minAge} to join this shift. | Pick another shift. | find-and-sign-up |
| MINOR_UNVERIFIED_ORG | failed-precondition | Volunteers under 18 can join this organization's shifts after it is verified. | Pick a verified organization. | privacy-and-minors |
| ADULT_REQUIRED | failed-precondition | You must be 18 or older to register an organization. | Ask an adult leader to register. | org-verification |
| EMAIL_NOT_VERIFIED | failed-precondition | Verify your email first. | Use the link we emailed you. | org-verification |
| EIN_INVALID | invalid-argument | Enter the EIN as NN-NNNNNNN. | Check the EIN format. | org-verification |
| BIRTHDATE_LOCKED | failed-precondition | Your birth date can't be changed here. | Contact an admin. | privacy-and-minors |
| TURNSTILE_FAILED | permission-denied | We couldn't confirm you're human. | Refresh and try again. | getting-started |
| SHIFT_FULL | resource-exhausted | This shift and its waitlist are full. | Pick another date. | waitlist-and-promotion |
| WAITLIST_CLOSED | failed-precondition | This shift is full and its waitlist has closed. | Pick another date. | waitlist-and-promotion |
| SHIFT_STARTED | failed-precondition | This shift has already started. | Contact the coordinator. | find-and-sign-up |
| SHIFT_ENDED | failed-precondition | This shift has already ended. | Use attendance tools instead. | coordinator-attendance |
| SHIFT_CANCELLED | failed-precondition | This shift was cancelled by the organization. | Pick another shift. | find-and-sign-up |
| SHIFT_NOT_ENDED | failed-precondition | This shift hasn't ended yet. | Wait until it ends. | coordinator-attendance |
| SIGNUP_CANCELLED_BEFORE | failed-precondition | You cancelled this shift earlier. | Pick another date. | find-and-sign-up |
| INVALID_TRANSITION | failed-precondition | That change isn't allowed for this signup right now. | Refresh to see the current status. | coordinator-attendance |
| RELEASE_NOT_ALLOWED | failed-precondition | This spot can no longer be released without counting as a late cancel. | Use Cancel instead. | waitlist-and-promotion |
| CHECKIN_NOT_OPEN | failed-precondition | Check-in for this shift is not open right now. (opens {opensAt}) | Come back when check-in opens. | kiosk-check-in |
| CHECKOUT_NOT_OPEN | failed-precondition | Check-out opens at {opensAt}. | Wait, then try again. | check-out-and-hours |
| CHECKOUT_CLOSED | failed-precondition | Check-out for this shift has closed. Your coordinator will confirm your hours. | Nothing; hours go to review. | check-out-and-hours |
| NOT_SIGNED_UP | failed-precondition | You don't have a confirmed spot on this shift. | Sign up first if seats remain. | kiosk-check-in |
| NOT_CHECKED_IN | failed-precondition | Check in before checking out. | Check in first. | check-out-and-hours |
| KIOSK_CODE_INVALID | invalid-argument | That code is wrong or expired. Enter the code shown on the kiosk now. | Re-enter the current code. | kiosk-check-in |
| KIOSK_NOT_OPEN | failed-precondition | The kiosk isn't available for this shift right now. | Start within an hour of the shift. | coordinator-start-kiosk |
| KIOSK_SESSION_EXPIRED | unauthenticated | Kiosk session expired, coordinator sign-in | Coordinator signs in again. | coordinator-start-kiosk |
| RATE_LIMITED | resource-exhausted | Too many attempts, wait a minute. (retry in {retryAfterSec} s) | Wait. | kiosk-check-in |
| CAPACITY_BELOW_SIGNUPS | failed-precondition | Remove volunteers first. ({excess} over the new capacity) | Lower signups or keep capacity. | coordinator-attendance |
| INSTANCE_TIME_INVALID | invalid-argument | Check the shift times (end after start, 12 hours max, in the future). | Fix the times. | null |
| SERIES_RULE_INVALID | invalid-argument | Check the repeat rule. | Pick weekdays and times. | null |
| ORG_HAS_ACTIVITY | failed-precondition | This organization has volunteer history, so it can be archived but not deleted. | Archive instead. | org-verification |
| ORG_HAS_UPCOMING_SHIFTS | failed-precondition | Cancel upcoming shifts with volunteers first. | Cancel those shifts. | org-verification |
| INVITE_INVALID | not-found | This invite code is invalid or expired. | Ask the owner for a new code. | null |
| ALREADY_MEMBER | already-exists | You're already a member of this organization. | Open the organization. | null |
| CANNOT_REMOVE_OWNER | failed-precondition | The owner can't be removed. | none | null |
| MINUTES_REQUIRED | invalid-argument | Enter the minutes served. | Enter minutes in 15-minute steps. | coordinator-attendance |
| DATE_OUT_OF_RANGE | invalid-argument | Pick a date in the last 12 months, not in the future. | Fix the date. | manual-hours |
| DISPUTE_WINDOW_CLOSED | failed-precondition | Reviews can be requested within 30 days of the shift. | Contact the organization. | track-record |
| NO_APPROVED_HOURS | failed-precondition | You have no approved hours from verified organizations in this range. | Change the range. | verified-letters |
| INPUT_TOO_LONG | invalid-argument | Keep it under 2,000 characters. | Shorten it. | ai-assistant |
| REF_EXPIRED | failed-precondition | This list is out of date. | Rank again. | null |
| DEMO_MODE_REQUIRED | failed-precondition | Demo controls are off in this environment. | none | null |

AI over-limit and AI-unavailable are not errors: askAssistant returns the help-article fallback with `limited` or `source help`.

<a id="config"></a>
### 10.11 Config (X13)

`shared/config.ts` holds every limit with a Functions env override:

| Key | Default | Env override |
|---|---|---|
| aiPerHour / aiPerDay | 20 / 100 | `AI_PER_HOUR`, `AI_PER_DAY` |
| aiGlobalDailyCap | 500 | `AI_GLOBAL_DAILY_CAP` |
| aiMaxInputChars / aiMaxOutputTokens | 2,000 / 1,024 | `AI_MAX_INPUT_CHARS`, `AI_MAX_OUTPUT_TOKENS` |
| checkinRateMax / checkinRateWindowSec | 10 / 600 | `CHECKIN_RATE_MAX`, `CHECKIN_RATE_WINDOW_SEC` |
| kioskRotationSec | 30 | `KIOSK_ROTATION_SEC` |
| seriesWindowWeeks | 8 | `SERIES_WINDOW_WEEKS` |
| waitlistCutoffMin, lateCancelHours, latePromotionHours, releaseWindowHours | 120, 24, 24, 24 | same names, upper snake case |
| checkinOpenBeforeMin, checkoutMinAfterCheckinMin, checkoutGraceMin | 30, 15, 30 | same |
| jobPageSize, jobLeaseSec | 200, 240 | `JOB_PAGE_SIZE`, `JOB_LEASE_SEC` |

DEMO_MODE admin control "Reset rate limits" clears `rateLimits` and per-user `aiUsage`. A unit test reads overrides.

### 10.12 App Check and Turnstile flags (X11)

- Client: App Check with reCAPTCHA Enterprise when `VITE_APPCHECK_SITE_KEY` is set; debug provider in dev and Playwright via `FIREBASE_APPCHECK_DEBUG_TOKEN`.
- Functions: `enforceAppCheck` on all callables when `APPCHECK_ENFORCE=true` (deployed); false on emulators.
- DEMO.md step: register debug tokens only for development browsers; the three demo devices use the real provider on the deployed site.
- `TURNSTILE_ENABLED`: true deployed, false on emulators (startup log line). Cloudflare test keys in `.env.example`.

### 10.13 Developer failure UX (X10)

- In dev, `firebase.ts` probes the emulators and shows a banner: "Emulators not reachable on :8080, run npm run demo".
- Functions log one clear line when `AI_ENABLED` is true but the key is missing, then fall back.
- DEMO.md troubleshooting table (symptom, cause, diagnostic command, fix, when to run `demo:reset`): ports in use, Java missing, missing admin claim (refresh token), rules denial, missing index, scheduled jobs not running (use Run due jobs now; check jobRuns), wrong env keys, App Check rejection, AI fallback showing.

### 10.14 Docs to ship (X16, X17, X20)

| Doc | Contents | When |
|---|---|---|
| README.md | Quickstart first; features mapped to rubric rows; language and stack rationale; libraries + licenses; React Bits attribution (MIT + Commons Clause); cited stats (VolunteerHub "Volunteer No-Shows", about 1 in 4 no-show/cancel; Zeffy volunteer retention guide, about 30% do not return; the FBLA guideline "no more than three personal devices"); competitor table vs SignUpGenius, VolunteerHub, Galaxy Digital, paper logs | Phase 1, updated per tier |
| docs/ARCHITECTURE.md | Folder map; one trusted write end to end (signup); tokens and theming; how to add an op, a screen, a rules row | Phase 1 |
| docs/DEMO.md | Demo arc script; explainers table (each Tier 0/1 op plus the kiosk HMAC, waitlist transaction, and letter verification assigned to a named team member); "First deploy" (project creation, `firebase use --add`, `functions:secrets:set ANTHROPIC_API_KEY` and other secrets, admin-claim script, App Check registration, deploy order, rollback via `hosting:rollback` and redeploying the previous Functions commit, Cloud Monitoring alert setup); "Competition day" (kiosk minInstances, health pre-flight, reset demo data, post-deploy smoke: health, seed, run due jobs, full loop on 3 devices); troubleshooting table; 20-second "why not SignUpGenius" answer; kiosk relay limitation; .ics best-effort note; rehearsal log (date, devices, issues) incl. the functions deploy rehearsal; named rehearsal owner | Phase 1 skeleton, complete before Round 1 |
| docs/RUBRIC_MAP.md | Each rubric row to the screen and file that earns it; competitor table | Tier 1 |
| docs/PORT_LEDGER.md | Every old `src/` and `functions/src` file: port, rewrite, or drop, with reason (feed, follows, public profiles marked dropped) | Lane B, before Tier 0 code |
| CONTRIBUTING.md | Branching, `npm run verify` before push, add-an-op recipe | Phase 1 |
| LICENSE | MIT | Phase 1 |
| `.env.example` | Commented defaults | Phase 1 |
| `src/content/help/*.md` | Help articles ([#subsystems](#subsystems)) | Tier 0 (core), Tier 1 (rest) |
| TODOS.md | Backlog | maintained |

### 10.15 Upgrade policy (X18)

Lockfile committed; Dependabot weekly for npm and GitHub Actions; React Bits files record source URL and date in a header; Tailwind 4 is the only Tailwind version (`check:spec` enforces it); seed data carries `schemaVersion` and `demo:reset` rebuilds on change.

<a id="ci"></a>
### 10.16 CI (G24, X19, X6)

| Job | Runners | Fails build |
|---|---|---|
| verify (typecheck, lint, checks, unit, build, rules, functions, e2e) | ubuntu-latest, windows-latest | yes |
| Tier 0 e2e gate | ubuntu-latest | yes; Tier 1+ PRs cannot merge without it |
| functions deploy-dir `npm ci` + emulator smoke test | ubuntu-latest | yes |
| gitleaks | ubuntu-latest | yes |
| clone-to-ready timer (`npm ci` + `npm run demo` until the app responds) | ubuntu-latest | no; reports duration against the 5-minute target until rehearsals set a baseline |

### 10.17 Deploy and observability

- Deploy order: Firestore rules + indexes, Storage rules, Functions, Hosting. No migrations (new project).
- Feature flags via Functions env: `AI_ENABLED`, `DEMO_MODE`, `APPCHECK_ENFORCE`, `TURNSTILE_ENABLED`.
- Structured logs per op; `jobRuns` history on the admin page; client error toasts show requestId.
- Cloud Monitoring log-based alert on `runDueJobs` `outcome: error` or no run in 15 minutes (G23). The admin page and `health` show the last job run time.
- Blaze budget alert at $5; billing owner is a team adult.

---

<a id="queries"></a>
## 11. Query catalogue and indexes (G9)

`firestore.indexes.json` is generated from this table. Tests run on the emulator with index enforcement; any missing-index error fails the test. "auto" means a single-field index Firestore creates by default.

| # | Caller | Query | Index |
|---|---|---|---|
| Q1 | Explore shifts | `instances` where status == scheduled, start >= now, orderBy start, limit 50 | instances (status, start) |
| Q2 | Opportunity "other dates" | `instances` where opportunityId == X, start >= now, orderBy start | instances (opportunityId, start) |
| Q3 | Coordinator dashboard, shifts list | `instances` where orgId == X, start >= from, orderBy start | instances (orgId, start) |
| Q4 | runDueJobs | `instances` where nextActionAt <= now, orderBy nextActionAt, limit 200 | auto (nextActionAt) |
| Q5 | runDueJobs (Tier 2) | `series` where nextExtendAt <= now, limit 50 | auto (nextExtendAt) |
| Q6 | Kiosk, roster | `signups` where instanceId == X, status in [...] | signups (instanceId, status) |
| Q7 | cancelInstance, finalizeShift | `signups` where instanceId == X | auto |
| Q8 | My Shifts upcoming | `signups` where uid == me, instanceStart >= now, orderBy instanceStart | signups (uid, instanceStart) |
| Q9 | My Shifts past | `signups` where uid == me, instanceStart < now, orderBy instanceStart desc | signups (uid, instanceStart desc) |
| Q10 | recomputeVolunteerStats (reliability window, open snapshots) | `signups` where uid == X, status in [...], orderBy instanceStart desc | signups (uid, status, instanceStart desc) |
| Q11 | Needs attention disputes | `signups` where orgId == X, disputeOpen == true | signups (orgId, disputeOpen) |
| Q12 | rankVolunteers past volunteers (Tier 2) | `signups` where orgId == X, status == completed | signups (orgId, status) |
| Q13 | Roster contacts | `signupContacts` where instanceId == X | auto |
| Q14 | Snapshot refresh | `signupContacts` where uid == X, frozen == false | signupContacts (uid, frozen) |
| Q15 | Impact, letters, stats | `hoursLogs` where uid == me, status == approved, orderBy date | hoursLogs (uid, status, date) |
| Q16 | Needs attention, org report | `hoursLogs` where orgId == X, status == pending or approved, orderBy date | hoursLogs (orgId, status, date) |
| Q17 | Volunteer hours list (all statuses) | `hoursLogs` where uid == me, orderBy date desc | hoursLogs (uid, date desc) |
| Q18 | Impact letters list | `letters` where uid == me, orderBy issuedAt desc | letters (uid, issuedAt desc) |
| Q19 | issueLetter same-scope check | `letters` where uid == X, scopeKey == K, status == valid | letters (uid, scopeKey, status) |
| Q20 | supersedeLetters | `letters` where evidence.logIds array-contains L, status == valid | letters (evidence.logIds array-contains, status) |
| Q21 | Org letters list | `organizations/{id}/letterRefs` orderBy issuedAt desc | auto |
| Q22 | Notifications list | `notifications/{uid}/items` orderBy createdAt desc, limit 50 | auto (createdAt) |
| Q23 | Unread badge | `notifications/{uid}/items` where read == false, orderBy createdAt desc, limit 99 | items (read, createdAt desc) |
| Q24 | Org page | `opportunities` where orgId == X, status == active | opportunities (orgId, status) |
| Q25 | Explore orgs | `organizations` where archived == false, orderBy name | organizations (archived, name) |
| Q26 | Admin verification queue | `organizations` where verified == false, archived == false, orderBy createdAt | organizations (verified, archived, createdAt) |
| Q27 | Org switcher | collectionGroup `members` where uid == me | collection-group field override members.uid |
| Q28 | Invites list | `invites` where orgId == X, orderBy expiresAt desc | invites (orgId, expiresAt desc) |
| Q29 | rankVolunteers discoverable (Tier 2) | collectionGroup `private` where notificationPrefs.discoverable == true | collection-group field override private.notificationPrefs.discoverable |
| Q30 | Saved items | `users/{uid}/saved` orderBy savedAt desc | auto |
| Q31 | Reports list | `reports` where ownerUid == me, orderBy createdAt desc | reports (ownerUid, createdAt desc) |
| Q32 | Admin job history | `jobRuns` orderBy startedAt desc, limit 20 | auto |
| Q33 | Org reviews (Tier 2) | `reviews` where orgId == X, orderBy createdAt desc | reviews (orgId, createdAt desc) |
| Q34 | Published collections (Tier 2) | `collections` where published == true, orderBy updatedAt desc | collections (published, updatedAt desc) |
| Q35 | Coordinator collections (Tier 2) | `collections` where orgId == X, orderBy updatedAt desc | collections (orgId, updatedAt desc) |

Point reads (no index): `letterVerifications/{code}`, `instances/{id}`, `signups/{instanceId}_{uid}`, `users/{uid}`, `users/{uid}/private/profile`, `demoClock/global`, members docs in rules.

---

<a id="tests"></a>
## 12. Test requirements

### 12.1 By layer

| Layer | Tool | Required coverage |
|---|---|---|
| shared/ (state machine, hours, reliability, ics, clock, config, format, plannerParse, errors, aggregation) | Vitest | 100% lines and branches (G27). State machine: every status pair x actor. Hours: [#hours](#hours) table incl. DST. Reliability: mixed history, < 3 history, excused, early/late/system cancels, waitlisted late cancel, 12-month drop. .ics: confirmed, cancelled (METHOD:CANCEL, SEQUENCE+1), non-Chicago zone, DST. Milestones 25/50/100. Error catalog completeness. Config overrides. |
| Client units | Vitest + Testing Library | env validation, toUserError, signup button matrix (each state), /verify (valid, superseded with and without newer letter, revoked), assistant panel (labels, limit, signed out), empty states, Unverified chip and hidden contact, time formatter, QR hidden when not secure, emulator banner, doctor checks, report theme contrast (4.5:1) |
| Rules | @firebase/rules-unit-testing on the emulator | every row of [#rules-matrix](#rules-matrix) with allowed and denied cases; private profile extra key, isMinor write, birthDate write; users doc client write; kiosk token reading another instance and reading signupContacts; second review for one signup; collections by non-member; Storage content type, size, owner-only paths |
| Functions | Vitest against emulators | one test file per op: happy path, each listed error, cross-org denial for every coordinator op, kiosk-token denial; races (N concurrent signups for the last seat: exactly one confirmed; cancel racing a signup); idempotency retries (checkOut, finalizeShift, issueLetter, registerOrganization, submitManualHours); runDueJobs concurrent runs (lease, no double-processing) and pagination; stats trigger bounded execution count with no self-retrigger (G1); supersede after a counted log changes; letter snapshot unchanged by later log change (G19); Turnstile missing, invalid, replayed; under-13 deletes the account and data; DST shift with a non-Chicago org; AI unauthorized, over per-user limit, over global cap, oversized input, 429/timeout/bad JSON fallback; resetDemoData refusals without admin and without DEMO_MODE; health |
| E2E | Playwright, App Check debug provider, emulators | see 12.2 |

<a id="tier0-e2e"></a>
### 12.2 End-to-end

- **Tier 0 gate** (three browser contexts: coordinator laptop, kiosk tablet, volunteer phone): seeded coordinator opens the shift and starts the kiosk; volunteer signs up; clock advanced into the check-in window; volunteer checks in with the typed code; roster updates live on the laptop and kiosk; clock advanced 15 min; volunteer checks out; hours auto-approved; volunteer issues a letter; `/verify/:code` shows Valid. Also: stale code then current code; runDueJobs finalizes a no-show.
- Tier 1: waitlist promotion notification visible and banner shows Confirm / Can't make it; Needs attention approve and reject; onboarding with birth date first and under-13 stop (no account created); navigation per role; login as each demo role; kiosk offline pause, stale code, camera denied fallback; kiosk lock (back intercept, exit requires sign-in) and forced session expiry; keyboard-only path through signup and check-in; axe zero serious/critical on Explore, Opportunity, Dashboard, Kiosk, Verify; Tier 0 screens at 150% text + high contrast without overflow; `reducedMotion: reduce`; screenshots at 375/768/1440; letter issue, change a counted log via setAttendance, `/verify` shows Superseded.

### 12.3 Critical paths and hostile QA

From the eng test plan: the Tier 0 three-context demo loop; runDueJobs finalizing once under overlapping scheduled and admin runs. Hostile cases: two concurrent signups for one seat; replayed or expired kiosk code; coordinator of org A calling approveHours on an org B log; checkOut retried after a timeout; a shift crossing DST in a non-Chicago org; an under-13 birth date; a kiosk token calling approveHours; client writes of isMinor, totalApprovedHours, and counters.

Time-based tests use the injected clock, never wall time. Ported pure modules (search, consent, lazyWithReload, the match score derived from organicScore) keep their tests; business-specific Trove tests are rewritten or dropped per PORT_LEDGER.

---

<a id="schedule"></a>
## 13. Build order and schedule

First competition round is 5+ months out (on or after early March 2027). All tiers are in schedule scope. Dates are targets; adjust when the round date is known.

| Window | Work | Gate |
|---|---|---|
| Oct 7 - Oct 13, 2026 | Lane A: scaffold (workspaces, Vite, Tailwind 4 + tokens, firebase.json, env, CI, doctor, demo script skeleton), `shared/` core. Lane B: PORT_LEDGER, SPEC review. | `npm run verify` green on both OSes |
| Oct 14 - Nov 3 | Tier 0 in parallel lanes: A = Tier 0 ops, triggers, runDueJobs, rules + tests; C = volunteer Tier 0 screens; D = coordinator dashboard, roster, kiosk; E = help BM25 port, letter PDF, `/verify` | Tier 0 e2e green in CI |
| As soon as the Blaze project exists | Functions deploy rehearsal (G3), App Check registration, admin claim script run | Rehearsal logged in DEMO.md |
| Nov 4 - Dec 15 | Tier 1 (lanes as above; E adds reports and assistant) | Tier 1 e2e + axe green |
| Dec 16 - Jan 5, 2027 | Design-doc reskin: apply the team's design doc to `tokens.css` and React Bits variants; full deploy to the competition project | Screenshot review; first full-loop rehearsal on the deployed site |
| Jan 6 - Feb 9 | Tier 2 | e2e green |
| Feb 10 - Feb 23 | Tier 3 SEO, README/RUBRIC_MAP/DEMO.md completion, explainers practice | Docs review |
| Feb 24 - first round | Freeze: bug fixes only; at least two timed rehearsals on three devices | Rehearsal log |

Lanes and ownership: A = scaffold, then Functions ops + rules (owns `shared/` and `firestore.rules`; others consume); B = SPEC + ledger; C = volunteer UI; D = coordinator + kiosk UI; E = help, search, reports port. A-scaffold and B first; then A-functions, C, D, E in parallel; merge; Tier 0 e2e gate.

---

<a id="appendix-a"></a>
## Appendix A: Traceability

Status: **Implemented** (where), **Dropped** (with reason), or **Doc-only**.

### A.1 Design doc concern map (R2-x)

| ID | Obligation | Section |
|---|---|---|
| R2-1 | Reminders ephemeral, notifications Function-written | [8.3](#subsystems), [rules](#rules-matrix) |
| R2-2 | registerOrganization writes org + owner member | [5.8](#api) |
| R2-3 | Public/private user split | [3.16](#dm-users), [3.17](#dm-private); public profiles cut by gate |
| R2-4 | Contact snapshot for coordinators | [3.11](#dm-signupcontacts) |
| R2-5 | Birth date set once, 13+ | [5.9](#api), [4.2](#minors) |
| R2-6 | Late-promotion excuse | [5.5](#api), [6](#state-machine) |
| R2-7 | Separate check-out with window | [5.4](#api) |
| R2-8 | Rules matrix for every collection | [4.3](#rules-matrix) (impact stories, follows, lists rows dropped by gate) |
| R2-9 | AI callers, limits, App Check, budget alert | [8.4](#ai), [10.12](#dx), [10.17](#dx) |
| R2-10 | Series 8-week window | [7.3](#formulas), Tier 2 |
| R2-11 | No init/deploy until the project exists | [1.4](#scope) |
| R2-12 | Full status set | [6](#state-machine) |
| R2-13 | Reliability exclusions | [7.2](#reliability) |
| R2-14 | Full waitlist message; waitlist closing | [5.3](#api), [7.3](#formulas) |
| R2-15 | Revocation actor and op | [5.6](#api) |
| R2-16 | Billing owner; budget alert | [1.4](#scope); LAN fallback part **Dropped** (gate UC2: website-only demo) |
| R2-17 | Tailwind + components.json + tokens | [1.4](#scope), [10.15](#dx) |
| R2-18 | Onboarding collects birth date | [9.9](#screen-onboarding) |
| R2-19 | Kiosk relay limitation documented | [5.10](#api), [10.14](#dx) |
| R2-20 | Reviews carry signupId | [4.3](#rules-matrix), [3.20](#data-model) |
| R2-21 | Verify reset on name/EIN; archive not delete | [5.8](#api) |
| R2-22 | Priority tiers | [1.2](#scope), [13](#schedule) |
| R2-23 | Cited stats | [10.14](#dx) |
| R2-24 | Design-doc coaching wording | Doc-only (design doc edit; no code) |
| R2-25 | Turnstile test keys locally | [10.6](#env) |
| R2-26 | MIT + Commons Clause note | [1.4](#scope), [10.14](#dx) |

### A.2 CEO obligations

| Short name | Section |
|---|---|
| Priority tiers / Tier 0 build order (T5) | [1.2](#scope), [13](#schedule) |
| Reminders ephemeral | [8.3](#subsystems) |
| registerOrganization transaction | [5.8](#api) |
| Public users allowlist | [3.16](#dm-users) (bio and adult-only fields **Dropped**: public profiles cut) |
| Contact snapshot | [3.11](#dm-signupcontacts) |
| Birth date once via completeProfile | [5.9](#api) |
| Late-promotion excuse | [5.5](#api) |
| Check-out separate action and window | [5.4](#api) |
| Rules matrix extended (invites, series, instanceSecrets, saved, collections, reports) | [4.3](#rules-matrix) (impactStories, follows **Dropped** by gate) |
| AI callers and limits | [8.4](#ai) |
| Series window | [7.3](#formulas) |
| Constraint wording | [1.4](#scope) |
| Status set and transitions | [6](#state-machine) |
| Reliability exclusions and formula | [7.2](#reliability) |
| Full waitlist rejection | [5.3](#api) |
| revokeLetter with reason enum | [5.6](#api) |
| Billing owner | [1.4](#scope), [10.17](#dx); LAN rehearsal **Dropped** (gate UC2) |
| Tailwind tokens (Tailwind 4 @theme) | [1.4](#scope) |
| Onboarding birth date | [9.9](#screen-onboarding) |
| Kiosk relay documented | [5.10](#api) |
| Reviews signupId and doc id | [4.3](#rules-matrix) |
| Org verify reset and archive | [5.8](#api) |
| Cited sources and FBLA quote | [10.14](#dx) |
| Turnstile test keys | [10.6](#env) |
| License | [1.4](#scope) |
| E1 demo dataset and reset safety | [10.7](#demo-accounts), [5.2](#api) |
| E2 .ics (per-shift, org TZID, UID, cancel, best-effort) | [8.7](#ics) |
| E3 accessibility controls and storage | [9.16](#a11y), [3.17](#dm-private) |
| E4 milestones and streaks | [7.3](#formulas), [5.12](#fn-stats) |
| Baseline edits (both batches) | Folded into this spec |
| Concern map | [A.1](#appendix-a) |
| finalizeShift branches | [5.5](#api) |
| Hours lifecycle (one log per signup, auto-approve kiosk) | [3.12](#dm-hourslogs), [5.4](#api) |
| setAttendance with audit | [5.7](#api) |
| Server-owned stats | [3.16](#dm-users), [4.3](#rules-matrix) |
| aiUsage, letterVerifications, letters rules | [4.3](#rules-matrix) |
| issueKioskCode | [5.10](#api) |
| Letter statuses and /verify states | [8.2](#letters) |
| Waitlist cutoff at start - 2 h | [7.3](#formulas), [5.11](#fn-runduejobs-detail) |
| Late cancel threshold | [7.3](#formulas) |
| Under-13 path | [4.2](#minors), [5.9](#api) |
| displayName derived | [5.9](#api) |
| Reports metadata owner | [3.21](#data-model) |
| React Bits vendoring (no hex) | [9.13](#screen-reactbits), [10.3](#scripts) |
| Series signup no auto-extend | [9.4](#signup-matrix), [5.2](#api) |
| Tier assignment | [1.2](#scope) (final tiers per G5 and gate) |
| PWA removed | [1.3](#scope) |
| Check-in window and code rotation | [5.4](#api) |
| Function and trigger ownership | [2.3](#architecture), [5.2](#api) |
| Opportunities/series/instances Function-only writes | [4.3](#rules-matrix) |
| users/{uid}/lists | **Dropped** (gate: collections are coordinator/admin-authored) |
| Private profile client allowlist | [4.3](#rules-private) |
| Reliability private, copied to snapshots | [3.17](#dm-private), [3.11](#dm-signupcontacts) |
| minAge enforcement | [5.3](#api) |
| Coordinator shift changes (cancel, capacity, time edit) | [5.2](#api), [5.3](#api) |
| issueLetter scope and supersede | [5.6](#api), [5.12](#fn-supersede) |
| TODOS deferrals | [1.3](#scope) |
| System cancellations not counted | [7.2](#reliability) |
| Tier 1 notification surface | [8.3](#subsystems) |
| shiftPlannerParse tier | [8.4](#ai) (Tier 2) |
| Hours formula | [7.1](#hours) (G12 form) |
| Org verification by admin | [5.2](#api) |
| Emulator scheduling / Run due jobs now | [5.11](#fn-runduejobs-detail); LAN use **Dropped** |
| health kept | [2.3](#architecture) |
| Authoritative Functions list | [2.3](#architecture), [5.2](#api) (grouped by G4) |
| Profile fields and validation | [5.9](#api), [3.17](#dm-private) |
| streakWeeks public, server-written | [3.16](#dm-users) |
| isMinor daily recompute | **Dropped** (G11: age computed at each decision) |
| Signup window and walk-up; whole-series summary | [7.3](#formulas), [5.3](#api), [9.4](#signup-matrix) |
| setAttendance coverage | [5.7](#api) |
| approveHours / rejectHours | [5.7](#api) |
| Unverified orgs excluded from letters | [5.6](#api), [9.18](#screens) |
| markNotificationsRead | [5.2](#api) |
| Waitlisted late cancels not counted | [7.2](#reliability) |
| Check-in rate limit | [5.4](#api) |
| Org cancellation transitions | [6.1](#state-machine) |
| finalizeShift / extendSeries callable only | [2.3](#architecture), [5.11](#fn-runduejobs-detail) |
| All-orgs letters: readers and revokers | [3.4](#data-model), [4.4](#auth-resolvers) |
| Contact snapshot refresh | [5.12](#fn-stats) |
| hasActivity archive rule | [5.8](#api) |
| Emulator config | [10.2](#dx) |
| Kiosk lock | [8.1](#kiosk) |
| Signed-out help | [8.5](#subsystems) |
| rankVolunteers | [8.4](#ai) (Tier 2) |
| .ics best-effort cancel | [8.7](#ics) |
| CEO summary update; consolidated spec | This document |
| shared/ module | [2.2](#architecture) |
| Competitor positioning, explainers | [10.14](#dx) |
| T1 kiosk QR | [8.1](#kiosk) |
| T2 promotion release | [5.3](#api), [9.11](#screen-promotion) |
| T3 reliability guardrails | [7.2](#reliability) |
| T4 org trust | [4.2](#minors) |
| Indexes | [11](#queries) |
| Observability | [5.1](#api), [10.17](#dx) |
| Feature flags, deploy order, smoke checklist | [10.17](#dx), [10.14](#dx) |

### A.3 Design obligations

| ID | Section |
|---|---|
| D1 Screens | [9.2](#screen-inventory) |
| D2 Navigation shell | [9.1](#screen-nav) |
| D3 /verify hierarchy | [8.2](#letters) |
| D4 Kiosk and phone states | [9.3](#screen-kiosk-states) |
| D5 Signup button matrix | [9.4](#signup-matrix) |
| D6 Empty states | [9.5](#screen-empty) (impact-stories and profile empties not applicable) |
| D7 Assistant panel | [9.6](#screen-assistant) |
| D8 Letter flow and PDF sketch | [9.7](#screen-letter-flow), [8.2](#letters) |
| D9 Needs attention | [9.8](#screen-needs-attention) |
| D10 Onboarding | [9.9](#screen-onboarding) |
| D11 Demo arc | [9.10](#screen-demo-arc) |
| D12 Reliability display | [7.2](#reliability) ("public profiles" clause moot: cut) |
| D13 Promotion visibility | [9.11](#screen-promotion) |
| D14 Status tokens | [9.12](#screen-status-tokens) |
| D15 React Bits placement | [9.13](#screen-reactbits) |
| D16 Report themes | [8.6](#subsystems) |
| D17 Planner UI | [9.14](#screen-planner) |
| D18 Reduced motion | [9.16](#a11y) |
| D19 Breakpoints | [9.15](#screens) |
| D20 Accessibility contract | [9.16](#a11y) |
| D21 Text scale | [9.16](#a11y) |
| D22 Error presentation | [9.17](#screen-errors) |
| D23 Unverified org UI | [9.18](#screens) |
| D24 Time display | [9.19](#screens), [7.5](#formulas) |
| TD1 Neutral interim tokens | [1.4](#scope), [9.12](#screen-status-tokens) |
| TD2 No mockups | [1.4](#scope) |
| TD3 No-emulator mock mode deferred | [1.3](#scope) |

### A.4 DX obligations

| ID | Section |
|---|---|
| X1 One-command demo | [10.4](#demo) (LAN URL and terminal QR **Dropped**, gate UC2) |
| X2 Pinned prerequisites | [10.1](#dx) |
| X3 Doctor | [10.5](#doctor) (port 5173 kept; no LAN checks) |
| X4 Zero-edit env | [10.6](#env) |
| X5 Demo accounts | [10.7](#demo-accounts) |
| X6 Workspaces + bundled Functions | [10.8](#dx) |
| X7 Canonical scripts | [10.3](#scripts) |
| X8 defineCallable | [10.9](#definecallable) |
| X9 Error catalog | [10.10](#errors) |
| X10 Developer failure UX | [10.13](#dx) (LAN/firewall rows **Dropped**) |
| X11 App Check debug | [10.12](#dx) (LAN-fallback flag values **Dropped**) |
| X12 Demo clock | [7.4](#clock) |
| X13 Config | [10.11](#config) |
| X14 Org time zone | [7.5](#formulas), [8.7](#ics) |
| X15 Kiosk session expiry | [8.1](#kiosk), [9.3](#screen-kiosk-states) |
| X16 Docs early, anchors, help articles | [10.14](#dx), [8.5](#subsystems), this file's anchors |
| X17 Deploy runbook | [10.14](#dx) |
| X18 Upgrade policy | [10.15](#dx) |
| X19 DX measurement | [10.16](#ci) (hard fail replaced by tracked target per G24; rehearsal log kept) |
| X20 License, CONTRIBUTING | [10.14](#dx) |

### A.5 Eng obligations

| ID | Section |
|---|---|
| G1 Bounded stats trigger | [5.12](#fn-stats) |
| G2 Resource-derived auth + per-op table | [4.4](#auth-resolvers), [5.2](#api) |
| G3 Deploy artifact + rehearsal | [10.8](#dx), [13](#schedule) |
| G4 Five grouped endpoints | [2.3](#architecture), [5.2](#api) |
| G5 Tier re-sequencing | [1.2](#scope) |
| G6 Single clock | [7.4](#clock) |
| G7 Races, waitlistSeq | [5.3](#api) |
| G8 Idempotency, lease, nextActionAt | [5.2](#api), [5.11](#fn-runduejobs-detail) |
| G9 Query catalogue | [11](#queries) |
| G10 Time zones, DST tests | [7.5](#formulas), [12](#tests) |
| G11 Profile gate, age at decision | [4.4](#auth-resolvers), [4.2](#minors) |
| G12 Hours clamp | [7.1](#hours) |
| G13 Turnstile bound to profile | [5.9](#api) |
| G14 Minor safety | [4.2](#minors) |
| G15 Kiosk custom token | [5.10](#api), [8.1](#kiosk) |
| G16 AI caps and rendering | [8.4](#ai) |
| G17 Org updates via Function; Storage rules | [5.8](#api), [3.22](#data-model) |
| G18 Under-13 before account | [4.2](#minors), [9.9](#screen-onboarding) |
| G19 Letter evidence snapshot | [5.6](#api), [3.13](#dm-letters) |
| G20 QR progressive enhancement | [8.1](#kiosk) (mkcert LAN TLS **Dropped**, gate UC2) |
| G21 HMAC details | [5.10](#api), [4.1](#roles) (token refresh after claims) |
| G22 PDF sizing | [2.3](#architecture), [8.6](#subsystems) |
| G23 Job alerting | [10.17](#dx) |
| G24 CI timing tracked | [10.16](#ci) |
| G25 Port ledger | [1.1](#scope), [10.14](#dx) |
| G26 Build inputs | header |
| G27 shared/ 100% coverage | [12.1](#tests) |
| TE3 Repo outside OneDrive | [10.1](#dx) (recommendation only) |

### A.6 Final gate

| ID | Decision | Section |
|---|---|---|
| UC1 | Keep saved items, optional map, command palette, coordinator/admin collections; cut impact stories, follows, public profiles | [1.2](#scope), [1.3](#scope), [4.3](#rules-matrix) |
| UC2 | Deployed website is the only demo target; LAN, hotspot, mkcert, LAN QR dropped | [1.3](#scope), [10.4](#demo) |
| T6 | 5+ months; Tier 0 to 3 with reskin after Tier 1 | [13](#schedule) |

---

<a id="appendix-b"></a>
## Appendix B: Resolved conflicts

Each item names the competing wording and the final behavior. Later obligations win per the precedence gate > eng > dx > design > later CEO > earlier CEO > plan text > design doc.

1. **Header wording.** The requested header status contained the word this file must not contain. Final: "Authoritative build spec; replaces PORT_PLAN.md for implementation".
2. **Tailwind version.** Earlier CEO and plan text named the older Tailwind major with a JS config. Final: Tailwind 4 with `@theme` variables from `tokens.css`.
3. **Hours formula.** Design doc: clamp to scheduled length + 30 min. CEO: min(actual, scheduled + 30); later CEO: a window widened by 30 min each side. Final (G12): clamp to the scheduled window, floor 0, nearest 15 min.
4. **Finalize timing.** Design doc: 1 h after end by a scheduled job. Final: `end + 30 min`, executed by runDueJobs or by a coordinator after end.
5. **Schedulers.** finalizeShift and extendSeries were "scheduled + callable"; design doc materialized series on dashboard open. Final: runDueJobs is the only scheduler; the others are handlers it calls and coordinator ops.
6. **isMinor flip.** CEO: runDueJobs recomputes isMinor daily. Final (G11): age is computed at each decision; isMinor is a cache refreshed by profile ops and stats recompute.
7. **Waitlist closing.** CEO: waitlisted signups cancelled at shift start. Final: cancelled at `start - 2 h`; seats freed later go to walk-up signups.
8. **Reliability location.** CEO: on `users/{uid}`. Final: `users/{uid}/private/profile` and coordinator-only snapshots.
9. **Function surface.** A list of about 35 separate Functions vs G4. Final: five callable endpoints with ops, two trigger exports, one scheduler, and `health` (HTTP). `turnstileVerify` became a step inside completeProfile; "reports PDF" became generateVolunteerReport and generateOrgReport.
10. **Ops beyond the CEO list.** Added because later obligations require them: startKiosk (G15), updateOrganization (G17), setDemoClock (X12), resetRateLimits (X13), requestAttendanceReview (T3 request review), removeMember (design doc: owners manage members), signupSeries (whole-series signup), inviteVolunteers (design doc: "ready to invite"), correctBirthDate (admin-only correction).
11. **Tiers.** CEO put recurring series, rankVolunteers, reliability charts, and the AI planner in Tier 1 and saved items and cookie consent in Tier 2. Final: G5 and gate tiers; saved items Tier 1; cookie consent Tier 2; reliability score Tier 1, charts Tier 2.
12. **Organization writes.** Design doc: client create/update/delete; CEO: rules allow archive and deny delete when `hasActivity`. Final (G17): no client writes; updateOrganization handles update, one-way archive, and delete only when `hasActivity` is false.
13. **Series, opportunity, instance writes.** Earlier CEO: "series coordinator write" in rules. Final: Function-only.
14. **Manual hours.** Design doc: volunteer creates pending logs client-side. Final: submitManualHours op; hoursLogs are Function-write-only.
15. **Notification read flag.** Design doc: owner updates `read` client-side. Final: markNotificationsRead op.
16. **Kiosk session.** Design doc: coordinator session stays underneath, exit by re-auth; issueKioskCode coordinator-only. Final (G15): scoped kiosk custom token, coordinator signed out on the device; issueKioskCode accepts the kiosk token for its instance or a coordinator; exit requires coordinator sign-in.
17. **QR secure context.** G20 allowed mkcert TLS on LAN. Final (gate UC2): secure context means the deployed HTTPS site (or localhost in development); no mkcert.
18. **npm run demo output.** X1: Vite on `--host` and a LAN URL terminal QR. Final (gate UC2): localhost links only.
19. **CI timer.** X19: fail over 5 minutes. Final (G24): tracked on ubuntu, non-failing.
20. **LAN fallback items.** Billing-owner bullet, emulator-scheduling bullet, X10 troubleshooting rows, and X11 flag values referenced a LAN rehearsal. Final (gate UC2): removed.
21. **.ics time zone.** CEO: TZID America/Chicago. Final (X14): org `timeZone`.
22. **Public user doc.** CEO: client-writable public doc with an allowlist incl. bio for adults and minor-field checks. Final (gate UC1 cut public profiles): `users/{uid}` is Function-written only, readable by self and admins, no bio.
23. **Contact snapshot location.** CEO: inside the signup doc. Final: separate `signupContacts/{signupId}`, because the kiosk token must read the roster without contact data (G15) and snapshot refreshes must not fire the signups trigger (G1).
24. **Letter readers for all-orgs letters.** CEO: coordinators of every counted org read the letter. Rules cannot check membership across an array, so final: coordinators read `organizations/{orgId}/letterRefs`; the full letter is readable by the volunteer and admins.
25. **Minor coordinators and contacts.** G14: minors cannot see adult contact snapshots. Final: minor coordinators see no contact snapshots at all (`canViewContacts false`), the stricter reading.
26. **Display names.** CEO: first name + last initial for under-18 only. Final: all public projections (users doc, kiosk, rosters without contact access, `/verify`) use first name + last initial for everyone; full name only in coordinator contact snapshots and the volunteer's private PDF.
27. **Re-signup after cancel.** Deterministic signup ids plus a terminal `cancelled` state leave no path back. Final: re-signup to the same instance is refused (`SIGNUP_CANCELLED_BEFORE`).
28. **Promotion actors.** The CEO state machine lists signup/cancel as promoters. Final adds updateInstance (capacity increase before cutoff) as a promoter of the same transition.
29. **Promotion release window.** T2 says release cancels without lateCancel, unbounded. Final: allowed within 24 h of promotion or for late promotions; otherwise a normal cancel.
30. **Disputes.** Design doc: volunteers can request review of any item. Final: requestAttendanceReview applies to no-shows within 30 days; resolution goes through setAttendance.
31. **Timestamps.** Design doc: UTC ISO strings. Final: Firestore `Timestamp` (UTC instant) plus the org IANA zone, for range queries.
32. **Org registration eligibility.** Design doc: verified email; G14: adult. Final: both.
33. **finalizeShift transaction shape.** One transaction could exceed write limits for large rosters. Final: per-signup transactions with status re-checks, instance `finalizedAt` marker written last (still idempotent per G8).
34. **Demo passwords.** X5: fixed demo passwords. Final: fixed only on emulators; deployed demo accounts use the `DEMO_ACCOUNT_PASSWORD` secret, so no deployed credential is in git.
