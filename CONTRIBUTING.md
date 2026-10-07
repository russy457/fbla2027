# Contributing

`docs/SPEC.md` is the source of truth for behavior. If code and the spec disagree, fix one of them in the same pull request.

## Branches

- Never commit straight to `main`. Branch per change: `feat/kiosk-code`, `fix/waitlist-cutoff`, `docs/help-articles`.
- Commit messages: `<type>: <description>` with types `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.
- Open a pull request; CI must be green before merge.

## Before you push

```
npm run verify
```

This runs typecheck, unit tests with coverage (shared/ must stay at 100%), the web build, the Functions bundle, and the design-token check. CI runs the same command on Windows and Ubuntu.

## Add a Function operation

1. Put the input schema (zod) in `shared/src/` so the client and the Function share it.
2. Write the handler in `functions/src/ops/<opName>.ts` with `defineOp({ input, auth, handler })`. Throw `new AppError("CODE")` for expected failures; add new codes to `shared/src/errors.ts` with a message, a fix, and a help slug (or `null`).
3. Register it in the right endpoint map in `functions/src/endpoints/` (volunteer, coordinator, kiosk, admin, ai).
4. Add the Firestore rules row it relies on (`firestore.rules`) and a rules test.
5. Add one test file for the op next to it.

## Add a screen

1. Create `src/pages/<Name>Page.tsx` (default export).
2. Add the route in `src/router.tsx` with `lazyWithReload`.
3. Use only token-backed utilities (`bg-surface`, `text-fg`, `text-status-success`, ...). `npm run check:tokens` fails on hardcoded colors in `src/components`.

## React Bits components

Vendored React Bits components live in `src/components/bits/`. Each file header records the source URL, the date it was copied, the license (MIT + Commons Clause), and local edits. Keep those headers when you change a file.
