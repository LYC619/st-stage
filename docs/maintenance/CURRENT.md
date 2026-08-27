---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: d9852e9
remote_code_head_at_update: af1fa37
build_version: 0.9.0+202608272259
phase: cloud-export-review-fixes-awaiting-real-st-integration
updated_at: 2026-08-27T21:50:00+08:00
updated_by: claude-code
verification_source: claude-code-cloud-export-review-2026-08-27
history: docs/maintenance/history/2026-08-27-cloud-export-review-fixes.md
---

# Current Project Status

## Snapshot

- Fifth-round fixes are represented by code/build commit `69066357f025b56ebac482384b592802ddd156e8`, fast-forwarded to `main` and pushed to `origin/main` after the maintenance handoff.
- Cloud Export registration, lazy loading, batch selection, bounded-concurrency export, and standard backup artifacts are represented by code/build commit `116103a`; real ST/STE acceptance remains pending.
- The paired STE ZIP input implementation is tracked in the sibling repository at `f874b55`; it extracts into a temporary authorized root and reuses the existing ST scan/selection/import flow without persisting `stRoot`.
- Product version remains `0.9.0`; the cache-busting build stamp is `0.9.0+202608271324`.
- This round addresses phone click-through, variable-toggle feedback, gallery stack/filter/tag management, opt-in baked-checkerboard cleanup, readable Butler comparisons, and system-extension guidance.
- Automated gates are complete. The 16 real SillyTavern checks below remain manual and are not claimed as passed.
- API management was not changed. OpenAI-compatible quick switching remains the supported common-channel baseline.

## Delivered Scope

### Runtime And Variable Feedback

- The phone shell stops `pointerdown`, `touchstart`, and `click` propagation at its own boundary without preventing control defaults. Tapping a phone checkbox or button no longer also activates a Gal/chat control behind it.
- Changing the variable-visibility setting still schedules immediate message reprocessing. The New Variable app now confirms whether st-stage hid or restored its own snapshot.
- The restore notice explicitly distinguishes st-stage from SillyTavern Regex: if an external Regex rule already deleted `<UpdateVariable>`, st-stage cannot reconstruct that externally removed DOM.
- Existing source-evidence, ambiguity protection, edit recovery, multi-Renderer-block handling, Gal portrait fallback, and Cards review-before-send behavior remain unchanged.

### Gallery Management And Images

- Collapsed multi-pack role stacks use a normal grid cell; only an expanded stack spans the gallery width. Single-pack roles remain ordinary cards.
- Gallery search covers pack name, role, outfit, and custom tags. Role, pack type, and custom-tag filters can be combined; bulk "select all" affects only the current filtered result.
- Tag management can add, globally rename, and globally delete custom tags. Role and type remain derived, read-only dimensions. Preset metadata persists through the existing override path.
- Bulk checkboxes now render above active/preset/resource badges.
- A conservative edge-connected pixel detector recognizes only evidenced light-grey baked checkerboards. It refuses ordinary opaque images, already transparent images, unsupported evidence, and regions too small to establish confidence.
- Image details expose an explicit "detect and remove checkerboard" action. Merely opening the gallery or preview does not download or alter images. Successful cleanup is exported as a transparent PNG to the SillyTavern user-image directory.
- Preset cleanup/localization updates the same pack and sprite identity, retains the remote fallback URL, and does not create another local-copy pack. Cancellation or failure changes neither files nor settings.

### Butler Reports And Extension Guidance

- Before/after reports use eight fixed Chinese metrics: web-page memory, DOM nodes, messages, media items, six-second long tasks, longest stall, 95th-percentile frame interval, and timer delay.
- Each metric shows before, after, change, and a plain-language explanation. Non-comparable captures say that no comparison is calculated; raw JSON is available only in a collapsed advanced section.
- The report states that browser garbage collection and caches can move memory in either direction, so memory alone does not prove that an optimization worked.
- The system-extension advisor covers Expressions, Gallery, Memory, Quick Reply, Regex, Stable Diffusion, Translate, TTS, and Vectors with purpose, when needed, loss when disabled, and a conservative recommendation.
- System extensions are advisory and read-only. Unknown system extensions receive no invented performance claim.
- Third-party extension isolation still uses SillyTavern's official disabled list, refresh, restore, and staged troubleshooting flow. st-stage remains protected from selecting itself.

## Recorded Verification

Current artifact hashes belong to the review-fix batch described under "Review Fixes" below. Earlier rounds' hashes stay in their dated `history/` records rather than here, so this section always matches the artifacts currently in the worktree.

Evidence for the current build stamp `0.9.0+202608272259`:

