---
status_version: 1
project: st-stage
base_branch: main
working_branch: codex/i18n-acceptance
verified_code_head: e11cd3d378736cd7540f56d225c3870482a9bf85
remote_code_head_at_update: null
remote_tracking_head: 1989c2fab99a28b8b204073bcb32f59b73800079
build_version: 0.9.0+202609300018
phase: i18n-first-ui-validated
updated_at: 2026-09-30
updated_by: codex
verification_source: codex-regression-and-isolated-real-st-1.18.0
history: docs/maintenance/history/2026-09-30-i18n-acceptance.md
previous_history: docs/maintenance/history/2026-09-12-i18n-foundation.md
---

# Current Project Status

## Snapshot

- Code/build commit **e11cd3d** completes the recovery/acceptance batch on **codex/i18n-acceptance**, at `C:\Users\yicha\.codex\worktrees\i18n-acceptance\st-stage`. No merge or push was performed.
- Original development main remains at `25d62bd`, two commits ahead of local `origin/main`; the pre-existing untracked `tore style.css` is preserved. Actual development remote main could not be rechecked because Git authentication is required. The null remote-head field distinguishes this from a confirmed remote ref.
- Independent release `st-stage-ext` is clean at `d6e8a892dbb7529a5b5fc8f53e4443e1bc33c03b`; actual remote main was confirmed at that commit. No release files were copied or pushed.
- Root and generated distribution runtime files, including both locale JSON files, match at **0.9.0+202609300018**. Manifest remains `0.9.0`; product name 百工 and persistent IDs/keys are unchanged.

## Delivered

- Locale assets resolve relative to the running bundle, supporting renamed installs and proxy prefixes. Language follows host `localStorage.language`, then browser language. The actual ST selector reloads the page; no separate preference was added.
- A three-second request/body deadline, dictionary validation, actual fallback logging, own-property lookup and `t(key, fallback, params)` interpolation make loading failures safe.
- Phone navigation, overlay buttons/placeholders, extension settings and gallery header/new/import controls are translated. Both dictionaries contain 51 matching entries; Chinese fallback remains usable when assets fail.
- Fixed actual-ST mobile gallery toolbar overflow and duplicate Enter handling from the host keyboard listener. Gear/close controls gained accessible labels and keyboard activation.
- `pnpm build:all` shares one timestamp between destinations. Locale output is LF-normalized/pinned. Parity checks include nested locale paths, exact case and escaping links. CI verifies required files are tracked before rebuilding.

This is the first UI translation batch. App names/content, deeper gallery controls/messages and comprehensive focus/screen-reader support remain future work.

## Fresh Verification

- **92 Vitest files / 1231 tests passed**; TypeScript, ESLint and whitespace checks passed.
- Default Next.js 16.2.6/Turbopack production build, both extension builds and local runtime/locale parity passed.
- **Real ST 1.18.0 / Edge 143.0.3650.80: 10/10 scenarios passed**, zero page JavaScript errors: desktop/mobile Chinese/English layouts, renamed-directory locale HTTP 200 responses, actual host language switching and reload retention, browser fallback, unsupported locale, 404, malformed JSON and one/both locale timeouts.
- Existing maintenance browser regression passed again: five HUD viewports, drag/resize/disposal, keyboard/caret/paste/composition and four storage-dialog layouts with synthetic backup/apply.
- Independent spec/quality reviews passed. Final screenshots were inspected; translated controls stay in bounds without overlap.

Real-ST testing used a disposable program copy and separate data under ignored `test-results/real-st/`; the instance has been stopped. Daily ST data was not used or modified. Mobile evidence is browser emulation, not physical-phone acceptance. External preset thumbnails were blocked, so cloud-image availability was not validated.

## Next Actions

1. Integrate the reviewed branch into development main when ready. Development Git authentication must work before push verification.
2. Continue translations by App, then keyboard/focus/screen-reader work. The broad Phase 2/3 goals in the September 12 plan remain open.
3. Complete September 7 real-ST image migration/save/reload/restore, fault handling, standard ZIP import and physical-phone/OS-keyboard checks. This i18n run does not close them; see DEFERRED.md.
4. Perform a separately instructed independent release. Reconcile its README and copy the complete install manifest below; current three-way parity correctly fails against the untouched older release.

## Distribution Invariants

- Keep development name `st-stage` and new-install name `st-stage-ext`. Do not rewrite release history, rename/reuse the old name or graft development history into release history.
- Release clone: `D:\8.Project\0_0_维护\st-stage-ext`.
- Required release manifest is now **eight files**: `manifest.json`, `index.js`, `bundle.js`, `style.css`, `version.json`, `README.md`, `locales/zh-CN.json`, `locales/en-US.json`. This supersedes pre-i18n six-file instructions.
- Build with `pnpm build:all`. Compare the seven runtime files across root/distribution/release, and README only across distribution/release. Generated README comes from `st-extension/distribution-readme.md`, not the development README.
- Preserve release `.gitattributes` and history; pin locale JSON to LF when publishing. Never clear the release directory or copy source, tests, docs, public assets, private references or test user data into it.
- Publish development history before distribution history. This batch does not authorize live-user migration or settings operations.
