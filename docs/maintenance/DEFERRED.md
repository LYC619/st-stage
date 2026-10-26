# Deferred Findings

Known follow-ups and pending review repairs are recorded here. Older sections retain their original non-blocking decisions; the review queue below is **not** a declaration that its risks are acceptable for a new release. Remove or resolve entries only with an actual fixing commit and fresh verification.

## 2026-10-26 WeChat Review Queue — Code Merged, Scoped Host Acceptance Complete

Round-4 repairs for the five remaining findings (W9 test callback typing, W4 same-scope refresh ordering, W1c ownership re-evaluation after stat impact await, W1c external money snapshot protection, W1a valid alias traversal) passed independent re-review and are committed in `752678d`, then included in merged `main` code head `7866559` and build `0.9.0+202610261121`. Scoped SillyTavern 1.18.0 browser acceptance subsequently passed on desktop and a simulated 320×667 viewport; see [Real-ST Acceptance](history/2026-10-26-real-st-acceptance.md), [Fifth Review](history/2026-10-26-wechat-fifth-review.md), [Round-4 Repairs](history/2026-10-26-wechat-round4-repairs.md), and [Merge and Release](history/2026-10-26-merge-and-release.md). Controlled third-party MVU, physical-device/OS IME and real external AI acceptance remain open.

| ID | Priority | Code repair status and remaining verification |
| --- | --- | --- |
| W1 | P1 | Code repair committed: W1a (valid alias traversal in character pool without masking), W1b (live event subscription & pre-send refresh), W1c (authoritative external snapshot, post-await ownership re-evaluation, and red packet money protection), W1d (non-enum location preserved in prompt) verified by unit tests. Real-ST main-chat context passed with intercepted replies; controlled third-party MVU state/event/settlement acceptance remains pending. |
| W2 | P1 | Code repair committed: scoped by composite key `${characterId\|\|avatar\|\|charName}::${chatId}` with synchronous view switching and clean legacy key removal. Same-character two-chat isolation passed in real ST on desktop and simulated mobile. |
| W3 | P1 | Code repair committed: resource-ID validation and safe native DOM construction prevent HTML injection; unit evidence retained. The host smoke test does not establish adversarial HTML-injection acceptance. |
| W4 | P1 | Code repair committed: immutable session tokens (`mountSessionId`, `activeScopeSessionId`, `scopeKey`) prevent cross-character/unmount leaks; monotonic refresh counter (`latestRefreshReq` / `latestAppliedRefresh`) drops stale in-flight reads within same scope. Host chat isolation passed; controlled external-state race acceptance remains pending. |
| W5 | P2 | Code repair committed: all 50 files match SHA-256 across source/preview/distribution/installation repository. Four sampled packaged resources returned HTTP 200 in real ST on desktop and simulated mobile. |
| W6 | P2 | Code repair committed: composition state, isComposing and keyCode 229 block sending, normal Enter resumes after composition; physical OS IME acceptance pending. |
| W7 | P2 | Code repair committed: responsive input flex shrinking prevents send button clipping at 320px viewport. Real-ST simulated 320×667 geometry passed; physical-device acceptance pending. |
| W8 | P2 | Code repair committed: character avatar filename resolved via ST thumbnail/character route (`resolveCharacterAvatarUrl`) with `avatar.onerror` fallback to default avatar. Real-ST character avatar passed; this does not add a live error-fallback test. |
| W9 | P1 | Code repair committed: aligned deferred resolver and message callback types with AppHost contracts; merged `tsc --noEmit --incremental false` evidence passes with 0 errors. |

Fresh fifth-review evidence: 91 files / 1219 tests pass in one full run, including 29 WeChat tests; tsc with incremental false and lint both exit 0. Controlled source fixtures retain mood 96 after an old read returns 82, preserve external mood/interest 82/35 when ownership changes during a genuinely pending stat evaluation, retain external wallet 1000 after a red packet, and select valid same-character aliases before root values. All 7 runtime files match between root and `st-distribution`; all 50 assets match across root, preview and distribution. No extension/Next rebuild or real-ST/device acceptance was performed in this review. A fixing commit does not itself close live acceptance.