- Vitest `4.1.10`: 78 files, 937/937 passed.
- TypeScript typecheck and full ESLint: passed.
- Next.js `16.2.6` production build: compiled successfully.
- `git diff --check`: passed.
- Note: `st-extension/build.test.ts > makes the artifact diff fail after a source change and rebuild` failed once when the full suite ran concurrently with the Next build, and passed both in isolation and on a clean full re-run. That test spawns `git` subprocesses and is sensitive to machine load; the failure was contention, not a regression. It is pre-existing behaviour, not introduced by this batch.
- Root artifacts and `st-distribution/` were rebuilt twice with the fixed build stamp and remained byte-identical. Shared SHA-256 hashes:
  - `index.js`: `D0E60A1B546D223922A7FBF01231B79205874963BDFFE4C963BD081347C9B849`
  - `bundle.js`: `BC8EB12700350EFA692525622C2EFE4F7B6BB9E0A24791E455FB612B2B61A363`
  - `style.css`: `D80B3E4E6FF1F34B014746A7E5311B7E3AAF3B36DE1A1C58EA06073CA7E76971`
  - `version.json`: `7D0BF16FC852F72C9C9E0662B6E4F212C8BCEC92DC7B2972D4287FFD6733C457`
- Artifact hashes are now reproducible on any checkout: the build normalizes generated files to LF and `.gitattributes` pins the release artifacts to `eol=lf`. Re-hashing a fresh checkout reproduces the values above.
- `st-distribution/` contains exactly `bundle.js`, `index.js`, `manifest.json`, `README.md`, `style.css`, and `version.json`; it contains no images, `public/`, `reference/`, or preset source.

Prior round-five evidence (Playwright `25/25`, frozen pnpm install, Next.js production build) is recorded in `docs/maintenance/history/` and was not re-run for this review batch.

These are automated and source-review results only. The real-ST items below remain manual evidence.

## Cloud Export Integration

- `st-extension/src/apps/cloud-export/` is registered as the built-in `导出` App and exports PNG character cards, per-character chats, worlds, OpenAI Settings presets, and the global regex set into `default-user`-compatible ZIP paths.
- It supports type tabs, search, current-filter select-all, nested chat selection, counters, progress, and browser download. It excludes groups/group chats, Persona, attachments, other backend presets, themes, quick replies, and vector indexes in v1.
- The bridge was checked against the local SillyTavern 1.18.0 source for `/api/characters/all`, `/api/characters/chats`, `/api/chats/get`, `/api/worldinfo/list`, `/api/worldinfo/get`, `/api/settings/get`, and `/api/characters/export`.
- `settings.json` now uses ST's `extension_settings.regex` field, and chat reads include the official `ch_name` request field.
- Focused automated evidence for code head `f1d037b`: Vitest 4 files / 24 tests, TypeScript, changed-source ESLint, extension build, and `git diff --check` passed. The build fixture tests passed outside the sandbox because they use a `C:\Users` temporary directory.
- Real SillyTavern registration and ZIP import through the STE client remain manual acceptance items.

## Cloud Export Standard Backup Follow-up

- App startup now loads only the character list. Chats, worldbooks, settings assets, and export bodies are requested only when their category or selected asset requires them.
- Batch actions include current-filter select all, invert, clear, per-character character-with-all-chats, and all-visible-characters-with-chats.
- Selected bodies load with at most four concurrent requests. Any failed asset aborts the export before browser download and reports the asset name.
- The one downloaded archive is named `default-user-YYYYMMDD-HHmmss.zip`; standard paths live directly at the ZIP root without an extra wrapper directory.
- Current automated evidence: Cloud Export 5 files / 17 tests, full Vitest 78 files / 928 tests, TypeScript, ESLint, fixed-stamp root/distribution build, matching shared artifact hashes, and six-file distribution boundary passed.

## Review Fixes

A code review of the Butler 2.0 and Cloud Export batches produced four fixes. They are source changes only; the review's remaining findings are recorded in `DEFERRED.md`.

- `settings.json` is now written only when regex rules or worldbooks are actually selected, and empty keys are omitted entirely. Previously any selection emitted `settings.json` carrying `extension_settings.regex: []` and an empty `globalSelect`; because the archive is named `default-user-*.zip` and uses `default-user` root paths, a user unpacking it straight into `data/default-user/` would have cleared their real global regex and world selection. STE's own import path was never affected.
- The download blob URL is released on a delay instead of synchronously after `anchor.click()`, and the anchor is attached to the document before the click. The previous synchronous `revokeObjectURL` could abort a large archive download before the browser took over the blob. The delay is injectable so the regression test does not have to fake global timers, which would deadlock JSZip.
- The build normalizes generated artifacts to LF. Concatenated CSS previously inherited CRLF from an `autocrlf` checkout while the join used `\n`, producing a mixed-ending file whose bytes — and therefore recorded SHA-256 — depended on how the repository was cloned. `style.css` also showed as permanently modified, so the protocol's clean-worktree requirement could not be met.
- `.gitattributes` pins the release artifacts to `eol=lf`. It intentionally scopes to generated files rather than declaring `* text=auto`, which would renormalize the whole repository.
- Deselecting a character now also clears that character's selected chats, in both the checkbox and the invert action. Previously only the character ID was removed, so the archive could contain `chats/<name>/*.jsonl` with no matching `characters/<avatar>.png` while the counter read "0 characters, N chats". Selecting a chat still auto-adds its character, so the two directions are now symmetric.
- `pre-release-cargo-target/` was deleted and added to `.gitignore`. It was STE Rust build output, roughly 7 GB, that did not belong to this repository.

