---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: ffdb5ca
remote_code_head_at_update: bf58bd8
build_version: 0.9.0+202608302113
phase: distribution-repo-published-awaiting-real-st-acceptance
updated_at: 2026-08-30T22:47:00+08:00
updated_by: claude-code
verification_source: claude-code-api-first-paint-and-prompt-compaction-2026-08-30
history: docs/maintenance/history/2026-08-30-api-first-paint-and-prompt-compaction.md
---

# Current Project Status

## Snapshot

- Fifth-round fixes are represented by code/build commit `69066357f025b56ebac482384b592802ddd156e8`, fast-forwarded to `main` and pushed to `origin/main` after the maintenance handoff.
- Cloud Export registration, lazy loading, batch selection, bounded-concurrency export, and standard backup are represented by code/build commit `116103a`; the review fixes by `d9852e9`, which is what real-ST acceptance round one was run against. The round-one fixes are represented by `62d0135`, the runtime self-identification change by `a164acb`, the `homePage` retarget plus the artifacts of that round by `838c2af`, and the install-URL and distribution-README rewrite by `0e6352c`. The first real-ST feedback after publication produced `8a5bb3e` (API app first paint) and `cfa7f48` (sprite prompt compaction, which carries the current artifacts), and `ffdb5ca` corrected the README's install section and App inventory. Everything through `bf58bd8` is on `origin/main`; `838c2af` onward is committed locally and not yet pushed. Next Actions carries the current list rather than a count here, so the two do not drift apart as record commits accumulate.
- The paired STE ZIP input implementation is tracked in the sibling repository at `f874b55`; it extracts into a temporary authorized root and reuses the existing ST scan/selection/import flow without persisting `stRoot`.
- Product version remains `0.9.0`; the cache-busting build stamp advanced to `0.9.0+202608302113`. The version decision is still open and deliberately untouched.
- **The distribution split is done.** The distribution repository is published at `https://github.com/LYC619/st-stage-ext`, first release commit `25809d9`, carrying build stamp `0.9.0+202608301732`. It holds the six generated files with fresh history and a local clone sits at `D:\8.Project\0_0_维护\st-stage-ext`. The development repository stays at `st-stage`, which is what keeps the freed-name hazard from ever arising.
- **The distribution clone is staged for release; only the push is outstanding.** The six files were copied into `D:\8.Project\0_0_维护\st-stage-ext` and committed as `01112ac` — `release: 0.9.0+202608302113`, built from `cfa7f48`. Git reported exactly three modified files (`bundle.js`, `version.json`, `README.md`), independently confirming the "three files behind" assessment: `manifest.json`, `index.js`, and `style.css` were byte-identical to what was already published. Until that commit is pushed, installed copies still lack the API first-paint fix and the shorter sprite prompt.
- Install directory names are derived at runtime, so the extension recognizes itself as `st-stage-ext`. That guarantee has not been exercised against a real install yet; it is re-check 29.
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
- The extension identifies itself by the directory it is actually installed in. `st-extension/src/apps/butler/self-identity.ts` derives that name from the bundle's own `import.meta.url` at load time, and both self-protection sites consult it instead of comparing the literal `st-stage`. Derivation is anchored to the SillyTavern layout `…/extensions[/third-party]/<dir>/bundle.js`; anything else falls back to `st-stage` rather than returning a plausible wrong value. The user-facing "cannot disable itself" message now names the real directory.
- Third-party extensions are presented as a read-only guide. The staged "temporarily disable to find the stall" flow was removed in acceptance round one; the user operates SillyTavern's own extension manager. st-stage still cannot select itself, and a troubleshooting run stranded by the removal can still be restored once.

### Post-Publication Feedback Fixes

The first real-ST session after publication raised two items. Both are fixed here; two further items were answered without code changes and are recorded under "Answered Without Code Changes".