The later merged-suite and scoped host evidence is recorded separately in the linked release and real-ST histories. The remaining gates above stay open; passing browser emulation does not establish physical-device or third-party MVU acceptance.
## 2026-09-30 i18n Continuation and Release Gates

Updated October 7: `cec4e8d` completes the authorized core UI/five-main-App translation and practical keyboard/focus scope, including Cloud Export and common validation/image actions. Final evidence is 1321 tests, 10 real-ST i18n scenarios, 4 Export layouts/ZIP-content checks, 12 native regressions and 6 actual-host-script tab checks. Gallery and variables have prior accepted 4-layout batches. See `history/2026-10-07-export-final.md` and prior histories.

- Actual third-party MVU is absent; only its unavailable UI and a controlled native fixture (5 read/write/focus cases) were checked. Full readers, physical devices/OS keyboards, WAVE and contrast/WCAG AA acceptance remain unverified.
- The September 12 plan's bundle-size warning is implemented. Named nonmodal regions intentionally replace its `role=application` suggestion, and the translation guide is `docs/i18n-usage.md`. License choice and license/CI badges await a maintainer/publication decision; this functional completion is not a claim that every historical plan checkbox is closed.

- `e11cd3d` repairs locale loading, adds the first translated UI controls and fixes real-ST gallery toolbar/keyboard issues. Real ST 1.18.0 i18n acceptance passes 10 scenarios; full App/deep gallery translation, focus management and screen-reader support remain pending.
- Mobile browser emulation is separate from physical-phone/OS-keyboard acceptance. External sprite hosts were blocked; the isolated copied ST runtime logged thumbnail-conversion dependency-path errors. Cloud images and image conversion were not validated by this run.
- September 7 real-ST image migration/save/reload/restore, fault handling and standard ZIP-import checks below remain open. Only their existing synthetic maintenance browser regressions were rerun.
- The reviewed branch was merged into `main` at `7866559`. The development repository was pushed through `131f1e3`; the reconciled README, both locale JSON files, original six root files and 50 WeChat assets passed three-way parity and were published to the installation repository at `0b24014`. Historical six-file instructions are superseded by CURRENT.md.

## 2026-09-05 Review Queue — Code Committed, Acceptance Pending

Updated 2026-09-07 after explicit commit/push authorization: fixing code/build commit `81b4286bb68c6f42badc5ca52b39ac1fbf79c72e` is pushed to development main. This updates the legacy install channel, but not the independent `st-stage-ext` repository. Code fixes are traceable and local gates pass; applicable real-ST/device acceptance and independent release parity remain outstanding. Evidence and remaining checks are in history/2026-09-07-maintenance-repairs.md; original provenance is in history/2026-09-05-maintenance-review.md.

| ID | Priority | Code repair in 81b4286 and remaining checks |
| --- | --- | --- |
| R1 | P1 | Unique random filenames and concurrent-reference checks are committed; real-ST image-write acceptance remains pending. |
| R2 | P1 | Avatar-based chat paths and ZIP collision validation are committed and JSZip round trips pass; real-ST ZIP import remains pending. The older fallback-ID edge below is separate. |
| R3 | P1 | Upload failure now rejects without base64 fallback; byte readback/timeout/limits are tested. Real-ST fault/reload acceptance remains pending. |
| R4 | P2 | Settings/JSON/preset `inventoryPrompt` round trips and clearing are fixed and verified. No separate code repair remains for this finding. |
| R5 | P2 | Optional request-header capability is guarded; commit-time tsc passes. No separate code repair remains for this finding. |
| R6 | P2 | Full HUD bounds and resource disposal are fixed; Edge geometry passes. Physical-phone/live-theme acceptance remains pending. |
| R7 | P2 | Root/generated-distribution artifacts match and root CSS is committed; independent-release bundle/CSS/version/README parity remains pending synchronization. |
| R8 | P2 | Persistent input and composition-aware updates are fixed; browser keyboard/paste/CDP composition tests pass. Physical OS-keyboard acceptance remains pending. |

**S1 — migration/storage acceptance pending:** commit `81b4286` adds backup-first staged migration, receipt-confirmed selective restore and complete image preparation before JSON/share installation. Unmapped raw images block writes; Apps remain unchanged. The synthetic 32 MiB STAdapter JSON round trip passes, but real-ST disk-save/reload/restore and physical-device acceptance are not performed. Updating alone does not shrink old settings; migration is explicit. Portable JSON support itself is not classified as a new bug.

