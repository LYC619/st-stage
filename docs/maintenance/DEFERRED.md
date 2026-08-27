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

## Butler Recovery State Edges

Raised by the same review.

- A malformed `activeTransaction` is silently discarded during migration, so the user loses the "restore this batch of performance settings" safety net without any notice. History records are skipped individually in the same file, making the top-level all-or-nothing behavior inconsistent. Location: `st-extension/src/apps/butler/migrations.ts` v2 normalization.
- Binary isolation can narrow its candidate list to empty and then run further rounds that disable nothing, leaving the user cycling through no-change rounds. `prepareExtensionExperiment` rejects an empty candidate list, but the advance path does not reach that guard. Location: `st-extension/src/apps/butler/experiments.ts` binary isolation advance.

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

## Generated ST Distribution

- Behavior: `st-distribution/` is generated and intentionally contains only install artifacts; root artifacts remain the current compatibility path.
- Impact: a future standalone repository can be extracted from a reproducible output, but publishing/repository split and release automation remain separate work.
