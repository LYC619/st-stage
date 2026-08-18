# Fourth Real-ST Acceptance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the fourth real SillyTavern acceptance failures in message postprocessing, Renderer, gallery management, and Butler guidance without claiming simulated evidence as real-ST success.

**Architecture:** Keep raw chat text as protocol evidence and rendered DOM as the mutation target. Extend existing pure core helpers for pack metadata, keep Renderer mode implementations independent of the plural runtime, and retain Butler's reversible transaction engine while replacing its entry workflow.

**Tech Stack:** TypeScript, Vitest/jsdom, SillyTavern 1.18.0 extension APIs, DOM APIs, CSS, Playwright, pnpm/esbuild.

---

### Task 1: Sanitized Variable Payloads

**Files:**
- Modify: `st-extension/src/message-postprocess.test.ts`
- Modify: `st-extension/src/message-postprocess.ts`

- [ ] Add a test whose raw message contains `thinking`, Renderer, summary, Analysis, and UpdateVariable tags while the DOM contains only the JSON payload.
- [ ] Run `pnpm vitest run st-extension/src/message-postprocess.test.ts` and confirm the payload remains visible.
- [ ] Replace full-message equality with unique normalized payload-variant matching.
- [ ] Run the focused test and the complete message-postprocess suite.
- [ ] Commit the isolated fix.

### Task 2: Multiple Renderer Blocks And Portrait Fallback

**Files:**
- Modify: `st-extension/src/apps/renderer/parser.test.ts`
- Modify: `st-extension/src/apps/renderer/parser.ts`
- Modify: `st-extension/src/apps/renderer/runtime.test.ts`
- Modify: `st-extension/src/apps/renderer/runtime.ts`
- Modify: `st-extension/src/apps/renderer/modes/gal.test.ts`
- Modify: `st-extension/src/apps/renderer/modes/gal.ts`
- Modify: `st-extension/src/apps/renderer/modes/cards.test.ts`
- Modify: `st-extension/src/apps/renderer/modes/cards.ts`
- Modify: `st-extension/src/index.test.ts`
- Modify: `st-extension/src/index.ts`

- [ ] Add parser/runtime tests for the real Cards + Battle reply and confirm the old singular parser rejects it.
- [ ] Add a Gal test that expects a missing explicit portrait to resolve by speaker.
- [ ] Introduce plural parsing with a three-block limit and keep the singular compatibility wrapper.
- [ ] Refactor runtime state to mount, restore, and dispose multiple independent sources.
- [ ] Add the host speaker-cover resolver and explicit card insertion feedback.
- [ ] Run all Renderer and index tests, then commit.

### Task 3: Gallery Layout And Pack Tags

**Files:**
- Modify: `core/types.ts`
- Modify: `core/migrate.ts`
- Modify: `core/migrate.test.ts`
- Modify: `core/sprite-store.ts`
- Modify: `core/sprite-store.test.ts`
- Modify: `core/share-code.ts`
- Modify: `core/share-code.test.ts`
- Modify: `core/preset-overrides.ts`
- Modify: `core/preset-overrides.test.ts`
- Modify: `st-extension/src/sprite-manager.ts`
- Modify: `st-extension/src/sprite-manager.test.ts`
- Modify: `st-extension/style.css`

- [ ] Add failing core tests for normalized type/custom tags, import/export preservation, and batch add/remove/set operations.
- [ ] Add failing DOM tests that require single-pack roles to render as normal cards and multi-pack roles to show a prominent count.
- [ ] Increment settings schema and migrate pack metadata without deleting ambiguous legacy copies.
- [ ] Implement batch tag controls and stable mixed grid/stack rendering.
- [ ] Add import-time alpha/checkerboard warnings using decoded image evidence without mutating pixels.
- [ ] Run core, manager, migration, and share-code tests, then commit.

### Task 4: Butler Action Workflow

**Files:**
- Modify: `st-extension/src/apps/butler/migrations.test.ts`
- Modify: `st-extension/src/apps/butler/migrations.ts`
- Modify: `st-extension/src/apps/butler-app.test.ts`
- Modify: `st-extension/src/apps/butler-app.ts`
- Modify: `st-extension/src/apps/butler/modals.ts`
- Modify: `st-extension/style.css`
- Modify: `e2e/butler.spec.ts`

- [ ] Add a failing migration test for an applied transaction with zero actions.
- [ ] Add UI tests for the four-step guide, prominent apply action, renamed controls, and extension-isolation onboarding.
- [ ] Reject empty transactions during normalization and restructure the main next-action section.
- [ ] Rewrite modal headings and task-oriented explanations without changing official enable/disable semantics.
- [ ] Update desktop/mobile E2E assertions and run Butler unit tests, then commit.

### Task 5: Integration, Artifacts, And Handoff

**Files:**
- Modify: `version.json`
- Modify: `bundle.js`
- Modify: `style.css`
- Modify: `st-distribution/version.json`
- Modify: `st-distribution/bundle.js`
- Modify: `st-distribution/style.css`
- Modify: `docs/maintenance/CURRENT.md`
- Modify: `docs/maintenance/DEFERRED.md`
- Create: `docs/maintenance/history/2026-08-18-acceptance-round4.md`

- [ ] Run all focused suites and `pnpm test`.
- [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm build`, extension build tests, and Playwright desktop/mobile tests.
- [ ] Refresh one build stamp, rebuild both artifact locations twice, and compare shared hashes and the six-file distribution inventory.
- [ ] Run `git diff --check` and inspect the final diff for unrelated changes.
- [ ] Commit code/artifacts, update maintenance evidence in a separate handoff commit, and push the feature branch for review.
