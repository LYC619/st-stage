---
status_version: 1
project: st-stage
base_branch: main
working_branch: codex/i18n-acceptance
verified_code_head: 76a262a058b26d6890cc2360f0bf54ba7cb0ea97
remote_code_head_at_update: null
remote_tracking_head: 1989c2fab99a28b8b204073bcb32f59b73800079
build_version: 0.9.0+202610062341
phase: i18n-deep-gallery-validated
updated_at: 2026-10-07
updated_by: codex
verification_source: codex-regression-and-isolated-real-st-1.18.0
history: docs/maintenance/history/2026-10-07-gallery.md
previous_history: docs/maintenance/history/2026-10-06-ui-focus.md
---

# Current Project Status

## Snapshot

- Code/build commit **76a262a** completes deep gallery translation, keyboard/focus and real-ST layout repairs on **codex/i18n-acceptance**, at `C:\Users\yicha\.codex\worktrees\i18n-acceptance\st-stage`. The broader autonomous i18n/a11y goal remains active. No merge or push was performed.
- Original development main remains at `25d62bd`, two commits ahead of local `origin/main`; the pre-existing untracked `tore style.css` is preserved. Actual development remote main could not be rechecked because Git authentication is required. The null remote-head field distinguishes this from a confirmed remote ref.
- Independent release `st-stage-ext` is still clean at `d6e8a892dbb7529a5b5fc8f53e4443e1bc33c03b` (local state rechecked October 6; actual remote last confirmed September 30). No release files were copied or pushed.
- Root and generated distribution runtime files, including both locale JSON files, match at **0.9.0+202610062341**. Manifest remains `0.9.0`; product name 百工 and persistent IDs/keys are unchanged.

## Delivered

- Locale assets resolve relative to the running bundle, supporting renamed installs and proxy prefixes. Language follows host `localStorage.language`, then browser language. The actual ST selector reloads the page; no separate preference was added.
- A three-second request/body deadline, dictionary validation, actual fallback logging, own-property lookup and `t(key, fallback, params)` interpolation make loading failures safe.
- Phone navigation, overlay buttons/placeholders, extension settings, Sprite and Gallery App names/settings/status/help and deep gallery controls support both languages. Both dictionaries contain **475 matching entries**; user data, prompt templates and protocol tokens retain their original content.
- Fixed actual-ST mobile gallery toolbar overflow and duplicate Enter handling from the host keyboard listener. Gear/close controls gained accessible labels and keyboard activation.
- `pnpm build:all` shares one timestamp between destinations. Locale output is LF-normalized/pinned. Parity checks include nested locale paths, exact case and escaping links. CI verifies required files are tracked before rebuilding.
- Shared App dialogs contain keyboard focus, handle only the topmost Escape and restore focus on close. Phone keyboard entry/navigation and semantic remount focus preservation are implemented. Dynamic field insertion cannot transfer focus into a differently labelled input.
- Shared controls have labels, slider values, Help relationships and visible keyboard focus. The real-ST select label no longer includes every option. Gallery rejects auto-upload without an API key while retaining the live status message and checkbox focus.
- CI validates locale keys/placeholders, source references, Chinese fallbacks and static parameter objects. Dynamic expressions that cannot be verified are rejected. Keyboard coverage and remaining gaps are documented in `docs/ACCESSIBILITY.md`.

- Gallery filters, metadata, tags, batch actions, image/upload previews, storage migration UI and relevant import/persistence/backup errors are translated. Cards support arrow/Home/End/activation; menus expose their relationships and return focus. Same-name enable checkboxes use pack IDs for focus, and returning to the list restores the original card.
- Manager, tag/upload preview, lightbox and storage dialogs adopt the shared focus lifecycle. Visual stacking follows the active keyboard layer; underlying image navigation is suspended. The copy fallback selects text inside the current modal, cleans up and restores focus.
- Real-ST mobile repairs give storage its viewport height despite the host's transformed zero-height root, override narrow host button sizing and place upload-preview labels above their fields.

Export, MVU, New Variables/designer and remaining common tool labels still need translation and focused accessibility work. This is not a claim of comprehensive screen-reader or WCAG conformance.

## Fresh Verification

- **97 Vitest files / 1284 tests passed**; TypeScript, ESLint and staged whitespace checks passed.
- Default Next.js 16.2.6/Turbopack production build, both extension builds and local runtime/locale parity passed.
- **Real ST 1.18.0 / Edge 143.0.3650.80: 10/10 i18n scenarios plus 4/4 deep-gallery layouts passed**, zero page JavaScript errors. Gallery covers synthetic pack create/JSON import, filters, metadata, tags, card navigation, lightbox, upload-preview cancellation, storage, nested Escape and return to the Gallery App. Earlier language-loading/switching/failure and App checks remain passing.
- **9/9 native Edge scenarios passed**, including full-CSS nested hit tests and a transformed-root mobile regression for storage height/button sizing in portrait/landscape. Existing radio/contenteditable/phone checks remain passing. Completeness gate passes **475 keys / 527 source references**.
- Existing maintenance browser regression passed again: five HUD viewports, drag/resize/disposal, keyboard/caret/paste/composition and four storage-dialog layouts with synthetic backup/apply.
- Independent manager/focus and CSS reviews passed after reproducible issues were repaired. Final desktop/mobile screenshots were inspected; storage buttons and upload-preview fields remain usable.

Real-ST testing used a disposable program copy and separate data under ignored `test-results/real-st/`; the loopback instance is retained at port 18769 for the next batch. Daily ST data was not used or modified. Mobile evidence is browser emulation, not physical-phone acceptance. External preset thumbnails were blocked and copied-runtime thumbnail dependency warnings remain, so cloud-image availability/conversion was not validated.

## Next Actions

1. Continue Export, MVU, New Variables/designer and remaining shared HUD/common labels. The broad Phase 2/3 goals in the September 12 plan remain open.
2. Integrate the reviewed branch into development main when ready. Development Git authentication must work before push verification.
3. Complete September 7 real-ST image migration/save/reload/restore, fault handling, standard ZIP import and physical-phone/OS-keyboard checks. This i18n run does not close them; see DEFERRED.md.
4. Perform a separately instructed independent release. Reconcile its README and copy the complete install manifest below; current three-way parity correctly fails against the untouched older release.

## Distribution Invariants

- Keep development name `st-stage` and new-install name `st-stage-ext`. Do not rewrite release history, rename/reuse the old name or graft development history into release history.
- Release clone: `D:\8.Project\0_0_维护\st-stage-ext`.
- Required release manifest is now **eight files**: `manifest.json`, `index.js`, `bundle.js`, `style.css`, `version.json`, `README.md`, `locales/zh-CN.json`, `locales/en-US.json`. This supersedes pre-i18n six-file instructions.
- Build with `pnpm build:all`. Compare the seven runtime files across root/distribution/release, and README only across distribution/release. Generated README comes from `st-extension/distribution-readme.md`, not the development README.
- Preserve release `.gitattributes` and history; pin locale JSON to LF when publishing. Never clear the release directory or copy source, tests, docs, public assets, private references or test user data into it.
- Publish development history before distribution history. This batch does not authorize live-user migration or settings operations.
