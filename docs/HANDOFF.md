# Handoff: fbla2027 ("Pitch In")

Last updated 2026-10-07. Read this first if you are picking up the project, whether you are a teammate or a new Claude session.

## 1. What this is

A web app for the FBLA 2026-27 Coding & Programming topic **"Serving the Community: Nonprofit Volunteer Management"**, judged on the 110-point rubric. It is a port of last year's app (Trove, `github.com/russy457/fblaslc2026`): every feature and the code structure were carried over and re-aimed at volunteer management. The old visual design was **not** kept.

- Repo: `github.com/russy457/fbla2027`, branch `main`. **Nothing has been pushed yet.** All work is in local commits (latest `e5d337b`).
- Working name: **Pitch In** (one constant, `APP_NAME` in `src/lib/brand.ts`, so a rename is a one-line change).
- Demo target: the deployed website only (pre-judged round, venue wifi). No LAN or hotspot demo.

## 2. Status

All four build tiers in the plan are done, and each tier had a security review and a code review with all findings fixed.

| Tier | What it covers | State |
|---|---|---|
| 0 | Demo loop: sign up, kiosk 6-digit/QR check-in, auto hours, verified letter + `/verify` | Done |
| 1 | Waitlist, reliability, notifications, Explore filters, saved items, .ics, accessibility controls, milestones, org registration/invites, shift CRUD, hours approval + Needs attention, disputes, manual hours, letter revoke/supersede, PDF/CSV reports, AI help assistant, planner parser, legal pages, demo reset, profile + org pages | Done |
| 2 | Recurring series + whole-series signup, volunteer ranking + invites, AI planner, reliability charts, curated collections, org reviews, Ctrl+K command palette, bell menu, optional Mapbox map, storage notice | Done |
| 3 | SEO: titles/meta, Open Graph, robots.txt, sitemap, JSON-LD | Done |
| Design | New look from the team's design doc | **Not started** (waiting on the team) |
| Deploy | New Firebase project + hosting | **Not started** (waiting on the team) |

Test status at `e5d337b`, all passing:

| Suite | Command | Result |
|---|---|---|
| Typecheck, unit/component tests, build, functions bundle, token check | `npm run verify` | 1200 tests |
| Firestore/Storage rules | `npm run test:rules` | 72 |
| Cloud Functions (emulator) | `npm run test:functions` | 207 |
| End-to-end (Playwright) | `npm run test:e2e:tier1a`, `tier1b`, `tier2a`, `tier2b`, plus lane C/assistant/smoke | 30 |

On a low-memory machine, run the e2e suites one at a time: `npm run test:e2e:all` runs everything at once and was once killed for using too much memory.

## 3. Where things are

| Doc | Use it for |
|---|---|
| `docs/SPEC.md` | The authoritative build spec: data model, rules matrix, every API op, state machine, hours formula, screens, tests. Appendix B records every decision made during the build. |
| `docs/RUBRIC_MAP.md` | Each rubric row mapped to the screen and file that earns it, plus a competitor table |
| `docs/DEMO.md` | Deploy runbook and the step-by-step judges' demo script |
| `docs/ARCHITECTURE.md` | System diagram, data model summary, security model, testing pyramid |
| `docs/PORT_PLAN.md`, `docs/designs/volunteer-management-port.md` | The approved plan and its review record (design decisions D1-D24, eng decisions G1-G27) |
| `docs/PORT_LEDGER.md` | What happened to each of the 308 files in the old app |
| `TODOS.md` | Deferred ideas (CSV roster import, Spanish UI, and others) |

Code layout: `src/` (React app), `shared/` (zod schemas and domain logic used by both sides), `functions/` (callable endpoints `volunteer`, `coordinator`, `kiosk`, `admin`, `ai`, plus triggers and the `runDueJobs` scheduler), `firestore.rules`, `storage.rules`, `e2e/`, `tests/rules/`, `scripts/`.

## 4. Run it locally

Prerequisites: Node 22 (`.nvmrc`; Node 24 also works, but `npm run doctor` warns about it), Java 21 for the emulators, `npm ci`.

```bash
cp .env.example .env.local      # emulator-safe defaults, no edits needed
npm run demo                    # builds functions, starts emulators, seeds demo data, starts Vite on 5173
```

If port 5173 is taken (this machine has another project running on it), start the pieces by hand on another port:

```bash
npm run build:functions
npx cross-env FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase emulators:exec --project demo-fbla2027 \
  --only auth,firestore,functions,storage --ui \
  "node scripts/seed-demo.mjs --shift-starts-in=10m && npx vite --port 5180 --strictPort"
```

