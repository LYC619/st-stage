# 2026-08-25 STE / ST ZIP Import Handoff

## Boundary

- st-stage code commits: `11dccc3`, followed by `741a6f3` for the nested-label click safety fix.
- Paired STE code commit: `f874b55` in `silly-tavern-explorer-main`.
- Neither repository was pushed in this handoff. Existing st-stage `bundle.js`, `style.css`, `version.json`, and `pre-release-cargo-target/` remain local and were not included in the cloud-export commit.
- The export App remains unregistered by design; the maintainer will copy/register it later.

## Delivered

- Added `st-extension/src/apps/cloud-export/` as a standalone Phone App factory. It has no `apps/index.ts` registration and needs only `cloudExportApp()` in the target app list.
- Added release-aligned bridge adapters for character list/export, character chat list/read, worldbook list/read, settings-backed OpenAI presets, and global regex extraction.
- Added safe `default-user` manifest paths, sanitized path segments, minimal settings output, JSZip compression, progress, browser download, type tabs, search, select-all, nested chat selection, and explicit v1 omissions.
- Added STE's `prepare_st_backup_import` / `cleanup_st_backup_import` commands with path, symlink, secret-file, file-count, size, and temporary authorization safeguards. The React import card reuses the existing scanner, selection dialog, and importer and never persists the temporary root as `stRoot`.
- Added lifecycle tests for STE backup cancel/success/failure cleanup and source-label reporting; updated the dialog capability contract for the ZIP picker.

## Verification

- st-stage: Vitest `75 files / 918 tests`, TypeScript, full ESLint, focused bridge/manifest/ZIP tests, and `node st-extension/build.mjs` passed. The first sandboxed build-test run hit an esbuild `C:\Users\yicha` access denial; the same build suite passed in the approved project environment (`15/15`).
- STE: Vitest `135 files / 1108 tests`, `tsc -p tsconfig.app.json --noEmit`, changed-file ESLint, and `cargo test --offline` (`27 passed`) passed.
- Automated tests use representative `default-user` paths. Real SillyTavern registration and client ZIP import remain manual acceptance items 17–18 in `CURRENT.md`.

## Next Boundary

Register the standalone App in the target extension project, generate a package from a real SillyTavern release, import it through the new STE picker, and record observed results before considering push, packaging, or release metadata changes.
