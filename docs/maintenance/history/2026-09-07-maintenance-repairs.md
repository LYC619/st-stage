# 2026-09-07 Maintenance Repairs

## Commit And Push Follow-Up

- After the implementation checkpoint below, the user explicitly requested commit and push. Commit `81b4286bb68c6f42badc5ca52b39ac1fbf79c72e` (`fix: harden image persistence and maintenance workflows`) contains 47 code/test/plan/build files and was pushed normally from development main to origin/main. No merge or force push occurred.
- Commit-time rerun: 89 files / 1172 tests passed in 147.09 seconds; `tsc --noEmit --incremental false`, ESLint and staged `git diff --check` passed. Root/distribution five-file parity and the recorded build hashes are unchanged.
- This push delivers root compatibility artifacts to the legacy `st-stage` installation channel. The independent `st-stage-ext` repository was not copied to, committed or pushed; its four recorded parity differences remain. Real-ST/physical-phone acceptance is still pending.
- This maintenance-only follow-up records the actual fixing code head and committed status. Review snapshots, CURRENT and DEFERRED accompany it. The only excluded pre-existing file is `tore style.css`; no private runtime data or ignored test artifacts are staged.
- CURRENT's remote-code head records the fixing commit observed on remote main before this documentation-only follow-up. Later maintenance-only descendants do not change the verified code baseline.

## Pre-Commit Scope And Git State

- Implemented the authorized R1-R8 + S1 plan serially with one agent. No subagents, dependency installation, live-user settings operations, commits, merges, release copies or pushes.
- Development HEAD/tracking/actual remote main: `a942d5708e5cdb32921709d11d401985b3dddbe3`. The protocol ancestry and committed-product-diff checks both exited zero. All repairs below are uncommitted; this hash identifies their baseline, not a fixing commit.
- Release clone HEAD/tracking/actual remote main: `d6e8a892dbb7529a5b5fc8f53e4443e1bc33c03b`. Its worktree remains clean. `.gitattributes` SHA-256: `b0872ccc5fefe5c174d027320fdcc1f42344f70a88296374abaaf1b3176f4d30`.
- The pre-existing untracked `tore style.css` is preserved. Only five task-generated root `.planning-*.log` files were removed; browser artifacts remain ignored under `test-results/maintenance-browser/`.
- The September 5 review, plan handoff and pre-review status snapshot remain historical evidence. The master plan now records execution progress. Older unrelated DEFERRED items were not included in this authorization.

## Implemented Repairs

| IDs | Implementation and evidence |
| --- | --- |
| R1/R3/R5 | `image-persistence.ts` writes a new securely random 128-bit file identity under `sprite_overlay`, rejects missing capabilities and malformed data, enforces a decoded 20 MiB limit and 30-second abort timeout, validates the exact response path and reads back exact bytes. No ST base64 fallback. Upload/localize/replace callers reject false-success URLs and skip references edited while requests were outstanding. |
| R4 | Settings migration, JSON import/export and preset overrides preserve normalized `inventoryPrompt`, including explicit clearing. Adapter save/load and pack round-trip tests cover the boundaries. |
| R2 | Chat folders derive from PNG avatar identity, not display names. Path segments are validated instead of silently renamed. ZIP preflight rejects duplicates, normalized/case collisions and file/directory collisions. Real JSZip generate/load verifies both same-display-name characters and their separate chat bytes survive. |
| R8 | Search input and its ancestors are mounted once; results/tabs/footer update around it. Composition events delay filtering until commit. Browser keyboard/caret/paste/IME assertions cover actual input behavior. |
| R6 | Geometry uses the full HUD root. Window and visual viewport events coalesce into one measurement; content/error growth triggers remeasurement. Disposal is idempotent and cancels frames, resize subscriptions, active drag handlers and late asynchronous rendering. |
| R7 | Root and generated distribution were rebuilt at the same new stamp and all five runtime files match. The read-only parity checker now also checks release runtime files and distribution README, reports all differences, rejects wrong case/non-files and real-path escapes. Eight synthetic-fixture tests do not depend on the workspace's artifact state. |
| S1 | Schema-specific scanning, task-local URI deduplication, serial upload staging, backup/receipt confirmation and compare-before-apply. JSON/share imports install only after complete preparation; closing/reopening a manager cannot start a late upload. Import and migration cannot run together. Large JSON confirmation uses `File.size`; import progress is reported. |

### Migration Safety

- Migration is explicit, not performed on startup or settings load. WebAdapter's intentional embedded-image behavior is unchanged.
- Backups are immutable JSON snapshots of current plugin state, excluding generated presets but preserving opaque App state. Raw embedded values that cannot be mapped by both reference and source bytes are kept in a backup appendix and block automatic migration.
- Raw mapping is rechecked before staging and before applying/restoring. Partial successes remain in memory until backup and receipt downloads are explicitly confirmed. Failure/cancellation does not replace old URLs; conflicting edits/deletions are skipped.
- Backup parsing validates format/version, required fields, duplicates and lossless preservation under the existing settings migration. It permits added derived fields such as image codes, but never silently accepts discarded/changed backup data. Receipts must match the backup ID and image identities and contain safe local paths.
- Restore requires a fresh current-state backup and only reverses unchanged migrated image references. It preserves current App data, metadata and later image edits. It intentionally increases settings size again; the dialog warns about that.
- Downloads revoke their Blob URLs and timers on close; cancelled/closed asynchronous operations ignore late results. Backups can contain private prompts/API keys and are labelled accordingly. No private data or data URIs are logged in maintenance records.
- No orphan-file cleanup is attempted. Uploaded-but-unapplied files may remain. `saveSettingsDebounced(): void` has no server-save acknowledgement, so the UI requests a reload check rather than promising an atomic disk transaction.

