# 2026-08-13 Third Acceptance Fixes And Butler 2.0

## Boundary

- Work branch: `codex/butler-performance-2-design`.
- Base and recorded remote head: `bf44be7e75e08806eda8064543e9118b88ab133b`.
- Code, tests, plans, and generated artifacts commit: `4317d0bdc5a9904bf1cf143b7d937dec46c0ea93`.
- Product version remains `0.9.0`; fixed build stamp is `0.9.0+202608132024`.
- This record does not claim a merge, push, or real SillyTavern acceptance.

## Third-Round Repairs

- Reprocessed edited messages for sprites and Renderer and made sprite/variable hiding reversible without rewriting raw chat data.
- Added conservative recovery for one unique valid bare Renderer JSON object and strengthened explicit user-trigger protocol instructions.
- Replaced opacity stepping with a live slider and added an overlay shortcut into the Sprite App.
- Corrected role-stack presentation, batch flattening, selection badge layering, and local/cloud resource labels.
- Replaced preset-copy localization with persistent same-ID overrides; preset metadata is editable and restorable while local sprite paths remain independent.
- Added exact migration for the historical built-in Prompt and exhaustive preset/address regressions.

## Butler 2.0

- Split the former compact Butler into versioned data, history, ST contracts, metrics, diagnosis, actions, experiments, runtime, and modal modules.
- Added four-layer explainable inspection, fixed six-second probes, non-regressive safe plans, actual-value reread, same-probe comparison, grouped transactions, conflict-aware restoration, and bounded history.
- Added official SillyTavern extension inventory and enable/disable governance, dependency warnings, selected-extension A/B, binary isolation, cross-reload state, self-protection, and three recovery surfaces.
- Added read-only World Info, Vector Storage, Summarize, Regex, version, resource, storage, and server guidance.
- Guarded restricted `localStorage` access so one unavailable browser capability cannot abort phone App registration.
- Prevented concurrent samples, stale static results overwriting dynamic evidence, historical samples becoming a new transaction baseline, and partial extension failures advancing an invalid experiment round.

## SillyTavern Contract Review

The local SillyTavern 1.18.0 source was reviewed before enabling governance. `public/scripts/extensions.js` exports `extensionNames`, `extensionTypes`, `extension_settings`, `findExtension`, `getExtensionManifest`, `enableExtension(name, reload = true)`, and `disableExtension(name, reload = true)`. Passing `reload=false` saves the disabled list and marks reload required. `public/script.js` exports generation state and settings-save functions. Runtime shape guards still make governance read-only if a future host omits the contract.

## Verification

- Vitest: 69 files, 868/868 tests passed.
- TypeScript and full ESLint: passed.
- Next.js 16.2.6 production build with Turbopack: passed.
- Playwright: 25/25 across desktop Chromium, Pixel 7, and Galaxy S8.
- Extension build integration: 15/15 as part of full Vitest.
- `git diff --check`: passed; Prompt source has no binary NUL byte.
- Root and `st-distribution/` fixed-stamp builds were repeated and remained byte-identical.
- Shared artifact hashes:
  - `bundle.js`: `28615C436F44AE66D49316932B4A93D754AED5CC580922F8E06DBC24C3006FDE`
  - `index.js`: `D0E60A1B546D223922A7FBF01231B79205874963BDFFE4C963BD081347C9B849`
  - `style.css`: `27A40EEE3EE26EEF26935C9D95421F194E9C2BD8911566985A59FE65A2C869CD`
  - `version.json`: `0E900818A755940D29230B011BC2DEE8FD3A0195E6005B0317F027BA4A086C4E`
- Distribution: exactly 6 install files, with no images, `public/`, `reference/`, or preset source.

## Environment Exceptions

- Full Vitest initially placed build fixtures under the user temp directory, which the sandbox denied. Re-running with `TEMP/TMP` set to a verified repository-local temporary directory passed 868/868; that directory was then removed.
- Playwright browser launch was blocked in the sandbox. The approved project-scoped command outside that restriction passed 25/25.
- Frozen install was attempted but could not be independently verified because Corepack could not resolve pnpm 10.32.1 offline, while the fallback wrapper refused a non-interactive modules-directory rebuild. The lockfile was not changed; all other gates used the existing lockfile-derived dependency tree.

## Next Boundary

Install this branch in real SillyTavern and execute the 25-item list in `docs/maintenance/CURRENT.md`. Only observed failures should be changed. Keep `manifest.json` at `0.9.0` until that list passes, then rerun release gates before merge and push.
