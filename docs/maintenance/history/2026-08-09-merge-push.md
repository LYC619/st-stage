# Merge and Push Maintenance Record (2026-08-09)

## Scope

- Merged `codex/renderer-onboarding-density` (code head `af7e545`, plus maintenance docs) into `main` as a fast-forward and pushed to `origin/main`.
- No code changes in this batch; this record and the `CURRENT.md` refresh are the only additions.

## Pre-Merge Verification (fresh, 2026-08-09)

- `pnpm install --frozen-lockfile`, ESLint, TypeScript typecheck: passed.
- Vitest: 586/586 (584 recorded on 2026-08-07 plus the two `af7e545` regression tests).
- Next.js production build: passed.
- Extension artifacts rebuilt with the committed stamp (`ST_STAGE_BUILD_TIME="2026-08-07 02:37"`): `git diff --exit-code` clean for root `index.js`/`bundle.js`/`style.css`/`version.json` and for the entire `st-distribution/` tree.
- `CURRENT.md` staleness gates: `verified_code_head` is an ancestor of HEAD and no non-maintenance files changed after it.
- Mobile E2E was not rerun; the 20/20 result recorded on 2026-08-07 covers the same code state.

## Build Stamp Gate

- `origin/main` (`b97e894`) shipped stamp `0.9.0+202608060025`; this branch ships `0.9.0+202608070237`, refreshed in the same commit as the last code change (`af7e545`).
- The stamps differ, so installed users receive a changed `bundle.js?v=` URL after updating; no re-stamp was needed.
- The intermediate non-monotonic stamp `202608070900` (`7c7109e`) was never published and no user could have it cached.

## Outcome

- `main` fast-forwarded to the branch tip and pushed; remote head before the push was `b97e894`.
- Real SillyTavern acceptance (8 items in `CURRENT.md`) remains open and is the maintainer's next step, now testable against `origin/main`.