## Fresh Automated Evidence

Final gates on 2026-09-07, using existing `node_modules` because `rtk` is unavailable:

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism --reporter=dot --silent=passed-only
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js core st-extension/src lib components app
node node_modules/next/dist/bin/next build
node --check scripts/verify-maintenance-browser.mjs
node --check scripts/verify-runtime-parity.mjs
git -c core.safecrlf=false diff --check
```

- Final Vitest: **89 files / 1172 tests passed**, 175.52 seconds. The earlier 1168-test pass predates four added image-boundary cases and is not the final count.
- tsc, lint, both script syntax checks and diff check: exit 0. Next 16.2.6 production build: exit 0, `/` and `/_not-found` statically generated.
- `image-storage-integration.test.ts` creates two 16 MiB embedded strings, confirms serialized plugin state exceeds 30 MiB, stages/applies through production helpers, round-trips STAdapter state through JSON, verifies the result is below 10 KiB, restores exact images/metadata, and migrates again. App data remains unchanged. This is a synthetic in-memory host simulation, not measurement of a real ST settings file.
- Dedicated regressions reproduced late file-read uploads, import/migration overlap, newly unmapped raw values, incomplete backup acceptance, HUD resource leaks/measurement gaps and parity-check omissions before their fixes. The final lint pass followed replacement of a disallowed control-character regex by an equivalent character-code check.

## Browser Evidence

Reproduction: `node scripts/verify-maintenance-browser.mjs`. It bundles production modules in memory and uses one isolated headless system Edge session with synthetic data and intercepted network requests. No Next server or live ST is required.

- Edge `143.0.3650.80`: passed. HUD viewports: 375x667, 360x740, 390x844, 844x390, 1366x900. Full panel/close-button geometry is checked, followed by content growth, scrollable content, real mouse dragging, rotation, visual-viewport events, close and disposed late-read checks.
- Critical regression: 375x667 saved-open state (331,623) produces panel `(left=93, top=285, width=282, height=382)`, right/bottom exactly 375/667. Close-button right edge is 364, not the old off-screen 602.
- Search: real sequential keyboard input, middle insertion, backspace and clipboard paste preserve input identity/focus/caret. CDP `Input.imeSetComposition`/`Input.insertText` generate browser-native composition start/update/end; filtering waits for commit. This is not physical OS-IME acceptance.
- Storage dialog: four viewport layouts, no horizontal overflow, reachable close control, actual synthetic backup/receipt downloads and explicit apply. Screenshots were visually inspected, with no clipping or incoherent overlaps. The fixture does not include the live ST host theme.
- Ignored evidence: `test-results/maintenance-browser/results.json`, screenshots, trace ZIP and synthetic downloads. The tracked harness is the reproducible artifact, not these local outputs.

## Build And Distribution

Both builds called `buildExtension` with `ST_STAGE_BUILD_TIME='2026-09-07 21:09'` (Asia/Shanghai), first at root and then with `outputRoot: 'st-distribution'`. Result: `0.9.0+202609072109`; manifest semantic version remains `0.9.0`.

| File | Root/distribution bytes | Root/distribution SHA-256 |
| --- | ---: | --- |
| manifest.json | 256 | `4dfa85a871de9351647bb3d3bb4c18d69bd6007abfd735d02e877d0de8b3d12e` |
| index.js | 1915 | `27db248504a6ee1fec948c3c6135f93732c0b075a0803317b82c972bcfcf457d` |
| bundle.js | 877063 | `d64074e8421631a682e07bd3b46b4e5016ae8b24b4e211fbff61af1502b7baf6` |
| style.css | 86985 | `ee93d32795bc031bad679adaebf7c440712a56d091ba6cfca9ec357a39f0babb` |
| version.json | 27 | `6680745e2185ad6fb01c5c1a42a76e5d0d2fad9098139ee918476f81ecdfd2f5` |

Read-only command:

```powershell
node scripts/verify-runtime-parity.mjs --root . --distribution st-distribution --release D:/8.Project/0_0_维护/st-stage-ext
```

It exits **1**, as the release clone was not updated. Runtime mismatches are `bundle.js` (release 834414 bytes), `style.css` (85162 bytes), and `version.json`; manifest/stub still match. Distribution README is 1250 bytes with SHA-256 `83041f395050b9b41c915221177aa9ea33433321b79c719994554f36734d5f3f`; release README is 17555 bytes with SHA-256 `b41b59a4d8d3643376919a7714c8926fd126f40a954f1033e90c025c2df2821d`. Reconcile README content before any authorized copy; do not silently overwrite it just to make parity pass. Development root README is intentionally not compared.

## Outstanding Acceptance And Handoff

1. Run an isolated real-ST large-settings workflow: backup/download, stage/apply, host-save and page reload, inspect actual disk size and image/GIF readability, receipt restore, remigration, and 413/offline/cancellation/concurrent-edit failures. Record host version. The existing API source evidence targets ST 1.18.0, not all host versions.
2. Import the generated same-display-name character ZIP into real ST and verify both cards and chats. JSZip round trips are necessary but not sufficient for importer compatibility.
3. Check HUD, search and migration/restore controls on a physical phone with its OS keyboard and live host theme. Synthetic Edge viewports are not a substitute.
4. Development commit/push authorization has now been executed as recorded above; CURRENT and DEFERRED identify fixing commit `81b4286`. The unrelated CSS remains untracked.
5. Independent release synchronization still requires separate instruction. After acceptance and authorization, synchronize exactly the six allowed release files, preserve release `.gitattributes`, re-run three-way parity and commit the distribution history after the already-pushed development history. No release-ready claim is made by this record.
