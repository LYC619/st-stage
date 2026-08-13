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

## Product Version Decision

- Behavior: the cache-busting build stamp was refreshed, while `manifest.json` remains `0.9.0`.
- Impact: updates load correctly, but the product-facing semantic version does not communicate the size of this release.
- Decision owner: project maintainer.

## Reference Sprite Cleanup and Catalog Expansion

- Delivered baseline: five Seraphina outfit presets now use 102 hosted HTTPS WebP links; each preset can be localized in place through a same-ID override without placing image bytes in settings or `st-distribution/`.
- Deferred source set: 143 PNG files, 181,125,118 bytes, seven outfit directories, mixed emotion/variant/source filenames.
- Risk: sampled source files contain baked checkerboard pixels and cannot be published as transparent sprites without cleanup and quality review. Current imgbb links also need a separately owned long-term hosting decision before a larger public catalog is promised.
- Next scoped task: clean/export transparent assets, normalize stable manifest IDs, select an owned HTTPS host/CDN, then expand or migrate the catalog without bundling image data into the extension.

## Generated ST Distribution

- Behavior: `st-distribution/` is generated and intentionally contains only install artifacts; root artifacts remain the current compatibility path.
- Impact: a future standalone repository can be extracted from a reproducible output, but publishing/repository split and release automation remain separate work.
