# Demo Runbook

How the team sets up, runs, and recovers the live demo for the pre-judged round. The deployed website is the only demo target (PORT_PLAN gate decision): the coordinator laptop, the kiosk tablet, and the volunteer phone all open the same HTTPS site. There is no LAN, hotspot, or emulator fallback on competition day; local emulators are for development and rehearsal only.

| | |
|---|---|
| Source of truth | `docs/SPEC.md` (10.6 env, 10.7 demo accounts, 10.12 App Check, 10.14 docs) |
| Rehearsal owner | (name) |
| Explainers owner | (name) |
| Status | First deploy not done yet. Nothing in this file has been run against a real project. Fill the rehearsal log as each step is tried. |

Contents: [1. First deploy](#1-first-deploy) · [2. Competition day](#2-competition-day) · [3. Demo script](#3-demo-script) · [4. Reset and recovery](#4-reset-and-recovery) · [5. Explainers](#5-explainers) · [6. Questions judges ask](#6-questions-judges-ask) · [7. Rehearsal log](#7-rehearsal-log)

---

## 1. First deploy

Do these once, with the team adult who owns billing, on a new Firebase project. Never reuse the old Trove project. Every command below names the project explicitly; the repo has no `.firebaserc` on purpose, so nothing deploys by accident.

### 1.1 Project setup (Firebase console)

1. Create a project, for example `pitchin-fbla-2027`. Upgrade to **Blaze** (Cloud Functions v2 needs it) and set a budget alert at $5 (PORT_PLAN AI limits).
2. **Authentication**: enable Email/Password.
3. **Firestore**: create the default database in `us-central1` (the Functions region).
4. **Storage**: create the default bucket.
5. **Hosting**: add a site. Note its URL (`https://<project>.web.app`); it is `APP_BASE_URL` below.
6. **App Check**: register the web app with reCAPTCHA Enterprise and note the site key. Register debug tokens only for development browsers; the three demo devices use the real provider on the deployed site (SPEC 10.12).
7. **Cloudflare Turnstile**: create a widget for the hosting domain; note the site key and secret.
8. Optional **Mapbox** map: create a public `pk.` token whose URL restrictions list only the hosting domains. Never create or paste an `sk.` token anywhere in this repo. Leave it out to hide the map toggle.
9. Revoke the old Trove Mapbox `sk.` token, rotate the old OpenRouter key and Turnstile secret, and restrict or retire the old Firebase project (SPEC 1.5).

### 1.2 Environment variables

**Web app** (bundled into the browser, so never a secret). Put them in `.env.production.local` (gitignored by `*.local`); `vite build` reads it.

| Variable | Deployed value |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_APP_ID` | the web app config from Project settings |
| `VITE_USE_EMULATORS` | `false` |
| `VITE_DEMO_MODE` | `true` (shows "Sign in as...", the demo controls, and Reset demo data to admins) |
| `VITE_TURNSTILE_SITE_KEY` | the Turnstile site key |
| `VITE_APPCHECK_SITE_KEY` | the reCAPTCHA Enterprise key |
| `VITE_MAPBOX_TOKEN` | blank, or the URL-restricted `pk.` token |
| `APP_BASE_URL` | `https://<project>.web.app` (canonical URLs, `robots.txt`, `sitemap.xml`; the build warns when it is missing) |

**Functions** (read on the server). The Functions source directory is the generated `functions-dist/` (see `firebase.json`), so put them in `functions-dist/.env.<projectId>`. That file is gitignored with the rest of `functions-dist/` and survives `npm run build:functions` (the build only replaces `functions-dist/lib`).

| Variable | Deployed value |
|---|---|
| `DEMO_MODE` | `true` on the competition project |
| `ALLOW_DEMO_CLOCK` | `true` (the demo clock is otherwise allowed only on `demo-` projects) |
| `APP_BASE_URL` | `https://<project>.web.app` (kiosk QR links, letter verify links) |
| `APPCHECK_ENFORCE` | `true` |
| `TURNSTILE_ENABLED` | `true` |
| `AI_ENABLED` | `true` to let the help assistant call the model; `false` keeps the top-3-articles fallback |
| `AI_PROVIDER`, `AI_MODEL` | `anthropic` and the model id (blank uses the provider default) |
| `KIOSK_MIN_INSTANCES` | `0` normally, `1` on competition day only |

**Secrets** (Secret Manager; set once, never in a file):

```
npx firebase functions:secrets:set KIOSK_MASTER_SECRET --project <projectId>
npx firebase functions:secrets:set TURNSTILE_SECRET --project <projectId>
npx firebase functions:secrets:set DEMO_ACCOUNT_PASSWORD --project <projectId>
npx firebase functions:secrets:set ANTHROPIC_API_KEY --project <projectId>
```

`KIOSK_MASTER_SECRET` is any long random string (for example 48 random bytes in base64). `DEMO_ACCOUNT_PASSWORD` must be at least 8 characters; `admin.resetDemoData` refuses to run without it. `OPENROUTER_API_KEY` is needed only if `AI_PROVIDER=openrouter`.

### 1.3 Deploy order

Run from a clean checkout of the commit being shown, after `npm ci` and a green `npm run verify`.

```
npm run build                                   # web app into dist/ (reads .env.production.local)
npx firebase deploy --only firestore:rules,firestore:indexes,storage --project <projectId>
npx firebase deploy --only functions --project <projectId>     # predeploy runs npm run build:functions
npx firebase deploy --only hosting --project <projectId>
```

Rules and indexes go first so the new Functions never meet an old rule set. Index builds can take several minutes; the Firestore console shows progress.

### 1.4 First admin and demo data

The seed creates the four demo accounts (SPEC 10.7) and sets the admin claim, but on a fresh project nobody is admin yet, so the very first seed needs a one-time bootstrap:

1. In Authentication, add `admin@demo.fbla2027.test` with the `DEMO_ACCOUNT_PASSWORD` value.
2. Give that account the `admin: true` custom claim from a team laptop signed in with `gcloud auth application-default login`:

   ```
   node scripts/set-admin.mjs --project <projectId> --email admin@demo.fbla2027.test          # prints the plan, changes nothing
   node scripts/set-admin.mjs --project <projectId> --email admin@demo.fbla2027.test --yes    # sets { admin: true }, keeps other claims
   ```

   The script has no default project, prints what it will do, and changes nothing without `--yes`. It refuses `demo-` project ids unless `FIREBASE_AUTH_EMULATOR_HOST` points it at the Auth emulator (that is how `functions/test/setAdmin.test.ts` exercises it). The admin signs out and back in so the new claim is on their ID token.
3. Sign in on the deployed site as the admin, open `/admin`, and press **Reset demo data**. It clears the project's data and runs the same seed as `npm run seed:demo`, with the demo shift starting in 10 minutes.

### 1.5 Post-deploy smoke test

1. `https://<region>-<projectId>.cloudfunctions.net/health` returns ok.
2. On a laptop: sign in as the admin, open `/admin`, press **Run due jobs**, and see a new row in the job runs panel.
3. On all three devices: run the demo script in section 3 end to end.
4. Open `https://<project>.web.app/robots.txt` and `/sitemap.xml`; both name the hosting URL, not localhost.

### 1.6 Rollback

- Web app: `npx firebase hosting:rollback --project <projectId>` (or pick a previous release in the Hosting console).
- Functions: check out the previous good commit, `npm ci`, then `npx firebase deploy --only functions --project <projectId>`.
- Rules: redeploy `firestore.rules` and `storage.rules` from the previous commit.

### 1.7 Monitoring

In Cloud Monitoring, add an alert on Cloud Functions error count for the `volunteer`, `coordinator`, `kiosk`, `admin`, and `ai` endpoints, emailed to the rehearsal owner. Every op logs one structured line (`functions/src/lib/defineCallable.ts`), so Logs Explorer can filter by `requestId` from an error's Details panel.

---

## 2. Competition day

| When | Step | Who |
|---|---|---|
| Day before | Set `KIOSK_MIN_INSTANCES=1` in `functions-dist/.env.<projectId>` and redeploy functions (keeps the kiosk warm; costs a little) | (name) |
| Day before | Charge all three devices; install nothing (it is a website) | (name) |
| 30 min before | Health check (1.5 step 1); sign in as admin and press **Reset demo data** so the shift starts in 10 minutes | (name) |
| 15 min before | Open the three devices (below) and leave them signed in | (name) |
| After the round | Set `KIOSK_MIN_INSTANCES` back to `0` and redeploy functions | (name) |

Devices (FBLA allows no more than three personal devices):

| Device | Window | Signed in as | Opens |
|---|---|---|---|
| Laptop | normal window | Olivia Ortiz, `coordinator@demo.fbla2027.test` | `/org/alamo-community-pantry/dashboard` |
| Laptop | private window (separate sign-in) | Ada Admin, `admin@demo.fbla2027.test` | `/admin` (demo controls: Advance clock 15 min, Reset clock, Run due jobs) |
| Tablet | full screen | starts as the coordinator, then becomes the kiosk | `/org/alamo-community-pantry/dashboard`, then Start kiosk |
| Phone | browser | Jordan Rivera, `volunteer@demo.fbla2027.test` | `/` (Explore) |

All passwords are the `DEMO_ACCOUNT_PASSWORD` secret. With `VITE_DEMO_MODE=true` the login page also shows "Sign in as..." buttons for the four roles.

---

## 3. Demo script

About 7 minutes. Every label below is the real on-screen text.

| # | Device | Do | Say (short) |
|---|---|---|---|
| 1 | Phone | On Explore, point at **Recommended** and its one-line "why". Press **Sign up** on "Sort and pack food boxes". | "Volunteers find shifts that fit them; seats update live." |
| 2 | Laptop | On the dashboard, the roster shows Jordan as signed up. Press **Ctrl+K**, type "reports", press Enter. Press **Ctrl+K** again and jump back to the dashboard. | "Every screen is two keystrokes away; the palette knows your role." |
| 3 | Tablet | On the dashboard press **Start kiosk**, then **Start kiosk on this device**. The tablet locks to the kiosk and shows a 6-digit code that changes every 30 seconds. | "The kiosk is locked to this one shift; it cannot open anything else." |
| 4 | Phone | Open **My Shifts**, press **Check in**, type the code from the tablet (or scan the QR). | "The code proves the volunteer is standing at the event." |
| 5 | Laptop + Tablet | Jordan appears in the roster (laptop) and in the kiosk arrivals (tablet) without a reload. | "Coordinators see arrivals live." |
| 6 | Laptop (admin window) | Press **Advance clock 15 min** twice. | "We fast-forward the demo clock so we don't wait 30 minutes." |
| 7 | Phone | Press **Check out**. The screen shows hours logged and progress to the next milestone (Jordan crosses 25 hours). | "Hours are calculated on the server from check-in and check-out." |
| 8 | Phone | Press **Get verified letter**, then **Issue letter**, then **Open verify page**. | "The letter has a code anyone can check." |
| 9 | Laptop | Open the verify link in the coordinator window: **Valid**. | "A school counselor can verify it without an account." |
| 10 | Phone | Tap the bell: the latest alerts slide in; **Mark all read**. | "Alerts are in-app; reminders are computed, never stored." |
| 11 | Any | Press **?** for Quick help, ask "how do I check in", show the cited answer. | "Help is on every screen, with an assistant that cites our articles." |

Optional if time allows: the waitlist promotion (a full shift, a cancel, then "You're in!" with Confirm), the planner box on **New shift**, the List / Map switch on Explore (only when a Mapbox token is configured), and the reports page.

### Demo clock

The demo clock is a server-side offset (`demoClock/global`, `shared/src/clock.ts`). **Advance clock 15 min** moves "now" forward for every device at once; **Reset clock** returns to real time. It works only when `DEMO_MODE=true` and (on a non-`demo-` project) `ALLOW_DEMO_CLOCK=true`. Scheduled jobs run every 5 minutes on the deployed site; **Run due jobs** runs them immediately (waitlist cutoff, finalize no-shows).

---

## 4. Reset and recovery

- **Between rehearsals**: admin window, `/admin`, **Reset demo data**. It reseeds everything (demo shift starts in 10 minutes) and zeroes the demo clock.
- **Local development** (emulators, never on competition day): `npm run demo`, then `npm run demo:reset` in a second terminal.

| Symptom | Likely cause | Check | Fix |
|---|---|---|---|
| Kiosk code never appears | Function cold start or `KIOSK_MASTER_SECRET` missing | Logs Explorer, `kiosk` endpoint | Wait 10 s and reload; set the secret and redeploy functions |
| "Check-in isn't open yet" | Demo shift starts more than 30 minutes out | Shift time on the dashboard | Reset demo data (shift starts in 10 minutes) |
| Demo controls disabled | Not signed in as the admin | Header shows Admin | Use the private admin window |
| Advance clock refused | `ALLOW_DEMO_CLOCK` or `DEMO_MODE` not true | `functions-dist/.env.<projectId>` | Set both, redeploy functions |
| Every call fails with an App Check error | Device has no valid App Check token | Browser console | Reload; confirm the site key and that `APPCHECK_ENFORCE` matches |
| "Missing or insufficient permissions" | Rules not deployed or index building | Firestore console | Deploy rules and indexes; wait for indexes |
| Help assistant shows only article links | AI off, over limit, or key missing (this is the designed fallback) | `ai` endpoint logs | Set `AI_ENABLED=true` and the key, or present the fallback |
| Admin page says the account is not an admin | Claim not on the ID token yet | Sign out and in again | Re-run the claim bootstrap (1.4, `scripts/set-admin.mjs`) |

Fallback answers if something breaks mid-demo: say what would happen, show the relevant e2e test (`e2e/tier0.spec.ts` runs the exact same loop on three browser contexts), and continue from the next step. Never switch to a local or LAN copy.

---

## 5. Explainers

Each row is assigned to a team member who can explain the code in two minutes.

| Feature | Rubric row | Where to point | Who |
|---|---|---|---|
| Kiosk HMAC code (30-second window, HKDF per shift) | Data structures; Security | `functions/src/kiosk/kioskCode.ts`, `shared/src/kioskCode.ts`, `functions/src/ops/issueKioskCode.ts` | (name) |
| Waitlist promotion in one transaction | Data structures | `shared/src/waitlist.ts`, `functions/src/shifts/promotion.ts`, `functions/src/ops/cancelSignup.ts` | (name) |
| Letter verification (`/verify/:code`) and supersede | Customizable reports; Security | `functions/src/ops/issueLetter.ts`, `functions/src/triggers/supersedeLetters.ts`, `src/pages/VerifyPage.tsx` | (name) |
| One wrapper for every server op | Modularity; Validation | `functions/src/lib/defineCallable.ts`, `shared/src/ops.ts` | (name) |
| Search engine (inverted index, BM25, trie, typo tolerance) | Data structures; Intelligent feature | `src/lib/search/*.ts` | (name) |
| Recommendations and smart filters | Intelligent feature | `src/lib/explore/recommendations.ts`, `src/lib/explore/filters.ts` | (name) |
| Help assistant with citations and fallback | Help and support | `functions/src/ops/askAssistant.ts`, `functions/src/ai/retrieval.ts` | (name) |
| Command palette (Ctrl/Cmd+K) | Intuitive navigation | `src/components/palette/CommandPalette.tsx`, `src/lib/palette/paletteCommands.ts` | (name) |
| Notifications bell (AnimatedList) | Intuitive navigation; UX | `src/components/notifications/BellMenu.tsx`, `src/components/bits/AnimatedList.tsx` | (name) |
| Accessibility controls and focus management | UX and accessibility | `src/components/DisplayPreferences.tsx`, `src/components/help/useFocusTrap.ts`, `src/layouts/AppLayout.tsx` | (name) |
| Input validation, client and server | Validation | `src/lib/validation/formSchemas.ts`, `shared/src/schemas/ops/*.ts`, `shared/src/stateMachine.ts` | (name) |
| Customizable reports (PDF + CSV) | Customizable reports | `src/components/reports/ReportBuilder.tsx`, `functions/src/reports/reportService.ts` | (name) |
| Security rules and their tests | Security | `firestore.rules`, `tests/rules/*.test.ts` | (name) |
| Optional map with coarse locations | UX; Privacy | `src/lib/explore/mapPoints.ts`, `src/components/explore/OrgMap.tsx` | (name) |
| Cookie notice and SEO head tags | Privacy; Polish | `src/components/CookieConsent.tsx`, `src/components/seo/RouteHead.tsx`, `src/lib/seo/*.ts` | (name) |

---

## 6. Questions judges ask

**Why not SignUpGenius?** (20 seconds) "SignUpGenius is great at one thing: a sign-up sheet. A nonprofit still has to prove who actually showed up, count the hours, and give students a letter a counselor will trust. Our app does the whole loop: the kiosk code proves the volunteer was there, hours are calculated by the server, the letter has a code anyone can check at /verify, and a waitlist fills no-show seats automatically. And it's free and built with minors' safety rules from day one."

**Couldn't someone text the code to a friend?** Yes, within about a minute. The kiosk is supervised and the coordinator sees each arrival live, so a relayed check-in is visible; the help article `kiosk-check-in` says the same.

**Do calendar cancellations always update?** Best effort: some calendar apps (Google Calendar imports) ignore the cancellation. The app says "If your calendar still shows this shift, delete the event."

**Where is location data?** Volunteers store only a ZIP-level geohash (about 5 km). The optional map shows organizations' general areas, never volunteers.

**What runs when the AI is down?** The assistant falls back to the top 3 matching help articles; nothing else depends on the model.

---

## 7. Rehearsal log

| Date | Devices | What ran | Issues | Owner |
|---|---|---|---|---|
| (first functions deploy rehearsal) | | `firebase deploy --only functions` | | |

## Open items

- Resolved: `scripts/set-admin.mjs` sets the first admin claim (1.4 step 2). It is tested against the Auth emulator only; run it against the real project for the first time at the first deploy rehearsal.
- `.env.example` says Functions settings go in `functions/.env`; with `functions-dist` as the source directory the deployed values belong in `functions-dist/.env.<projectId>`. Confirm during the first deploy.