- **The API app was the only one that did not paint instantly.** Its `mount` awaited `readConnection()`, and `readConnection` unconditionally issued `POST /api/secrets/find`. The profile list depends only on local settings, so the whole first frame was gated behind a network round trip that fetched a key the app never used. `readConnection` now takes `withSecret`, and the three call sites that only display connection state skip the secret: first paint, the manager's active-row highlight, and the `waitForConnection` re-verification poll. The app paints synchronously and fills connection state in afterwards, matching `butler-app` and `mvu-app`. `fetchModelsTransaction` deliberately keeps reading the secret — it needs the original value to restore afterwards.
- **The poll was also wasting requests.** `waitForConnection` re-reads every 120 ms for up to 8 s, and each read was firing another secret POST — up to 66 redundant requests per profile switch. A test asserts zero `find` calls against exactly one `write` call across a full apply.
- **The sprite prompt was three times longer than it needed to be.** Two constructs both grew linearly with pack size while saying the same thing: every numbered range carried its own "输出时从X至Y中随机选择一个完整图名", and then every range label was listed a second time as a prohibition. The rule is now stated once with a correct/incorrect pair drawn from the pack's own tags, which is constant cost. Range labels changed from `prefix1-3` to `prefix(1-3)`; the parentheses separate "put a number here" from the image name, so substituting an integer mechanically yields a real name. The prefix keeps its own separator (`horse_(1-2)`) because the prefix is whatever precedes the digits and is not guaranteed to be `_`. The compaction threshold dropped from 3 to 2 so the list has one reading throughout rather than mixing verbatim names with ranges. Measured on a real 271-image pack: 2327 → 856 characters.

### Answered Without Code Changes

- **Pack ordering is data, not code.** `buildScenes` in `core/prompt-builder.ts` preserves first-appearance order and there is no sort anywhere in the path, so the prompt list and the gallery wall both follow the order of segments in the share string. Reordering a pack means reordering its share string.
- **`coverTag` does not survive a share string.** The field exists in `core/types.ts` and `getPackCover` gives it priority over array order, but `encodeShareStringV2` emits only `@author`, `@kind`, `@tags`, and `@host`. An imported pack therefore always falls back to its first sprite for a cover. Adding `@cover=` would be a small neutral change; it was not made this round because it was outside the request.
- **A numbered-tag glossary was considered and declined.** Mapping numbers to names in a pack's notes field would put a per-pack constant into every injection, undoing the compaction above, and the reporter had already confirmed numbers alone generate correctly. Notes remain the right home for anything genuinely needed at generation time, since they flow into the prompt only when set.

## Recorded Verification

Current artifact hashes belong to the post-publication feedback fixes described above. Earlier rounds' hashes stay in their dated `history/` records rather than here, so this section always matches the artifacts currently in the worktree.

Evidence for the current build stamp `0.9.0+202608302113`:

- Vitest `4.1.10`: 80 files, 969/969 passed. The full run needs `NODE_OPTIONS=--max-old-space-size=6144` on this machine; the default heap aborts with a V8 out-of-memory (exit 134) partway through, which is an environment limit and not a test failure. Per-file runs are unaffected.
- TypeScript typecheck and full ESLint: passed.
- Next.js `16.2.6` production build: compiled successfully.
- `git diff --check`: passed.
- Five new tests, all mutation-checked. The two API tests assert the absence of network calls — zero `secrets/find` requests on a `withSecret: false` read, and zero across a full profile apply against exactly one `write` — so they fail if the skip regresses. The prompt tests pin that the range rule and its example each appear exactly once regardless of how many ranges exist.
- ESLint caught a real portability issue rather than a style preference: the ideographic space separating the correct/incorrect example is fine in a plain string but not in a template literal, since `no-irregular-whitespace` only exempts the former. It is now a named constant.
- The `homePage` retarget was verified to be exactly that: the whole-worktree diff for this stamp is six files, and the only non-stamp change is the one `homePage` line in the root and distribution `manifest.json`. `bundle.js` differs in two lines, both stamp interpolations.
- Three-way hash identity re-established across the development root, `st-distribution/`, and the `st-stage-ext` working tree at `01112ac` — all five functional files match, plus the distribution-only `README.md` at `F32B5F76084D33B9`. Every copied file was checked for CRLF pairs and returned zero, and the clone's root still holds exactly seven entries (six artifacts plus `.gitattributes`). This identity is true of the committed clone; it becomes true of the *published* repository when `01112ac` is pushed. SHA-256 as built:
  - `manifest.json`: `FF64862A61B75564D86990E6C710E8394E3FAB4694F29209A222D23119B87BE3`
  - `index.js`: `27DB248504A6EE1FEC948C3C6135F93732C0B075A0803317B82C972BCFCF457D`
  - `bundle.js`: `E19FFAB36B1D02E6DB8C266DDB99D53074ADEF925276DF249505F8B1D22876B6`
  - `style.css`: `AF026AFAB5DB7AA36290BB622E9E61E7F178240CEFFC72063866B697A3DEE4A1`
  - `version.json`: `5A4F4C2DDAF73F7A66DD2ED76B02DBA7EFB30FE600CDF28F15AC1B5AB52C6255`
