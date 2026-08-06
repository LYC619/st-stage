# Deferred Findings

These items are known and intentionally do not block the merged Gallery, Variable, and Renderer update. Each should receive its own scoped task if promoted.

## Prompt Compression with Notes

- Behavior: `repeat` mode falls back to `full` when a scene note is present.
- Impact: correct output but reduced token savings without a user-visible explanation.
- Location: `core/prompt-builder.ts`.

## Pure-Numeric Numbered Ranges

- Behavior: tags such as `12`, `13`, `14` can produce the display label `12-4`.
- Impact: awkward presentation; the accompanying instruction still tells the model to choose a real complete tag.
- Location: `core/sprite-metadata.ts`.

## Renderer Snapshot Image Listeners

- Behavior: snapshot restoration replaces cloned message nodes, so inline-image retry listeners attached to original nodes can be lost on the detached-root pruning path.
- Impact: low-risk retry interaction loss; settings-driven reprocessing redecorates images.
- Location: `st-extension/src/apps/renderer/runtime.ts`.

## Conservative HTML Detection

- Behavior: the Renderer HTML guard can classify prose such as `1<2 and 3>4` as HTML-like.
- Impact: the structured block safely falls back to original text, but valid prose may not render through the enhanced mode.
- Location: `st-extension/src/apps/renderer/parser.ts`.

## Large-Gallery Test Margin

- Behavior: the 1,000-sprite incremental-render test is one of the slowest unit tests and can exceed its default timeout under severe parallel machine load.
- Impact: no observed normal-run failure; investigate this first if CI becomes flaky.
- Location: `st-extension/src/sprite-manager.test.ts`.

## Product Version Decision

- Behavior: the cache-busting build stamp was refreshed, while `manifest.json` remains `0.9.0`.
- Impact: updates load correctly, but the product-facing semantic version does not communicate the size of this release.
- Decision owner: project maintainer.
