---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: 62d0135
remote_code_head_at_update: d9852e9
build_version: 0.9.0+202608300122
phase: acceptance-round1-fixes-applied
updated_at: 2026-08-30T01:22:00+08:00
updated_by: claude-code
verification_source: claude-code-acceptance-round1-fixes-2026-08-30
history: docs/maintenance/history/2026-08-30-acceptance-round1-fixes.md
---

# Current Project Status

## Snapshot

- Fifth-round fixes are represented by code/build commit `69066357f025b56ebac482384b592802ddd156e8`, fast-forwarded to `main` and pushed to `origin/main` after the maintenance handoff.
- Cloud Export registration, lazy loading, batch selection, bounded-concurrency export, and standard backup are represented by code/build commit `116103a`; the review fixes by `d9852e9`, which is what real-ST acceptance round one was run against. The round-one fixes and the current artifacts are represented by `62d0135`.
- The paired STE ZIP input implementation is tracked in the sibling repository at `f874b55`; it extracts into a temporary authorized root and reuses the existing ST scan/selection/import flow without persisting `stRoot`.
- Product version remains `0.9.0`; the cache-busting build stamp is `0.9.0+202608300122`.
- This round addresses phone click-through, variable-toggle feedback, gallery stack/filter/tag management, opt-in baked-checkerboard cleanup, readable Butler comparisons, and system-extension guidance.
- The first real-ST acceptance round passed all 20 checks with no blocking defects. The six fixes it raised are described under "Acceptance Round One Fixes" below and are represented by the current artifacts.
- Automated gates are complete for those fixes. The re-check items below remain manual and are not claimed as passed.
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
- Third-party extensions are presented as a read-only guide. The staged "temporarily disable to find the stall" flow was removed in acceptance round one; the user operates SillyTavern's own extension manager. st-stage still cannot select itself, and a troubleshooting run stranded by the removal can still be restored once.

## Recorded Verification

Current artifact hashes belong to the review-fix batch described under "Review Fixes" below. Earlier rounds' hashes stay in their dated `history/` records rather than here, so this section always matches the artifacts currently in the worktree.

Evidence for the current build stamp `0.9.0+202608300122`:

- Vitest `4.1.10`: 78 files, 948/948 passed.
- TypeScript typecheck and full ESLint: passed. ESLint initially reported six errors — four dead `experiments.ts` imports in `butler-app.ts` and an unused `selected` set in `modals.ts`, all left behind by removing the troubleshooting flow — which were removed rather than suppressed.
- Next.js `16.2.6` production build: compiled successfully.
- `git diff --check`: passed.
- The nine new `cloud-export` CSS rules were parsed through a real CSSOM to confirm none were silently dropped for bad syntax, then the throwaway checker was deleted. Balanced-brace counting alone does not prove a selector is valid.
- Root artifacts were rebuilt twice with the fixed build stamp `2026-08-30 01:22` and remained byte-identical. SHA-256:
  - `index.js`: `D0E60A1B546D223922A7FBF01231B79205874963BDFFE4C963BD081347C9B849`
  - `bundle.js`: `E1D3B0042A6E19FBCAE6E20747D04ACF9CCAC391831292381B8FE985FC11ADAA`
  - `style.css`: `AF026AFAB5DB7AA36290BB622E9E61E7F178240CEFFC72063866B697A3DEE4A1`
  - `version.json`: `8F023298CE821E9B0862EFB96B8ADD404BD7F0187C72DD382564EF8167CF36D9`
- `index.js` is byte-identical to the previous round, as intended: the stub is version-agnostic and only the `bundle.js?v=` parameter it reads changes.
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

## Acceptance Round One Fixes

The first real-ST acceptance round passed all 20 checks with no blocking defects and raised five optimisations; two further defects were reported during the same round. All six are fixed here.