Local gates: 89 files / 1172 tests, tsc, lint, Next build, same-stamp extension builds and isolated Edge regressions pass; tests/tsc/lint were rerun before commit. The five runtime files match between root and `st-distribution`. Three-way release parity still fails on bundle/CSS/version and README because the release clone was deliberately not updated; reconcile README before release copying. The authorized development push does not mark real-ST standard ZIP import or physical-phone/OS-keyboard checks as passed. The old manual queue remains in `history/2026-09-05-pre-review-status-snapshot.md`.

## Renderer Snapshot Image Listeners

- Behavior: snapshot restoration replaces cloned message nodes, so inline-image retry listeners attached to original nodes can be lost on the detached-root pruning path.
- Impact: low-risk retry interaction loss; settings-driven reprocessing redecorates images.
- Location: `st-extension/src/apps/renderer/runtime.ts`.

## Conservative HTML Detection

- Behavior: the Renderer HTML guard can classify prose such as `1<2 and 3>4` as HTML-like.
- Impact: the structured block safely falls back to original text, but valid prose may not render through the enhanced mode.
- Location: `st-extension/src/apps/renderer/parser.ts`.

## Renderer Choice Branch Generation

- Behavior: Cards mode currently inserts the selected action into the SillyTavern composer and requires the user to review and send it. It does not ask the model to pre-generate every branch or delete unselected branches before sending.
- Impact: the current workflow is predictable and does not spend tokens on unused branches, but it does not provide an instant pre-rendered branching-story experience.
- Why deferred: pre-generated branches require a separate protocol, token-budget policy, persisted selection state, safe pruning rules, and real-ST generation/send integration. It should not be folded into the narrow Renderer recovery fix.
- Location: `st-extension/src/apps/renderer/modes/cards.ts` and the Renderer prompt contract.

## Cloud Export Selection And Identity Edges

Raised by the 2026-08-27 review of the Cloud Export batch. The four higher-severity findings from that review were fixed; these remain open.

- Character identity falls back to `avatar || name`. Two characters sharing an avatar filename, or both missing one, collapse into a single ID, so selection state and the card buffer silently overwrite each other. Real SillyTavern avatar filenames are unique, so this is a latent risk rather than an observed failure. Location: `st-extension/src/apps/cloud-export/bridge.ts` character mapping.
- A failed export leaves already-issued asset reads running: no `AbortSignal` reaches the bridge, and their progress callbacks keep firing after the error toast. The export result is still correct — no partial archive is produced. Location: `st-extension/src/apps/cloud-export/export-loader.ts` task runner.
- The `world_info_settings.world_info.globalSelect` shape has not been checked against SillyTavern source in this repository; the design records it as verified against 1.18.0, but that source is not vendored here. An incorrect shape would be ignored by the importer rather than corrupt data.
- Raised 2026-08-30 while bundling the linked worldbook: `findLinkedWorldbook` matches case-insensitively after stripping `.json`, and returns the first hit. A SillyTavern host on a case-sensitive filesystem can hold `World.json` and `world.json` as two distinct worldbooks, in which case the wrong book can be bundled. Case-insensitive matching is the right default for the common Windows host, so this is a latent cross-platform risk rather than an observed failure, and it mis-selects rather than loses data. Location: `st-extension/src/apps/cloud-export/export-app.ts` linked-worldbook lookup.

## Butler Recovery State Edges

Raised by the same review.

- A malformed `activeTransaction` is silently discarded during migration, so the user loses the "restore this batch of performance settings" safety net without any notice. History records are skipped individually in the same file, making the top-level all-or-nothing behavior inconsistent. Location: `st-extension/src/apps/butler/migrations.ts` v2 normalization.
- Binary isolation can narrow its candidate list to empty and then run further rounds that disable nothing, leaving the user cycling through no-change rounds. `prepareExtensionExperiment` rejects an empty candidate list, but the advance path does not reach that guard. Location: `st-extension/src/apps/butler/experiments.ts` binary isolation advance.
  - Update 2026-08-30: no longer reachable from the UI. Acceptance round one replaced the troubleshooting flow with a read-only guide, so nothing calls `advanceBinaryIsolation` any more. The defect is unchanged in source and would return with the entry point, so the entry stays. `experiments.ts` was deliberately kept: it still provides the one-time stranded-run recovery and `isSelf`, which is one of the two call sites consulting the runtime-derived install directory name. (This clause used to call `isSelf` a hardcoded site; `a164acb` made it delegate to `isSelfExtensionName`, and it hardcodes nothing now.)

