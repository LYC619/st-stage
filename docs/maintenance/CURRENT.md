---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: 81b4286bb68c6f42badc5ca52b39ac1fbf79c72e
remote_code_head_at_update: 81b4286bb68c6f42badc5ca52b39ac1fbf79c72e
build_version: 0.9.0+202609072109
phase: development-pushed-acceptance-pending
updated_at: 2026-09-07
updated_by: codex
verification_source: codex-single-agent-maintenance-repairs-2026-09-07
history: docs/maintenance/history/2026-09-07-maintenance-repairs.md
---

# Current Project Status

## Snapshot

- The user authorized R1-R8 + S1 implementation and subsequently requested commit/push on September 7. Code, tests, plans and matching runtime artifacts are committed and pushed as **`81b4286bb68c6f42badc5ca52b39ac1fbf79c72e`**. Real-ST and physical-phone acceptance remains pending, not implicitly passed by publication.
- The fixing code commit was verified on actual remote `main`; this maintenance-only follow-up may be a descendant. `verified_code_head` now identifies the actual code/build commit rather than baseline `a942d57`. Both protocol staleness checks must still pass at the next handoff.
- Distribution `st-stage-ext` local/tracking/actual remote `main` remain `d6e8a892dbb7529a5b5fc8f53e4443e1bc33c03b`, with a clean worktree. No release files were copied or changed.
- Root and `st-distribution` were rebuilt at `2026-09-07 21:09` (Asia/Shanghai), version `0.9.0+202609072109`; `manifest.json` remains `0.9.0`. The product is 百工; machine IDs and persistent keys stay unchanged.
- Single agent, existing dependencies, no installation or live-user settings operations. Development `main` was pushed without a merge or force push. This updates the legacy `st-stage` installation channel; `st-stage-ext` was not synchronized. The pre-existing untracked `tore style.css` is preserved and excluded from all commits.
- The review of 37 commits from `af1fa37` to `a942d57`, old acceptance queues and original repair plans remain in September 5 history and `docs/superpowers/plans/`. The master repair plan now has an execution-status section; old authorization statements in the original subplans are historical.

## Committed Repairs

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

## Fresh Verification

- Commit-time Vitest rerun: **89 files / 1172 tests passed**, one worker, no file parallelism, 147.09 seconds. Includes 32 MiB synthetic settings save/reload/restore/remigration, without rewriting App data. TypeScript and ESLint also passed again before the commit.
- TypeScript, ESLint, Next production build, both extension builds, script syntax and `git diff --check`: passed.
- `node scripts/verify-maintenance-browser.mjs`: passed on isolated headless Edge 143.0.3650.80. Five HUD viewports, content growth, drag/rotation/disposal, real keyboard/caret/clipboard and browser-native composition through CDP, four storage-dialog layouts and synthetic backup/receipt/apply flow. Screenshots inspected, no clipping/overlap in these fixtures.
- At 375x667, saved-open HUD at (331,623) becomes a 282x382 panel at (93,285); panel right/bottom are 375/667, close-button right is 364.
- Root/distribution five-file byte parity: passed. Three-way checker exits **1** because the untouched release clone differs in `bundle.js`, `style.css`, `version.json` and distribution README. This is not a passed release gate.
- Both actual remote main refs were rechecked with read-only `git ls-remote`; release worktree and `.gitattributes` remain unchanged.
- Browser evidence is synthetic and has no live ST host theme or physical device. Screenshots/traces/results are ignored under `test-results/maintenance-browser/`; the harness source is in `scripts/`.

## Next Actions

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