Demo accounts (emulator only; the password works nowhere else):

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.fbla2027.test | pitchin-demo-2027 |
| Coordinator (owner of Alamo Community Pantry) | coordinator@demo.fbla2027.test | pitchin-demo-2027 |
| Adult volunteer, 19 (Jordan, 22.5 h of history) | volunteer@demo.fbla2027.test | pitchin-demo-2027 |
| Minor volunteer, 15 (Sam) | minor@demo.fbla2027.test | pitchin-demo-2027 |

Useful pages: `/opportunity/demo-shift`, `/org/alamo-community-pantry/dashboard`, `/org/alamo-community-pantry/kiosk/demo-shift`, `/admin` (demo clock and reset), and the Emulator UI at `localhost:4000`. Sign-ins are shared within a browser, so use a separate private window for each role.

## 5. Next steps

### Team actions (only people can do these)
1. **Revoke the leaked keys.** Revoke the old Mapbox `sk.` token and the OpenRouter key, and rotate the Turnstile secret. They are in the old repo's public git history.
2. **Answer the design questions** below, or hand over your own design doc.
3. **Create the new Firebase project** when ready to deploy. An adult must be the billing owner (Blaze plan) and set a $5 budget alert. Then follow `docs/DEMO.md`, which covers secrets, granting the Functions service account "Service Account Token Creator" (needed for signed PDF links), and creating the first admin with `scripts/set-admin.mjs`.
4. **Fill in the placeholders.** Replace `LEGAL_CONTACT_PLACEHOLDER` in `src/lib/legal.ts` and fact-check the competitor table in `docs/RUBRIC_MAP.md` (the Golden row is the least certain).
5. **Optional local setup.** Install Node 22, and move the repo out of OneDrive (file locking slows builds and blocked deleting leftover `.claude/worktrees/` folders, which are safe to delete by hand).

### Design questions (needed before the reskin)
1. Final name: keep "Pitch In"?
2. Primary audience: teen volunteers on phones, coordinators on laptops, or both?
3. 3-5 sites or apps whose look you like, with one line on why.
4. Two or three words for the feeling: warm, bold, playful, editorial, calm, premium...
5. Existing assets: colors, logo, fonts.
6. Hard nos.

The plan after that: run `/design-consultation` to produce the design system (`DESIGN.md`), then mock Explore, phone check-in, coordinator dashboard, and kiosk for approval, then apply the design everywhere. All styling goes through `src/styles/tokens.css` and token classes (`npm run check:tokens` fails on hard-coded colors), so the reskin is mostly tokens plus layout, not logic.

### Open product questions (small)
- Should ranking volunteers for an unsaved planner draft get a screen on the new-shift page? The server op exists.
- Should ranking refs get their own secret instead of reusing `KIOSK_MASTER_SECRET` (HKDF domain-separated today)?
- Should archiving an org also archive its opportunities or cancel empty future shifts?
- No avatar upload UI yet (`avatarPath` is accepted by `updateProfile`).

## 6. Old repo security work (in progress)

The user asked to fix the security problems in last year's repo (`../fblaslc2026_old`). An agent is working on a local branch `security-fixes` there:
- remove secrets and secret-bearing one-off scripts from the current files;
- fix the still-open audit findings F1-F22 from `SECURITY_AUDIT_2026-06-18.md` (rules, report SSRF, Turnstile bypass, dependencies, CSP, CI);
- write `SECURITY_FIXES.md`.

Constraints set by the user: **no git history rewrite**, no push, no deploy, no calls to live services. Review the branch before pushing. If the old site is still live, its new rules have to be deployed to the old Firebase project by its owner; otherwise shut that project down.

## 7. Ground rules for whoever continues

- **Firebase:** do not run `firebase init` or point at a real project until the team creates the new one. Use emulators only, project id `demo-fbla2027`.
- **Secrets:** no secrets in git. Keys go in Functions secrets or gitignored `.env` files.
- **Old repo:** treat `../fblaslc2026_old` as read-only, except for the `security-fixes` branch work.
- **Pushing:** push only when the user asks. Commit attribution: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Port 5173:** another project's dev server runs there. Don't kill it.
- **Emulator temp folders:** before running emulator suites, set `TEMP`/`TMP` to `$PWD/.tmp-emu` (gitignored) to avoid Storage emulator temp clashes.
- **How the build was done:** parallel agent lanes in git worktrees, each with its own emulator ports and `// Tier N lane X` blocks in shared files. The orchestrator merges, reruns every suite, then runs security and code review agents and fixes their findings.
- **Code style:** TypeScript strict, small files with header comments, zod at every boundary, one injectable clock in Functions (no `Date.now()`/`serverTimestamp()`), org authorization derived from the target resource, and minor privacy (first name + last initial; contacts hidden at unverified orgs).