## Next Real SillyTavern Acceptance

### Runtime And Renderer

1. After this local batch is pushed, update the extension and confirm the settings page shows `0.9.0+202608271324`; switch chat/character once and confirm prompt injection still self-heals.
2. Open the phone over a clickable Gal panel or chat control, tap phone checkboxes/buttons, and confirm only the phone control activates.
3. With a real reply containing `<UpdateVariable>`, enable hiding and confirm the payload disappears; disable it and confirm st-stage restores the payload immediately or after the scheduled reprocess without requiring message edit mode.
4. Separately enable a SillyTavern Regex rule that deletes the same block. Confirm the st-stage notice explains why disabling its own hide setting cannot restore content already removed by Regex; disable the external rule and reprocess to recover it.
5. Edit/save and edit/cancel existing AI messages containing sprites and multiple Renderer blocks. Confirm each valid block remounts, invalid text stays visible, and leaving edit mode does not permanently disable rendering.
6. Confirm Gal without an explicit portrait uses the exact enabled-role pack cover, explicit portrait still wins, and Cards still inserts only the selected action into the composer without auto-sending or generating hidden branches.

### Gallery And Images

7. Confirm a one-pack role is an ordinary grid card; a multi-pack role is a compact layered card with a visible count, and only expands to a full-width horizontal row after clicking it.
8. Search separately by pack name, role, outfit, and custom tag; clear the query and confirm original ordering returns.
9. Combine role, type, and custom-tag filters and confirm dimensions intersect. Enter bulk mode and confirm "select all" selects only visible filtered packs.
10. Add a custom tag, globally rename it, and globally delete it. Reload SillyTavern and confirm metadata persists, including on an edited preset override.
11. In bulk mode, verify the checkbox remains clickable above "in use", preset, local/cloud, and long-label badges on desktop and mobile.
12. From image details, test one known baked checkerboard, one normal opaque image, and one real transparent PNG. Confirm only the evidenced checkerboard offers a successful cleanup; confirm before saving; verify the transparent PNG is stored locally on the same pack/sprite ID with the remote fallback retained. Cancellation and rejected images must not change settings or create a second pack.

### Butler

13. Run the initial check, review findings, apply available safe suggestions, and confirm every applied item explains what changed, why, impact, activation method, and recovery path.
14. Run the same check again and open the before/after report. Confirm all eight Chinese metrics show before/after values and explanations, non-comparable data says "not calculated", and raw JSON is collapsed under the advanced section.
15. Open system-extension guidance and verify the nine common built-ins show understandable purpose, need conditions, disable impact, and conservative advice; unknown built-ins must not receive a fabricated performance conclusion.
16. Open third-party extension troubleshooting, temporarily disable a disposable third-party extension, refresh, repeat the slow action, then restore it. Confirm system extensions are not selectable and st-stage cannot select itself.

17. Update SillyTavern with the `0.9.0+202608271324` artifacts. Open `导出` with an account containing many roles/chats/worldbooks and confirm the role list appears before chat lists, worldbook bodies, or settings assets are requested.
18. Expand one role and confirm only that role's chat list loads once. Use “选择角色及全部聊天” and “全选角色及聊天”, then combine selected worldbooks, OpenAI presets, and global regex.
19. Export and confirm exactly one `default-user-YYYYMMDD-HHmmss.zip` downloads. Verify `settings.json`, `characters/`, `chats/`, `worlds/`, and `OpenAI Settings/` are directly at the archive root, no extra `default-user/` wrapper or `secrets.json` exists, and settings use `extension_settings.regex`.
20. In the STE client, choose the generated ZIP, confirm it reaches the normal selection dialog without changing the saved ST directory, complete the import into the user-selected Vault, and confirm cancel/failure/success all remove the temporary source directory.

## Deferred

- Renderer snapshot image-listener restoration.
- Conservative Renderer HTML detection.
- Renderer Cards pre-generated branch/pruning workflow.
- Batch cleanup/catalog expansion for the 143-file reference source set and owned long-term hosting/CDN selection.
- Extraction and publishing automation for the generated standalone ST distribution repository.
- Product semantic version decision after real-ST acceptance.

See `docs/maintenance/DEFERRED.md` for details.

## Next Actions

- Push the local code/build commit `116103a` and its maintenance handoff, then install it in real SillyTavern and execute the existing checks plus Cloud Export checks 17–20, recording only observed results and failures.
- Keep the deferred Renderer branching protocol out of acceptance fixes; scope it as a separate design task.
- Fix only failures observed in real ST. Do not expand the API channel matrix unless OpenAI-compatible usage produces concrete gaps.
- After blockers pass, decide whether `manifest.json` should move from `0.9.0` to `1.0.0`, then rerun the complete release gates.