- `manifest.json`, `index.js`, and `style.css` are byte-identical to the previous round, as expected: this round touched no CSS and no manifest field, and the stub's cross-version byte stability continues to hold. Only `bundle.js` and `version.json` moved.
- The published repository was inspected directly rather than assumed: one commit, fresh history with no development ancestry, clean worktree, in sync with its `origin/main`, `.gitattributes` present pinning `*.js`/`*.css`/`*.json` to `eol=lf`, and exactly the six files plus that `.gitattributes` at the root. `*.md` was missing from that list and was added later in dist `5842b24`.
- The runtime identity derivation was verified against the **built artifact**, not only the source: `import.meta.url` survives esbuild verbatim into `bundle.js`, and the shipped derivation returns the correct directory for renamed installs, non-default ports, and mixed-case names, while falling back for a non-ST layout. The throwaway checker was deleted afterwards.
- Both rename regression tests were mutation-checked: restoring the old `name === 'st-stage'` literal makes both fail. One of them was vacuous on first write — the fake's `findExtension` did not know the name under test, so the call returned `not-found` and never reached the self-check. It now asserts the disable actually goes through.
- Distribution boundary re-checked: `st-distribution/` contains exactly `bundle.js`, `index.js`, `manifest.json`, `README.md`, `style.css`, `version.json` — six files, 882 KB (903,499 bytes), with no images, `public/`, `reference/`, or preset source.
- Artifact hashes are reproducible on any checkout: the build normalizes generated files to LF and `.gitattributes` pins the release artifacts to `eol=lf`. Re-hashing a fresh checkout reproduces the values above.
- The install-URL and distribution-README rewrite (`0e6352c`) was gated on its own: Vitest 964/964, typecheck, ESLint, Next build, and `git diff --check` all passed, and a rebuild at the same fixed stamp left the five functional artifacts byte-identical to `838c2af`. `st-distribution/README.md` was the only artifact that changed, hash `F32B5F76084D…` against the published `D8FA59C2058E…`.
- The reordered action pack the reporter is preparing for community sharing was verified through the real decoder rather than by inspection: `decodeShareString` returns 271 sprites, the segment multiset is unchanged from the original, every group prefix resolved against the intensity order table with none left unranked, and the cover tag now sorts first. That file lives in `reference/`, which is git-ignored and never copied into the distribution repository — the verification was run from a throwaway test that was deleted afterwards.
- `st-distribution/README.md` is generated, not hand-written: `st-extension/build.mjs` writes it from `st-extension/distribution-readme.md`, so editing the output directly would be overwritten by the next build. That copy used to be a verbatim `copyFileSync`, which made `README.md` the only artifact whose bytes depended on checkout mode — the exact hazard `normalizeArtifactNewlines` exists for. It is now normalized like the other generated files, verified as zero CRLF pairs after a rebuild. Here it is also pinned: `.gitattributes` has carried `st-distribution/*.md text eol=lf` since `d9852e9`. The distribution repository's own `.gitattributes` was the one missing an `*.md` line, fixed in dist `5842b24`.

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

1. Update the extension and confirm the settings page shows exactly `v0.9.0` with no build time. The stamp `202608301732` now lives only in `version.json`, the `bundle.js?v=` parameter, the console load line, and Butler reports — confirm it there or in DevTools to prove the update landed. Then switch chat/character once and confirm prompt injection still self-heals.
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

