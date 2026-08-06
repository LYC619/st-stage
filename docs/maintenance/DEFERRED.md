# Deferred Findings

These items are known and intentionally do not block the merged Gallery, Variable, and Renderer update. Each should receive its own scoped task if promoted.

## Prompt Compression with Notes

- Behavior: `repeat` mode falls back to `full` when a scene note is present.
- Impact: correct output but reduced token savings without a user-visible explanation.
- Location: `core/prompt-builder.ts`.

## Renderer Snapshot Image Listeners

- Behavior: snapshot restoration replaces cloned message nodes, so inline-image retry listeners attached to original nodes can be lost on the detached-root pruning path.
- Impact: low-risk retry interaction loss; settings-driven reprocessing redecorates images.
- Location: `st-extension/src/apps/renderer/runtime.ts`.

## Conservative HTML Detection

- Behavior: the Renderer HTML guard can classify prose such as `1<2 and 3>4` as HTML-like.
- Impact: the structured block safely falls back to original text, but valid prose may not render through the enhanced mode.
- Location: `st-extension/src/apps/renderer/parser.ts`.

## Product Version Decision

- Behavior: the cache-busting build stamp was refreshed, while `manifest.json` remains `0.9.0`.
- Impact: updates load correctly, but the product-facing semantic version does not communicate the size of this release.
- Decision owner: project maintainer.

## Remote Sprite Catalog and Localization

- Behavior: the new reference set is not shipped or copied into `st-distribution/`; remote catalog and manual local/server download are not implemented yet.
- Baseline: 143 PNG files, 181,125,118 bytes, seven outfit directories, mixed emotion/variant/source filenames.
- Risk: sampled files contain baked checkerboard pixels and cannot be treated as transparent sprites; a remote catalog must not publish them before cleanup and quality review.
- Next scoped task: clean/export transparent assets, normalize stable manifest IDs, select an HTTPS host/CDN, and connect the existing manual localization path without placing image data in `settings`.

## Generated ST Distribution

- Behavior: `st-distribution/` is generated and intentionally contains only install artifacts; root artifacts remain the current compatibility path.
- Impact: a future standalone repository can be extracted from a reproducible output, but publishing/repository split and release automation remain separate work.