## Product Version Decision

- Behavior: the cache-busting build stamp was refreshed, while `manifest.json` remains `0.9.0`.
- Impact: updates load correctly, but the product-facing semantic version does not communicate the size of this release.
- Decision owner: project maintainer.

## Share Strings Do Not Carry `coverTag`

- Behavior: `coverTag` exists in `core/types.ts` and `getPackCover` gives it priority over array order, but `encodeShareStringV2` emits only `@author`, `@kind`, `@tags`, and `@host`. `decodeShareStringV2` therefore has nothing to restore, and every imported pack falls back to its first sprite for a cover.
- Impact: pack ordering has to double as cover selection. Someone who wants a specific cover in a shared pack must make it the first segment, which then also makes it the first entry in the injected prompt list and the gallery wall.
- Found: 2026-08-30, while establishing that pack ordering is data rather than code. Not a regression; the field has never travelled.
- Scope: add `@cover=` to the v2 encoder, restore it in the decoder behind the existing "does this tag exist" guard that `pack-io.ts` already applies, and leave v1 alone.
- Deferred because: outside the request that surfaced it. Small and self-contained, no known blocker.

## Reference Sprite Cleanup and Catalog Expansion

- Delivered baseline: five Seraphina outfit presets now use 102 hosted HTTPS WebP links; each preset can be localized in place through a same-ID override without placing image bytes in settings or `st-distribution/`.
- Delivered tool: image details now provide an opt-in, conservative checkerboard detector and same-ID transparent-PNG localization for an individual sprite; this does not mean the source set has been batch-cleaned.
- Deferred source set: 143 PNG files, 181,125,118 bytes, seven outfit directories, mixed emotion/variant/source filenames.
- Risk: sampled source files contain baked checkerboard pixels and cannot be published as transparent sprites without cleanup and quality review. Current imgbb links also need a separately owned long-term hosting decision before a larger public catalog is promised.
- Next scoped task: clean/export transparent assets, normalize stable manifest IDs, select an owned HTTPS host/CDN, then expand or migrate the catalog without bundling image data into the extension.

## Generated ST Distribution — Split Done 2026-08-30, Automation Still Deferred

The repository split itself is closed. `https://github.com/LYC619/st-stage-ext` is published, first
release commit `25809d9` at stamp `0.9.0+202608301732`, built from development commit `838c2af`, with
a fresh single-commit history and a local clone at `D:\8.Project\0_0_维护\st-stage-ext`. What stays
deferred is the **publishing automation**: the copy-and-push release loop is documented in
`CURRENT.md` and run by hand every release. The reasoning below is retained because the constraints
it records still bind every future release.

