# Pitch In (working name)

A volunteer management platform for nonprofits, built for the FBLA 2026-27 Coding & Programming event ("Serving the Community: Nonprofit Volunteer Management"). Volunteers find shifts and sign up; coordinators run a live check-in kiosk at the event; hours are logged automatically and turned into verified service-hour letters anyone can check at `/verify`. The product name lives in `src/lib/brand.ts` and will change.

**Source of truth:** [`docs/SPEC.md`](docs/SPEC.md) defines the behavior, data model, rules, and screens. This README covers setup only.

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
| `npm run dev` | Vite dev server only (start the emulators yourself) |
| `npm run emulators` | Builds Functions and starts the Auth, Firestore, Functions, and Storage emulators |
| `npm run doctor` | Checks Node, Java, free ports, `.env.local`, installed dependencies, and warns about OneDrive folders |
| `npm run typecheck` | `tsc -b` across the app, `shared/`, and `functions/` |
| `npm test` | Vitest for the app, `shared/`, and `functions/`, with coverage (shared at 100%) |
| `npm run test:e2e` | Playwright smoke test with an axe accessibility scan |
| `npm run build` | Typecheck and production web build into `dist/` |
| `npm run build:functions` | Bundles `functions/src` + `shared/` into the standalone `functions-dist/` deploy directory |
| `npm run check:tokens` | Fails if a hardcoded color appears in `src/components` |
| `npm run seed:demo` | Seeds the running emulators (Tier 0 fills this in) |
| `npm run demo:reset` | Rebuilds demo data (Tier 0 fills this in) |
| `npm run verify` | Everything CI runs: typecheck, test, build, build:functions, check:tokens |

## Repository layout

```
src/            React app (pages, layouts, components, lib, store, styles)
src/styles/     tokens.css holds every color, font, radius, spacing, shadow, and motion value
shared/         TypeScript shared by the app and Functions (clock, limits, error catalog, env validation)
functions/      Cloud Functions source (health + five callable endpoints via defineCallable)
scripts/        Cross-platform Node scripts (demo, doctor, build-functions, check-tokens, seed)
e2e/            Playwright tests
docs/           SPEC.md (source of truth), PORT_PLAN.md, PORT_LEDGER.md
```

## Licenses and credits

- This project: MIT (see `LICENSE`).
- UI animation components in `src/components/bits/` come from [React Bits](https://github.com/DavidHDev/react-bits) by David Haz, licensed **MIT + Commons Clause**: they may be used and modified here but not sold on their own. Each file header names its source.
- Fonts: Instrument Sans and JetBrains Mono (SIL Open Font License), self-hosted through Fontsource.
- Icons: Phosphor Icons (MIT).

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for branching, the pre-push check, and how to add a Function or a screen.