- **Manager panel layout.** Tag-management buttons were squeezed into vertical single-character columns. The cause was not button width: the manager's modals are appended to `.so-manager-backdrop` and are therefore *siblings* of `.so-manager`, so all 129 `.so-manager `-descendant rules missed them entirely and the panel had no layout at all. Rules were rescoped to `.so-manager-backdrop`. The vertical text specifically comes from CJK `min-content` being one character wide, so `auto` grid tracks collapse to a single column; `white-space: nowrap` plus `min-width: max-content` is what prevents it. A test asserts the modal is reachable by backdrop-scoped selectors and not by `.so-manager` descendants.
- **Checkerboard cleanup is correct; the message was not.** The detector was verified against its source: `core/checkerboard-cleanup.ts` rejects any image with alpha `< 250` anywhere, so an already-transparent PNG can never pass. The reported "clearing didn't work" was a genuinely transparent test image, not a defect. One rejection message previously covered every cause, so it read as a failure. It is now split: already-transparent images say so explicitly and separately from unevidenced backgrounds. The action button carries the same conditions as a tooltip, and `docs/SPRITE.md` enumerates all four rejection cases.
- **Third-party extensions are a guide, not an experiment.** The staged disable/refresh/compare/restore flow was removed. The replacement lists each extension's declared id, version, CSS/JS, required modules, dependencies, reverse dependents, and load order, plus six general cost principles — deliberately no fabricated per-extension timings. Users act in SillyTavern's own extension manager. A user whose troubleshooting run was stranded mid-flight by this removal gets a one-time recovery card that restores the original disabled list; it deliberately reproduces none of the sampling steps.
- **Cloud export UI.** The four category buttons now sit in one horizontal row. `.so-app-section` is `flex-direction: column` and `.so-app-btn` is `width: 100%`, so both had to be overridden — changing only the direction leaves four full-width buttons. The active tab had a class but no style at all and is now visibly distinct. Character rows gained three visual levels (card, bold character name, indented chats behind a left rule) because a chat checkbox previously rendered identically to the character checkbox above it. Checking a box no longer jumps to the top: the scroll container is the shell's `.so-phone-screen`, an *ancestor* of the app container, so the position is captured from the nearest genuinely scrolling ancestor before `replaceChildren()` and restored after refill.
- **Settings panel version.** The panel shows only `v0.9.0`. The build time stays in `version.json`, the `bundle.js?v=` parameter, the console load line, and Butler reports.
- **Two stale references found while sweeping for the removed flow.** The `extension-resource-evidence` diagnosis finding still told users it would list extensions as comparison targets for the deleted troubleshooting run, and still promised the tool would preserve and restore their disabled list — which it no longer does. Its wording now points at SillyTavern's own extension manager and states that st-stage does not modify the disabled list. Separately, a guide test asserted the modal did not contain `开始选定扩展 A/B`; that string was a test-local alias and never rendered, so the assertion would have passed with the button still present. It now checks the label that actually rendered, `开始对比所选扩展`. The paired diagnosis test was rewritten around the invariant that matters — the finding must claim correlation, never causation — instead of pinning the deleted flow's vocabulary.
- **A character card exports as a unit.** `listCharacters` discarded the card's `data` object, so `data.extensions.world` never reached the UI and a character could be exported as a bare PNG. Checking a character now selects the card, all of its chats, and its linked worldbook together; the standalone "select character and all chats" button became redundant and was removed.
- **The exported worldbook is SillyTavern's live copy.** The card's embedded `character_book` is a creation-time snapshot, and `data.extensions.world` holds only a name. Export reads the live `worlds/<name>.json` through `/api/worldinfo/get`, so edits made while playing are preserved; exporting the snapshot would silently discard them. Embedded lorebooks and character-scoped regex stay inside the PNG and are not collected separately. When a linked book is named but absent from the worldbook list, the character is still selected and a warning names the missing book rather than failing silently. The note distinguishes three states, because the worldbook list is lazily loaded and "not read yet" is not "not found" — conflating them accused an existing book of being missing on mount.

## Next Real SillyTavern Acceptance

### Runtime And Renderer

1. Update the extension and confirm the settings page shows exactly `v0.9.0` with no build time. The stamp `202608300122` now lives only in `version.json`, the `bundle.js?v=` parameter, the console load line, and Butler reports — confirm it there or in DevTools to prove the update landed. Then switch chat/character once and confirm prompt injection still self-heals.
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
16. Open the third-party extension guide. Confirm it is read-only — no checkboxes and no disable buttons — and that each installed extension shows its id, version, declared CSS/JS, dependencies, reverse dependents, and load order, with the general cost principles rather than an invented per-extension millisecond figure. Confirm st-stage shows its self-protection notice and that the guide points to SillyTavern's own extension manager.