17. Update SillyTavern with the `0.9.0+202608301732` artifacts. Open `导出` with an account containing many roles/chats/worldbooks and confirm the role list appears before chat lists, worldbook bodies, or settings assets are requested.
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
29. Install `https://github.com/LYC619/st-stage-ext` through SillyTavern's extension installer. Confirm it lands in `extensions/third-party/st-stage-ext` and loads. Open Butler's extension guide and confirm the extension marks itself protected and names `st-stage-ext`, not `st-stage`. Then try to disable it and confirm the refusal quotes `st-stage-ext` too. This is the guarantee the runtime-identification change exists to preserve, and no automated test can cover the real install path. Also confirm the extension-list entry links to `st-stage-ext` rather than the development repository, and restart ST once to confirm `auto_update` against the new origin is clean.

## Deferred

- Renderer snapshot image-listener restoration.
- Conservative Renderer HTML detection.
- Renderer Cards pre-generated branch/pruning workflow.
- Batch cleanup/catalog expansion for the 143-file reference source set and owned long-term hosting/CDN selection.
- Extraction and publishing automation for the standalone ST distribution repository. The repository itself now exists at `st-stage-ext`; what stays deferred is automating the copy-and-push release loop, which is still done by hand.
- Product semantic version decision after real-ST acceptance. Untouched this round.

See `docs/maintenance/DEFERRED.md` for details.

## Next Actions

- **Install from `st-stage-ext` in real SillyTavern and run re-check 29 first.** The extension is now published under a directory name it has never actually run under, and self-protection is derived at runtime. Everything else in this round is byte-verified; this is the only claim resting on untested behavior.
- Then execute re-checks 21–28, starting with 21 and 22, and re-run any of 1–20 whose surface the round-one fixes touched. Round one of 1–20 passed on `d9852e9` with no blocking defects.
- **Two pushes are outstanding, and they are the only remaining step.** Both repositories are committed with clean worktrees; pushing from the agent session fails on credentials rather than network, so it is a maintainer action.
  - `st-stage`: push everything in `bf58bd8..HEAD` to `origin/main` — `838c2af`, `0e6352c`, `fa834ce`, `8a5bb3e`, `cfa7f48`, `ffdb5ca`, `74f4539`, plus the commit carrying this line.
  - `st-stage-ext`: push `01112ac` (the `202608302113` release) and `5842b24` (markdown line-ending pin).
  - Push `st-stage` first, or at least in the same sitting. The distribution commit names `cfa7f48` as its source, and that link dangles until the development history is public.
- After re-check 29 passes, decide whether `manifest.json` moves from `0.9.0` to `1.0.0`, then rerun the complete release gates. Recommended sequence is to hold `0.9.0` until acceptance closes, since the version travels to every installed copy through `auto_update` and is awkward to walk back.
- Decide whether to add `@cover=` to the stpack2 share format. Without it every imported pack falls back to its first sprite as the cover, which is why pack ordering currently has to double as cover selection. Small and self-contained; deferred only because it was outside this round's request.
- Keep the deferred Renderer branching protocol out of acceptance fixes; scope it as a separate design task.
- Fix only failures observed in real ST. Do not expand the API channel matrix unless OpenAI-compatible usage produces concrete gaps.

## Distribution Repository

Published 2026-08-30. Creation is done; what remains below is the release loop for every subsequent build.

| Field | Value |
| --- | --- |
| Repository | `https://github.com/LYC619/st-stage-ext` |
| First release commit | `25809d9` — `initial release: 0.9.0+202608301732` |
| Build stamp published | `0.9.0+202608301732` |
| Build stamp pending release | `0.9.0+202608302113` — built from `cfa7f48`, not yet copied or pushed |
| Built from | development commit `838c2af` |
| Local clone | `D:\8.Project\0_0_维护\st-stage-ext` |
| Install directory name | `st-stage-ext` |

Fresh history, one commit, no development ancestry. `.gitattributes` is present in the distribution repository pinning `*.js`, `*.css`, `*.json`, and — since dist `5842b24` — `*.md` to `text eol=lf`. It lives only there, since it is not part of the copied file set and the development repository pins its own artifacts separately. That is why the copy step must never clear the directory first: `.gitattributes` has no upstream copy to restore it from.

