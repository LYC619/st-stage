# 2026-08-25 Cloud Export Registration

## Boundary

- Code/build commit: `f1d037b` (`feat: register cloud export app`).
- The commits were pushed to `origin/main`; the remote code head is now `1bb7133`.
- Existing unrelated local `style.css` state and `pre-release-cargo-target/` cache were left untouched.

## Delivered

- Registered `cloudExportApp()` in `st-extension/src/apps/index.ts` with a regression test for the built-in assembly list.
- Corrected global Regex export/import to SillyTavern's real `extension_settings.regex` field.
- Added `ch_name` to `/api/chats/get` requests to match the SillyTavern frontend contract.
- Updated the Cloud Export README from an unregistered handoff note to the built-in App behavior.
- Normalized trailing whitespace in generated bundles so JSZip license comments do not fail `git diff --check`.

## Verification

- Focused Vitest: 4 files, 24 tests passed.
- TypeScript check passed.
- ESLint passed for all changed `st-extension/src` files.
- `node st-extension/build.mjs` passed and produced `0.9.0+202608251309`.
- `git diff --check` passed.
- Local SillyTavern 1.18.0 source review confirmed the relevant endpoint shapes. Real ST App interaction and STE ZIP import remain unverified.

## Next

- Install the pushed `1bb7133` build artifacts in SillyTavern.
- Complete CURRENT.md acceptance items 17–18 with an actual exported ZIP and STE import result.