17. Update SillyTavern with the `0.9.0+202608300122` artifacts. Open `导出` with an account containing many roles/chats/worldbooks and confirm the role list appears before chat lists, worldbook bodies, or settings assets are requested.
18. Expand one role and confirm only that role's chat list loads once. Use 全选/反选/清空 on the filtered result, then combine selected worldbooks, OpenAI presets, and global regex.
19. Export and confirm exactly one `default-user-YYYYMMDD-HHmmss.zip` downloads. Verify `settings.json`, `characters/`, `chats/`, `worlds/`, and `OpenAI Settings/` are directly at the archive root, no extra `default-user/` wrapper or `secrets.json` exists, and settings use `extension_settings.regex`.
20. In the STE client, choose the generated ZIP, confirm it reaches the normal selection dialog without changing the saved ST directory, complete the import into the user-selected Vault, and confirm cancel/failure/success all remove the temporary source directory.

### Acceptance Round One Re-checks

These cover only what round one changed. Items 21 and 22 are the ones most worth doing first: they are the two reported defects, and both concern data that leaves the machine.

21. Check a single character with a linked worldbook and export. Confirm the archive contains the character PNG, every chat under `chats/<name>/`, and `worlds/<linked name>.json` — a bare PNG is the defect being re-checked. Confirm the row note reads "勾选即整体导出" and names the linked book.
22. Before exporting, edit that worldbook inside SillyTavern (add or change an entry). Export and open `worlds/<name>.json` from the archive; it must contain the edit. Matching the card's embedded `character_book` instead means the snapshot was exported and the user's edits were lost. Also confirm a character whose `data.extensions.world` names a book that no longer exists still exports, with a warning naming the missing book.
23. In `导出`, confirm the four category buttons sit on one row on both phone and desktop widths, the current category is visibly distinct, and no label wraps to vertical text.
24. Scroll well down a long character list, check a box, and confirm the view stays put rather than jumping to the top. Repeat with a character whose chats are still loading, since selection re-renders on progress.
25. Expand a character's chats and confirm three distinguishable levels: the character card, the bold character name, and the indented chat rows behind a left rule. The parent and its children must not look identical.
26. Open tag management from the gallery manager and confirm buttons are horizontal with readable labels at their natural width, on both desktop and mobile. This is the panel that had no layout at all.
27. On the checkerboard action, hover for the tooltip, then try a genuinely transparent PNG and confirm the message says the image already has an alpha channel and needs no cleanup — distinct from the "no evidenced checkerboard" message an ordinary opaque image produces.
28. If a troubleshooting run was left stranded by an earlier build, confirm the Butler home screen offers to restore the pre-troubleshooting extension state once, that it restores the original disabled list, and that the card does not return afterwards.

## Deferred

- Renderer snapshot image-listener restoration.
- Conservative Renderer HTML detection.
- Renderer Cards pre-generated branch/pruning workflow.
- Batch cleanup/catalog expansion for the 143-file reference source set and owned long-term hosting/CDN selection.
- Extraction and publishing automation for the generated standalone ST distribution repository. The split is now decided (separate distribution repository under a new name) and blocked on the hardcoded-directory-name fix below.
- Runtime self-identification instead of the hardcoded `st-stage` install-directory name, required before the distribution repository can be published under any other name.
- Product semantic version decision after real-ST acceptance.

See `docs/maintenance/DEFERRED.md` for details.

## Next Actions

- Round one of checks 1–20 passed on `d9852e9` with no blocking defects. Install the current head in real SillyTavern and execute re-checks 21–28, starting with 21 and 22; re-run any of 1–20 whose surface these fixes touched.
- Keep the deferred Renderer branching protocol out of acceptance fixes; scope it as a separate design task.
- Fix only failures observed in real ST. Do not expand the API channel matrix unless OpenAI-compatible usage produces concrete gaps.
- After acceptance passes, execute the distribution split in this order: replace the hardcoded install-directory name with runtime self-identification, then create the distribution repository, then decide the semantic version. The split must not precede the directory-name fix, because publishing under a different name is what breaks Butler self-protection.
- After blockers pass, decide whether `manifest.json` should move from `0.9.0` to `1.0.0`, then rerun the complete release gates.
