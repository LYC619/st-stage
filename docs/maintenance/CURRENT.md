---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: 26a40d8c142eae9bd17dc5cc59efe5f682e090c7
remote_code_head_at_update: 81b4286bb68c6f42badc5ca52b39ac1fbf79c72e
build_version: 0.9.0+202609121809
phase: development-i18n-foundation-complete
updated_at: 2026-09-12
updated_by: opus-5
verification_source: opus-5-single-agent-i18n-foundation-2026-09-12
history: docs/maintenance/history/2026-09-12-i18n-foundation.md
previous_history: docs/maintenance/history/2026-09-07-maintenance-repairs.md
---

# Current Project Status

## Snapshot

- **Latest committed work:** i18n foundation implemented and committed as **`26a40d8c142eae9bd17dc5cc59efe5f682e090c7`** on 2026-09-12. This adds core i18n system, locale loading, 17 tests, and build integration. Not yet pushed to remote.
- **Previous maintenance repairs:** R1-R8 + S1 committed and pushed as `81b4286` on September 7. Real-ST and physical-phone acceptance remains pending.
- Distribution `st-stage-ext` local/tracking/actual remote `main` remain `d6e8a892dbb7529a5b5fc8f53e4443e1bc33c03b`, with a clean worktree. No release files were copied or changed.
- Root and `st-distribution` were rebuilt at `2026-09-12 18:09` (Asia/Shanghai), version `0.9.0+202609121809`; `manifest.json` remains `0.9.0`. The product is 百工; machine IDs and persistent keys stay unchanged.
- Single agent (Opus 5), existing dependencies, no installation or live-user settings operations. Development `main` has one unpushed commit. The pre-existing untracked `tore style.css` is preserved and excluded from all commits.
- September 5 review and repair plans remain in `docs/superpowers/plans/` and `history/`. September 7 repairs are in `history/2026-09-07-maintenance-repairs.md`. Current i18n work is in `history/2026-09-12-i18n-foundation.md`.

## Committed Work

### September 7 Repairs (81b4286)

Evidence, commit/push follow-up and remaining release checks are in `history/2026-09-07-maintenance-repairs.md`. DEFERRED records the fixing commit while retaining outstanding acceptance and independent-distribution checks.

| ID | Priority | Implementation in 81b4286 |
| --- | --- | --- |
| R1 | P1 | Each image write uses a new 128-bit random filename; callers protect references edited during upload. |
| R2 | P1 | Chat paths derive from avatar identity; unsafe, duplicate and file/directory-colliding ZIP paths are rejected before download. |
| R3 | P1 | Upload errors reject without base64 fallback; POST and exact byte readback must succeed, with cancellation, timeout and 20 MiB limit. |
| R4 | P2 | `inventoryPrompt` survives settings/JSON round trips and preset override clearing. |
| R5 | P2 | Optional request-header capability is guarded; TypeScript passes. |
| R6 | P2 | Full HUD bounds are clamped; resize measurement is coalesced and drag/frame/subscription resources are released. |
| R7 | P2 | Root and generated distribution runtime files match. Release-clone parity remains pending publication. |
| R8 | P2 | Persistent search input preserves focus/caret and browser composition lifecycle. |

**S1:** The gallery has an explicit backup-first, staged image migration and receipt-based selective restore. JSON/share imports pass through complete image preparation before installation. Closing/cancelling does not apply staged results; unmapped raw embedded values block automatic writes. Apps stay unchanged and orphan files are never automatically deleted. Updating alone still does not shrink old settings: migration is opt-in. Host settings-save acknowledgement requires a real reload check.

### September 12 i18n Foundation (26a40d8)

Full details in `history/2026-09-12-i18n-foundation.md`. Not yet pushed to remote.

- **Core system:** Nested key path access, parameter substitution, locale switching, missing key fallback
- **Locale files:** zh-CN and en-US with common/sprite/phone/settings namespaces (36 entries each)
- **Platform integration:** Async locale loading from `/locales/`, fallback to zh-CN on fetch errors
- **Build integration:** Locale files copied to output root and `st-distribution`
- **Testing:** 17 new tests covering all core functionality
- **Tests now:** 90 files / 1189 tests (up from 1172)

