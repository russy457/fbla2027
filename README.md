# fbla 2027

A volunteer management platform for nonprofits, built for the FBLA 2026-27 Coding & Programming event ("Serving the Community: Nonprofit Volunteer Management"). Volunteers find shifts and sign up; coordinators run a live check-in kiosk at the event; hours are logged automatically and turned into verified service-hour letters anyone can check at `/verify`. The product name lives in `src/lib/brand.ts`.

**Source of truth:** [`docs/SPEC.md`](docs/SPEC.md) defines the behavior, data model, rules, and screens. This README covers setup only.

**More docs:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (how the app, `shared/`, Functions, and rules fit together; adding an op or a screen), [`docs/DEMO.md`](docs/DEMO.md) (deployment and competition-day runbook), and [`docs/FIREBASE_STATUS.md`](docs/FIREBASE_STATUS.md) (the new cloud project's current setup). [`docs/RUBRIC_MAP.md`](docs/RUBRIC_MAP.md) maps rubric rows to screens and files.

## Prerequisites

- **Node 22** (pinned in `.nvmrc`; `nvm use` picks it up)
- **JDK 21+** (the Firebase emulators run on Java)

`firebase-tools` is a dev dependency, so there is nothing to install globally. No real Firebase project is needed: local runs use the `demo-fbla2027` project with the Firebase Emulator Suite.

## Quickstart

```
npm ci
copy .env.example .env.local
npm run demo
```

On macOS or Linux use `cp .env.example .env.local`. The values in `.env.example` work locally with zero edits. If something fails, run `npm run doctor`; it prints the problem, the cause, and the fix for each check.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run demo` | Doctor checks, builds Functions, starts the emulators, seeds demo data, and runs the app at http://localhost:5173 |
| `npm run demo:restart` | Stops only this project's listeners, verifies signup against isolated emulators, then starts the full stack in one terminal |
| `npm run demo:cloud` | Legacy hybrid mode for testing cloud Auth and Firestore with local Functions |
| `npm run seed:cloud -- --yes` | One-time fictional seed for the pinned cloud project; refuses to overwrite a nonempty database |
| `npm run verify:signup` | Uses isolated emulators to sign in, call signup, and confirm Firestore documents and seat counts |
| `npm run demo:windows` | Opens four isolated local Chrome sessions for coordinator, kiosk setup, volunteer, and admin; run after `npm run demo` |
| `npm run dev` | Starts the full local stack, including seeded Auth and Firestore emulators |
| `npm run dev:web` | Vite only, for use when the emulators are already running |
| `npm run emulators` | Builds Functions and starts the Auth, Firestore, Functions, and Storage emulators |
| `npm run doctor` | Checks Node, Java, free ports, `.env.local`, installed dependencies, and warns about OneDrive folders |
| `npm run typecheck` | `tsc -b` across the app, `shared/`, and `functions/` |
| `npm test` | Vitest for the app, `shared/`, and `functions/`, with coverage (shared at 100%) |
| `npm run test:e2e` | Playwright smoke test with an axe accessibility scan |
| `npm run build` | Typecheck and production web build into `dist/` |
| `npm run build:production` | Builds the live app with cloud services and onboarding enabled |
| `npm run deploy:production` | Builds and deploys the live app to Firebase Hosting |
| `npm run build:functions` | Bundles `functions/src` + `shared/` into the standalone `functions-dist/` deploy directory |
| `npm run check:tokens` | Fails if a hardcoded color appears in `src/components` |
| `npm run seed:demo` | Seeds the running emulators (Tier 0 fills this in) |
| `npm run demo:reset` | Rebuilds demo data (Tier 0 fills this in) |
| `npm run verify` | Everything CI runs: typecheck, test, build, build:functions, check:tokens |

If the local site loads but login or demo controls cannot reach the server, the Auth or Functions emulator is missing. Run `npm run demo:restart` in one terminal and leave it open. It checks signup writes before opening the site. `npm run dev` also starts all local services; run only one of these commands at a time. To rerun the signup check independently, use `npm run verify:signup`; it uses separate emulator ports. Local signups appear in the emulator UI at http://localhost:4000.

## Live Firebase presentation

Open the [live site](https://fbla2027-ethanteng.web.app). It uses cloud Auth, Firestore, Functions, and Storage without a local server. Sign in as `volunteer@demo.fbla2027.test`, `minor@demo.fbla2027.test`, `coordinator@demo.fbla2027.test`, or `admin@demo.fbla2027.test`. Their separate passwords are keyed by `demo-volunteer`, `demo-minor`, `demo-coordinator`, and `demo-admin` in `.cloud-demo-accounts.local` (gitignored, mode 600). The one-click local demo role buttons are hidden on the live site.

The project is on Blaze. Cloud signups appear in the Firebase console, and scheduled jobs and Firestore triggers run in the cloud. `npm run seed:cloud -- --yes` is only for an empty project; it refuses to overwrite existing data. Local `npm run dev` still uses a separate emulator database. If the admin resets live demo data, all four accounts use the private `resetPassword` in `.cloud-demo-accounts.local` afterward.

Use `npm run deploy:production` to update the hosted app. Keep `npm run demo` as the offline rehearsal path.

## Repository layout

```
src/            React app (pages, layouts, components, lib, store, styles)
src/styles/     tokens.css holds every color, font, radius, spacing, shadow, and motion value
shared/         TypeScript shared by the app and Functions (clock, limits, error catalog, env validation)
functions/      Cloud Functions source (health + five callable endpoints via defineCallable)
scripts/        Cross-platform Node scripts (demo, doctor, build-functions, check-tokens, seed)
e2e/            Playwright tests
docs/           SPEC.md (source of truth), ARCHITECTURE.md, DEMO.md, RUBRIC_MAP.md, PORT_PLAN.md, PORT_LEDGER.md
```

## Licenses and credits

- This project: MIT (see `LICENSE`).
- UI animation components in `src/components/bits/` come from [React Bits](https://github.com/DavidHDev/react-bits) by David Haz, licensed **MIT + Commons Clause**: they may be used and modified here but not sold on their own. Each file header names its source.
- Fonts: Besley, Atkinson Hyperlegible Next, and JetBrains Mono (SIL Open Font License), self-hosted through Fontsource. See [`docs/ASSET_CREDITS.md`](docs/ASSET_CREDITS.md).
- Home photo: Joel Muniz / Unsplash, used as an illustrative image. See [`docs/ASSET_CREDITS.md`](docs/ASSET_CREDITS.md).
- Icons: Phosphor Icons (MIT).

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for branching, the pre-push check, and how to add a Function or a screen.
