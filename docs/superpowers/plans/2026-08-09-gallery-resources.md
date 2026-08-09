# Gallery and Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace role bars with usable card stacks, add safe batch resource operations, and ship lightweight remote built-in presets.

**Architecture:** Keep pure pack/reference calculations in `core`, add ST file deletion to the adapter boundary, and keep orchestration in the manager. Remote presets are data-only definitions.

**Tech Stack:** TypeScript, CSS scroll snap, SillyTavern image endpoints, imgbb adapter, Vitest/jsdom.

---

### Task 1: Card-stack role groups

**Files:** `st-extension/src/sprite-manager.ts`, `st-extension/src/sprite-manager.test.ts`, `st-extension/style.css`

- [ ] Add failing tests for collapsed cover stacks, one-open-group behavior, and expanded horizontal rows.
- [ ] Render the first pack card as the stack face with decorative backing layers marked `aria-hidden`.
- [ ] Expand to a horizontal pack row with scroll snapping and keyboard/touch-safe controls.
- [ ] Run focused manager tests.

### Task 2: Safe local-file deletion

**Files:** `core/sprite-store.ts`, `core/sprite-store.test.ts`, `core/adapter.ts`, `st-extension/src/st-adapter.ts`, `st-extension/src/st-adapter.test.ts`, `st-extension/src/sprite-manager.ts`

- [ ] Add pure tests that return only uniquely referenced, eligible local image paths for a selected pack set.
- [ ] Add an adapter test for `POST /api/images/delete` with request headers and path validation.
- [ ] Add the three-outcome deletion flow and preserve metadata removal even when a physical deletion fails, reporting failures.
- [ ] Run store, adapter, and manager tests.

### Task 3: Batch cloud, local, and share operations

**Files:** `st-extension/src/sprite-manager.ts`, `st-extension/src/sprite-manager.test.ts`, `st-extension/src/sprite-localize.ts`, `core/share-code.ts`

- [ ] Add failing manager tests for selected-pack batching and progress summaries.
- [ ] Reuse existing retry/localize/share primitives; process packs sequentially to bound memory and API pressure.
- [ ] Keep failed sprites unchanged and retryable.
- [ ] Add prominent replace/reupload commands to the single-image action surface.
- [ ] Run focused tests.

### Task 4: Remote preset manifest and old asset removal

**Files:** `core/presets.ts`, `core/presets.test.ts`, `public/presets/**`, `README.md`

- [ ] Add tests for remote HTTPS URLs, casual tags without numeric prefixes, stable IDs, and absence of empty URLs.
- [ ] Encode every valid supplied remote entry; omit battle `爱慕` and damaged outfit until URLs exist.
- [ ] Remove the two old demo asset directories from the working tree.
- [ ] Verify no `/public/presets/` URL remains in generated extension code.