## Current Verification (26a40d8)

- **Test results:** 90 files / 1189 tests passed, ~12 seconds
- **Quality gates:** TypeScript, ESLint, `git diff --check` all passed
- **Builds:** Extension and distribution builds successful
- **Artifacts:** Root and `st-distribution` have matching runtime files and locale directories
- **Build timestamp:** `0.9.0+202609121809`
- **Not yet tested:** Real ST locale detection, browser locale loading, physical device display

## Previous Verification (81b4286 - September 7)

- Commit-time Vitest rerun: **89 files / 1172 tests passed**, one worker, no file parallelism, 147.09 seconds. Includes 32 MiB synthetic settings save/reload/restore/remigration, without rewriting App data. TypeScript and ESLint also passed again before the commit.
- TypeScript, ESLint, Next production build, both extension builds, script syntax and `git diff --check`: passed.
- `node scripts/verify-maintenance-browser.mjs`: passed on isolated headless Edge 143.0.3650.80. Five HUD viewports, content growth, drag/rotation/disposal, real keyboard/caret/clipboard and browser-native composition through CDP, four storage-dialog layouts and synthetic backup/receipt/apply flow. Screenshots inspected, no clipping/overlap in these fixtures.
- At 375x667, saved-open HUD at (331,623) becomes a 282x382 panel at (93,285); panel right/bottom are 375/667, close-button right is 364.
- Root/distribution five-file byte parity: passed. Three-way checker exits **1** because the untouched release clone differs in `bundle.js`, `style.css`, `version.json` and distribution README. This is not a passed release gate.
- Both actual remote main refs were rechecked with read-only `git ls-remote`; release worktree and `.gitattributes` remain unchanged.
- Browser evidence is synthetic and has no live ST host theme or physical device. Screenshots/traces/results are ignored under `test-results/maintenance-browser/`; the harness source is in `scripts/`.

## Next Actions

### For September 12 i18n Work (26a40d8)
1. **Real ST validation:** Test locale detection from actual `STContext.getLocale()`, verify fetch paths resolve correctly, confirm language switching persists
2. **UI integration (Phase 2):** Migrate sprite overlay, manager dialog, phone shell to use `t()` function
3. **Accessibility (Phase 3):** Add ARIA labels, focus management, screen reader announcements, keyboard navigation

### For September 7 Repairs (81b4286)
1. In an isolated real-ST user directory, verify large synthetic settings migration, server-save/reload, readable images/GIF bytes, receipt restore/remigration, and 413/offline/cancel/conflict handling. No live-user migration is authorized.
2. Import the generated same-display-name character ZIP in real ST and check both avatar/chat identities. Exercise HUD/search/storage controls on a physical phone and its OS keyboard.
3. Development commit/push is complete. Independent `st-stage-ext` synchronization and push still require a separate release instruction; do not treat the current authorization as permission to operate live-user data.
4. Before that independent distribution release, reconcile the differing README, perform the six-file release sync, rerun the three-way parity checker, and record the release commit alongside fixing code commit `81b4286`. Historical unrelated DEFERRED items remain outside this repair scope.

## Distribution Invariants

- Keep development repository name `st-stage`; new installs use `st-stage-ext`. Do not rename/reuse the old name, rewrite published distribution history, or graft development history into the distribution repository.
- Distribution clone: `D:\8.Project\0_0_维护\st-stage-ext`. Its six root files are `manifest.json`, `index.js`, `bundle.js`, `style.css`, `version.json`, and `README.md`. The generated README comes from `st-extension/distribution-readme.md`; it intentionally differs from the development root README.
- Build root compatibility outputs and `st-distribution/` at the same new stamp. Compare the five runtime files between root, distribution output, and release clone; compare the generated README only between distribution output and release clone. Preserve the clone's own `.gitattributes` and LF pins; never clear the release directory before copying.
- Never copy source, tests, `docs/`, `public/`, or private `reference/` data to the distribution repository.
- The development code/build commit is now pushed. A later authorized independent release must copy exactly the six files to the distribution clone, verify hashes, and commit there. Publish development history before distribution history. No distribution-clone copy/push was performed; automation remains deferred.
