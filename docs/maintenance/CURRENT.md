---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: 69066357f025b56ebac482384b592802ddd156e8
remote_code_head_at_update: 69066357f025b56ebac482384b592802ddd156e8
build_version: 0.9.0+202608191545
phase: merged-pushed-awaiting-real-sillytavern-round5
updated_at: 2026-08-19T15:56:42+08:00
updated_by: codex
verification_source: codex-acceptance-round5-2026-08-19
history: docs/maintenance/history/2026-08-19-acceptance-round5.md
---

# Current Project Status

## Snapshot

- Fifth-round fixes are represented by code/build commit `69066357f025b56ebac482384b592802ddd156e8`, fast-forwarded to `main` and pushed to `origin/main` after the maintenance handoff.
- Product version remains `0.9.0`; the cache-busting build stamp is `0.9.0+202608191545`.
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

Evidence represented by code head `69066357f025b56ebac482384b592802ddd156e8`:

- pnpm `10.32.1` frozen install passed and did not modify `pnpm-lock.yaml`.
- Vitest `4.1.10`: 72 files, 908/908 passed.
- TypeScript typecheck and full ESLint: passed.
- Next.js `16.2.6` production build: passed.
- Playwright `1.62.0`: 25/25 across desktop Chromium, Pixel 7, and Galaxy S8. Chromium launch initially hit sandbox `spawn EPERM`; the same project-scoped suite passed outside the sandbox.
- `git diff --check`: passed.
- Root artifacts and `st-distribution/` were rebuilt twice with the fixed build stamp and remained deterministic. Shared SHA-256 hashes:
  - `index.js`: `D0E60A1B546D223922A7FBF01231B79205874963BDFFE4C963BD081347C9B849`
  - `bundle.js`: `E6DBB7839E0B98CEDDC8A60F4A5FCC915571E9E765AB23B1F737740C016755BB`
  - `style.css`: `5194DE8924006792A52B0D800A233CBDEF889094CBA9B399659C6547BA5F1ADA`
  - `version.json`: `C52328130CF5A53267E8C20CE81B2F6577505ED548510C3948842227336E3113`
- `st-distribution/` contains exactly `bundle.js`, `index.js`, `manifest.json`, `README.md`, `style.css`, and `version.json`; it contains no images, `public/`, `reference/`, or preset source.

These are automated and source-review results only. The real-ST items below remain manual evidence.

## Next Real SillyTavern Acceptance

### Runtime And Renderer

1. Update the extension from `origin/main` and confirm the settings page shows `0.9.0+202608191545`; switch chat/character once and confirm prompt injection still self-heals.
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

## Deferred

- Renderer snapshot image-listener restoration.
- Conservative Renderer HTML detection.
- Renderer Cards pre-generated branch/pruning workflow.
- Batch cleanup/catalog expansion for the 143-file reference source set and owned long-term hosting/CDN selection.
- Extraction and publishing automation for the generated standalone ST distribution repository.
- Product semantic version decision after real-ST acceptance.

See `docs/maintenance/DEFERRED.md` for details.

## Next Actions

- Install/update `origin/main` in real SillyTavern and execute the 16 checks above, recording only observed results and failures.
- Keep the deferred Renderer branching protocol out of acceptance fixes; scope it as a separate design task.
- Fix only failures observed in real ST. Do not expand the API channel matrix unless OpenAI-compatible usage produces concrete gaps.
- After blockers pass, decide whether `manifest.json` should move from `0.9.0` to `1.0.0`, then rerun the complete release gates.
