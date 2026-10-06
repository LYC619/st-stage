---
status_version: 1
project: st-stage
base_branch: main
working_branch: codex/i18n-acceptance
verified_code_head: cec4e8dc74eb1a99e971d0e33dfd92d65001ffab
remote_code_head_at_update: null
remote_tracking_head: 1989c2fab99a28b8b204073bcb32f59b73800079
build_version: 0.9.0+202610070357
phase: core-five-app-i18n-keyboard-validated
updated_at: 2026-10-07
updated_by: codex
verification_source: codex-regression-and-isolated-real-st-1.18.0
history: docs/maintenance/history/2026-10-07-export-final.md
previous_history: docs/maintenance/history/2026-10-07-variables.md
---

# Current Project Status

## Snapshot

- Code/build **cec4e8d** completes the authorized core UI/five-main-App i18n and practical keyboard/focus scope on **codex/i18n-acceptance**, retained at `C:\Users\yicha\.codex\worktrees\i18n-acceptance\st-stage`. The autonomous implementation/verification goal is complete; no merge, push or independent release occurred.
- Original development main remains **25d62bd**, two commits ahead of local `origin/main`, with the pre-existing untracked `tore style.css`. Independent release `D:\8.Project\0_0_维护\st-stage-ext` remains clean at **d6e8a892dbb7529a5b5fc8f53e4443e1bc33c03b**. Both were rechecked October 7. Development remote authentication remains unavailable; null remote head is not a confirmed remote ref.
- Root/distribution runtime and locale files match at **0.9.0+202610070357**. Manifest stays `0.9.0`; product name 百工, persistent identities, user data and prompt/protocol content are unchanged. Bundle is **951080 bytes**.

## Delivered

- Language follows ST's browser-stored selection, then browser language. Bundle-relative locale URLs support renamed installs/proxy prefixes; request/body deadlines, dictionary validation, own-property lookup, fallback logging and interpolation keep failures safe.
- Core navigation, extension settings, shared controls, Sprite, Gallery, Cloud Export, MVU and New Variables support Chinese/English. Deep gallery dialogs, variable designer/HUD, parser diagnostics and image-save/retry/validation messages are included. **759 matching keys / 836 verified references**. Butler/Renderer home names are translated; non-core interiors are outside this scope.
- Modal stacking, focus containment/return, topmost Escape, native radio/contenteditable handling, phone navigation and semantic remount focus are implemented. Gallery cards/menus, designer/tree editing, nonmodal HUD and export tabs/selection have keyboard support. Async completion respects the user's current focus.
- Real-ST fixes cover gallery/storage/upload mobile layouts, clipboard fallback focus, same-name resource identity, duplicate host Enter behavior, and export tabs whose roles were overwritten by ST's `.menu_button` observer. Export now uses native tabs and a wrapping two-column layout. Failed-image Retry and Save are sibling actions with independent keyboard behavior.
- Export warnings/progress/errors are translated while archive paths, selected data and identities remain unchanged. Restored open chat details do not retrigger failed reads. Actual ZIP downloads preserve character, chat, worldbook, preset and regex content.
- CI checks dictionary/reference/fallback/parameter completeness, required tracked assets and reproducible runtime parity; warns above 1 MB. README, generated distribution README and i18n/accessibility guides describe actual coverage. All batches received independent spec/quality review; final cross-module review was repaired and rechecked.

## Fresh Verification

- Final **99 Vitest files / 1321 tests passed**, TypeScript, ESLint, Next/Turbopack production build and staged whitespace checks passed. Paired builds and seven-runtime-file parity passed. Final full suite used four workers; an earlier uncapped run alongside a production build timed out two unchanged heavy gallery tests, then capped reruns passed without relaxing assertions/timeouts.
- Final emitted build, **real ST 1.18.0 / Edge 143.0.3650.80: 10/10 i18n + 4/4 Export desktop/mobile Chinese/English scenarios**, zero page JavaScript errors. Export verifies host tab semantics, keyboard selection/focus, injected-category-error retry and actual ZIP file paths/content.
- **12/12 native Edge scenarios** passed for shared modal/phone/HUD, transformed-root storage, image retry and independent image Save. A separate production-module fixture with actual ST accessibility/keyboard scripts passed **6/6** export-tab locale/width scenarios.
- Prior accepted batches: **4/4 real-ST gallery layouts** on `76a262a`; **4/4 real-ST variable layouts** on `21fa402`, including actual chat save/reload and unchanged imported template data. MVU delay/focus behavior passed a separate **5/5 controlled native fixture**. See matching histories for exact build evidence.
- Maintenance regression passed: five HUD viewports, growth/drag/rotation/disposal, caret/paste/composition and four synthetic storage layouts/backup/apply. Final relevant desktop/mobile screenshots were inspected.

The disposable ST runtime/data and evidence remain under ignored `test-results/real-st/` and sibling evidence directories. Its loopback server at port 18769 was stopped after acceptance. Daily ST data was not used or modified. External image hosts were blocked; copied-runtime thumbnail dependency warnings remain, so image conversion/cloud availability were not accepted.

## Remaining Gates

1. Real third-party MVU/Tavern Helper is absent: only its unavailable UI and controlled read/write fixtures were verified. Physical phones, OS input methods, actual screen readers, WAVE and complete contrast/WCAG AA evidence remain unverified. This is a scoped functional/keyboard completion, not full WCAG or every historical September 12 plan item.
2. Existing September 7 real-ST image migration/save/reload/restore, fault handling and ZIP-import gates, and deferred export identity/cancellation/case edges remain open in DEFERRED.md. ZIP export-content verification does not close ZIP import.
3. Integrate the retained branch and resolve development Git authentication when instructed. License selection and license/CI badges remain a maintainer/publication decision; no new license was inferred.
4. Publish the independent release only as a separately instructed operation. Three-way parity will differ until that older release is intentionally synchronized.

## Distribution Invariants

- Keep development `st-stage` and new-install `st-stage-ext` distinct. Never rename/reuse the old name, rewrite release history or graft development history into release history.
- Required release manifest is **eight files**: `manifest.json`, `index.js`, `bundle.js`, `style.css`, `version.json`, `README.md`, `locales/zh-CN.json`, `locales/en-US.json`. Pre-i18n six-file instructions are superseded.
- Build with `pnpm build:all`. Compare seven runtime files across root/distribution/release; compare README across distribution/release. Generated README comes from `st-extension/distribution-readme.md`.
- Preserve release `.gitattributes` and LF locale files. Never clear the release directory or copy source/tests/docs/public assets/private references/test data into it. Publish development history before distribution history.