The development repository keeps the `st-stage` name. That is deliberate and load-bearing: renaming would leave a redirect that a later repository at the freed name could override, and existing installs would then `auto_update` against unrelated history. Holding the old name means the hazard never arises. Do not rename `st-stage`, and do not create anything else under that name.

### What Goes In

Exactly the six files generated in `st-distribution/`, at the repository **root** — not inside a subdirectory. SillyTavern reads `manifest.json` from the repository root and loads only the `js` and `css` it declares.

| File | Size | Purpose |
| --- | --- | --- |
| `manifest.json` | 259 B | What ST reads first; declares `index.js` and `style.css` |
| `index.js` | 1.9 KB | Byte-stable loader stub; resolves its own base URL, then version-busts the rest |
| `bundle.js` | 801 KB | All extension code, single ESM file |
| `style.css` | 78 KB | Extension styles plus the shared phone shell |
| `version.json` | 27 B | Read with `cache: no-store`; supplies the `?v=` cache-busting parameter |
| `README.md` | 1.2 KB | The distribution repository's front page: what the extension is, how to install it, and where the source lives. Generated from `st-extension/distribution-readme.md` — edit that, not the output |

Total 882 KB (903,499 bytes). Regenerate with a fixed stamp so the bytes are reproducible:

```
ST_STAGE_BUILD_TIME="YYYY-MM-DD HH:MM" pnpm build:st
```

Do **not** copy `st-extension/`, `core/`, `docs/`, `public/`, `reference/`, `app/`, `components/`, or any test file. The development repository measured 66 MB across 284 files against these 6 files at 881 KB; that gap is the reason for the split.

`manifest.json` now carries `"homePage": "https://github.com/LYC619/st-stage-ext"`. With `auto_update: true`, ST runs a git update against the origin the user cloned from on every start, so this field has to name the repository users actually installed from. The root `manifest.json` here is the source the build copies — edit it here and rebuild; editing the generated copy is overwritten by the next build.

### Release Loop

Publishing automation is still deferred, so every release repeats these steps by hand.

Steps 1–5 are done by whoever built the artifacts, agent sessions included — copying files between two local clones is reversible and needs no credentials. **Step 6, both pushes, is a maintainer action**: Git Credential Manager wants an interactive prompt that an agent session cannot answer, and the agent does not handle credentials. Do not leave the copy undone waiting on a human; leave only the pushes.

1. Rebuild both trees at one fixed stamp: `ST_STAGE_BUILD_TIME="YYYY-MM-DD HH:MM"` with `pnpm build:ext` and `pnpm build:st`. The stamp is what busts the client cache, so it must advance for the release to reach existing installs.
2. Confirm the five generated files hash-identically between the root and `st-distribution/`. This check is in the loop because a previous round refreshed only the root and left `st-distribution/` 159 CSS lines behind; a copy taken from that directory would have shipped without the round-one UI fixes. `README.md` is excluded from this comparison on purpose — the root README is the development repository's own, and only `st-distribution/README.md` is the generated one that travels.
3. Run the full gates in this repository and commit the artifacts here first, so the published bytes are always traceable to a development commit.
4. Copy the six files into the `st-stage-ext` clone and commit there. Do not graft development history: it carries the 66 MB of source and assets the split exists to remove, and a shallow graft would still fetch those objects. Copy only those six — the clone's `.gitattributes` is its own and must survive; never clear the directory first.
5. Re-hash the published working tree against this repository and record the three-way match, the distribution commit, and the stamp under "Recorded Verification". Check the copied files for CRLF pairs while here: a Windows checkout can reintroduce them, and the recorded hashes are only reproducible on LF.
6. Push this repository first, then `st-stage-ext`. That order matters because the distribution commit message names its source commit here, and pushing the distribution alone leaves that reference dangling for anyone auditing what was published.

Never copy `st-extension/`, `core/`, `docs/`, `public/`, `reference/`, `app/`, `components/`, or any test file into the distribution repository. `reference/` in particular holds private chat logs and is git-ignored here.
