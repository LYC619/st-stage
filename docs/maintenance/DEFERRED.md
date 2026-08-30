# Deferred Findings

These items are known and intentionally do not block the current acceptance branch. Each should receive its own scoped task if promoted.

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
  - Update 2026-08-30: no longer reachable from the UI. Acceptance round one replaced the troubleshooting flow with a read-only guide, so nothing calls `advanceBinaryIsolation` any more. The defect is unchanged in source and would return with the entry point, so the entry stays. `experiments.ts` was deliberately kept: it still provides the one-time stranded-run recovery and `isSelf`, which is one of the three hardcoded install-directory-name sites.

## Product Version Decision

- Behavior: the cache-busting build stamp was refreshed, while `manifest.json` remains `0.9.0`.
- Impact: updates load correctly, but the product-facing semantic version does not communicate the size of this release.
- Decision owner: project maintainer.

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
- Impact: the standalone repository now exists, so new installs are ~881 KB instead of 66 MB. Release automation remains separate work, and each hand-run release is a chance to publish a stale or partial copy — which is why the loop's hash check is not optional.
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
- Deliberately not covered: the stub's last-resort fallback in `build.mjs` still
  contains the literal. It is only reached when `Error().stack` parsing fails,
  and identity no longer depends on it, so a renamed install with a working stack
  is unaffected. Removing it entirely would leave no fallback at all.
- Residual risk: derivation requires the ST layout `…/extensions[/third-party]/<dir>/bundle.js`.
  Anything else falls back to `st-stage` rather than guessing, which fails
  closed — protection may attach to the wrong name only if someone installs
  under a non-ST layout *and* renames the directory.