- Behavior: `st-distribution/` is generated and intentionally contains only install artifacts; root artifacts remain the current compatibility path for installs made before the split.
- Impact: the standalone repository now exists, so new installs are ~882 KB instead of 66 MB. Release automation remains separate work, and each hand-run release is a chance to publish a stale or partial copy — which is why the loop's hash check is not optional. The first release after publication demonstrated the cost concretely: the stamp advanced to `202608302113` on 2026-08-30 with two user-visible fixes, and installed copies had them only once a human ran the copy-and-push by hand.
- Decision 2026-08-29, executed 2026-08-30 as `st-stage-ext`: the split publishes a separate distribution repository under a **new** name, keeping this development repository at `st-stage`. Reusing the `st-stage` name for the distribution repository would require renaming this one, and creating a new repository at the freed name breaks GitHub's rename redirect: existing installs would then point at a repository with unrelated history, so `auto_update` would fail and every current user would have to reinstall. A new distribution name leaves installed instances untouched, and this repository's root artifacts continue to serve them.
- Measured motivation (2026-08-29, at `d9852e9`): a clone is 66 MB and 284 files to deliver 5 runtime files totalling roughly 895 KB. History weight is `bundle.js` 20.7 MB accumulated across rebuilds and 19.7 MB of deleted `public/` preset PNGs that remain reachable. Because `manifest.json` sets `auto_update: true`, every SillyTavern start performs a git update against that history. Runtime cost inside the browser is unaffected: SillyTavern reads `manifest.json` and injects only the declared `index.js` and `style.css`, so the other tracked files and all ignored local directories are never read.
- Sequencing: the distribution repository started a fresh history rather than filtering this one, which returns `.git` to the scale of the artifacts themselves. Since `auto_update` performs a git update, that history must stay linear from here on — no force push, no history rewrite, no grafting development history in later.
- Standing invariant: do not rename `st-stage`, and do not create anything else under that name. The redirect a rename leaves behind is overridden by a new repository at the freed name, at which point installed copies `auto_update` against unrelated history.
- Was blocked on "Hardcoded Install Directory Name" below, which is now resolved. The runtime derivation has not yet been exercised against a real install under the new directory name — that is acceptance re-check 29.

## Hardcoded Install Directory Name — Resolved 2026-08-30

Closed by the runtime self-identification change. Kept here as the record of what
the defect was and what the fix does not cover.

- Was: the install directory name equals the repository name and was hardcoded in
  `isSelfExtension` (`butler/bridge.ts`), `isSelf` (`butler/experiments.ts`), and
  the loader stub's fallback base path (`build.mjs`). Under any other directory
  name Butler stopped recognizing itself, so the guarantee that it cannot be
  selected for extension isolation silently failed and a user could disable
  Butler through Butler.
- Now: `butler/self-identity.ts` derives the directory name at runtime from the
  bundle's own `import.meta.url` and both call sites consult it. Two additional
  literals were found during the fix that this entry had not listed — the
  user-facing `管家不能禁用 st-stage 自身` message in each of those two files —
  and both now interpolate the runtime name.
- The sweep needed a third pass. The 2026-08-31 pre-release review found two
  more hardcoded literals that both earlier passes missed, and one of them was
  the single most visible one: the self-protection notice in the third-party
  extension guide (`butler/modals.ts`, `这是 st-stage 自己。…`) — exactly the
  string acceptance re-check 29 reads to decide whether the extension names
  `st-stage-ext`. On a real install it would have said `st-stage` while the
  disable refusal beside it said `st-stage-ext`, disagreeing on one screen. The
  second was `prepareExtensionExperiment`'s rejection error in
  `butler/experiments.ts`. Both now interpolate `SELF_DIRECTORY_NAME`.
- Why two passes missed them: the earlier sweeps searched for the *disable*
  wording (`管家不能禁用`), which both of these sites phrase differently — one
  is a descriptive notice, the other an experiment-rejection error. Searching
  for the literal `st-stage` inside string literals finds all of them regardless
  of phrasing, and is the check to repeat if a third site is ever suspected.
- The invariant is **no `st-stage` in user-visible copy**, not none anywhere.
  That search still returns about twenty legitimate hits in non-test source:
  `[st-stage]` console prefixes, the renderer's CSS classes and the
  `data-st-stage-style` attribute, `FALLBACK_DIRECTORY_NAME`, the `build.mjs`
  stub fallback, and two live state keys that must not be renamed — the ST
  prompt slot key `st-stage::<channel>` (`st-adapter.ts`) and
  `st-stage:butler:extension-recovery:v1` (`experiments.ts`). Renaming either
  key orphans existing user state. Filter the search to strings that reach the
  UI before concluding anything from its hit count.
- Deliberately not covered: the stub's last-resort fallback in `build.mjs` still
  contains the literal. It is only reached when `Error().stack` parsing fails,
  and identity no longer depends on it, so a renamed install with a working stack
  is unaffected. Removing it entirely would leave no fallback at all.
- Residual risk: derivation requires the ST layout `…/extensions[/third-party]/<dir>/bundle.js`.
  Anything else falls back to `st-stage` rather than guessing, which fails
  closed — protection may attach to the wrong name only if someone installs
  under a non-ST layout *and* renames the directory.
