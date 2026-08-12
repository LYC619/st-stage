# Butler Explainable Performance Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed Butler shortcut page with an explainable, reversible performance workflow covering measurement, diagnosis, safe optimization, remeasurement, restoration, and official extension A/B governance.

**Architecture:** Split Butler into pure versioned data, metrics, diagnosis, action transactions, and experiment state machines behind a narrow SillyTavern bridge. The phone App orchestrates these units and delegates long reports, extension governance, and gameplay guidance to full-screen modals. No metric or extension state is invented when the browser/ST API is unavailable.

**Tech Stack:** TypeScript, PerformanceObserver/Resource Timing/Storage APIs, SillyTavern 1.18.0 official modules, Vitest/jsdom, phone capability layer, Playwright.

---

### Task 1: Fix the existing non-regression bug and freeze the old Butler contract

**Files:**
- Create: `st-extension/src/apps/butler-app.test.ts`
- Modify: `st-extension/src/apps/butler-app.ts`

- [ ] Write a failing UI/action test with `streaming_fps=10` and assert one-click mode writes 10, while 30 writes 15; run it and confirm the 10 case fails.
- [ ] Compute `nextFps = Math.min(perf.streaming_fps, 15)` and preserve the existing guarded message limit.
- [ ] Run the focused test and commit `fix: preserve stricter butler performance settings`.

### Task 2: Versioned Butler data, migration, and 64 KiB persistence budget

**Files:**
- Create: `st-extension/src/apps/butler/types.ts`
- Create: `st-extension/src/apps/butler/migrations.ts`
- Create: `st-extension/src/apps/butler/migrations.test.ts`
- Create: `st-extension/src/apps/butler/history.ts`
- Create: `st-extension/src/apps/butler/history.test.ts`

- [ ] Write failing tests for old `{snapshot, perfOn}` migration into grouped transactions, malformed data fallback, UTF-8 byte accounting, ten-record retention, oldest-record eviction, and preservation of active restore/experiment state.
- [ ] Implement `ButlerDataV2`, measurement/finding/action/transaction types, normalizers, and `fitButlerDataBudget(data, 64 * 1024)` as pure functions.
- [ ] Run focused tests and commit `feat: add versioned butler state and bounded history`.

### Task 3: Read-only bridge contracts and official extension API

**Files:**
- Modify: `st-extension/src/apps/butler/bridge.ts`
- Create: `st-extension/src/apps/butler/bridge.test.ts`
- Create: `st-extension/src/apps/butler/st-contract.ts`
- Create: `st-extension/src/apps/butler/st-contract.test.ts`

- [ ] Write failing contract tests for performance settings, chat/message/DOM summaries, extension module shape, manifests/dependencies, `enableExtension(name, false)`, `disableExtension(name, false)`, and all-or-read-only fallback when exports are missing.
- [ ] Add variable-specifier imports for `/scripts/power-user.js` and `/scripts/extensions.js`, runtime shape guards, query-stripped resource grouping, and no access to Key, Prompt, or chat text.
- [ ] Run focused tests and commit `feat: expose guarded sillytavern performance contracts`.

### Task 4: Six-second metrics probes and cancellation

**Files:**
- Create: `st-extension/src/apps/butler/metrics.ts`
- Create: `st-extension/src/apps/butler/metrics.test.ts`

- [ ] Write failing tests for static DOM/media/resource/storage collection, unsupported metric reasons, idle sampling, Long Task cleanup, rAF/timer summaries, controlled-scroll restoration, background-tab cancellation, chat/layout/user-interference cancellation, and no persisted raw URL/query/chat text.
- [ ] Implement dependency-injected `sampleIdle` and `sampleControlledScroll` with `AbortSignal`, fixed six-second metadata, and observer/timer cleanup in `finally`.
- [ ] Run focused tests and commit `feat: measure explainable browser performance evidence`.

### Task 5: Pure diagnosis and safe-plan generation

**Files:**
- Create: `st-extension/src/apps/butler/diagnosis.ts`
- Create: `st-extension/src/apps/butler/diagnosis.test.ts`

- [ ] Table-test every finding for hit/miss/capability absence/boundary values and require all seven explanation fields. Assert no aggregate score and no causal wording for resource correlations.
- [ ] Test safe action planning so No Blur/reduced motion/no shadows only move toward lower cost, FPS and message count never increase, and gameplay/extension changes are excluded.
- [ ] Implement pure `diagnose(snapshot, state)` and `buildSafePlan(current, deviceClass)`; run tests and commit `feat: diagnose performance and build non-regressive plans`.

### Task 6: Grouped transactions, apply, compare, and conflict-aware restore

**Files:**
- Create: `st-extension/src/apps/butler/actions.ts`
- Create: `st-extension/src/apps/butler/actions.test.ts`

- [ ] Write failing tests for transaction-before-write ordering, actual-value reread, partial failure, reload requirements, comparable snapshot rules, raw-value-only fallback, grouped restore, and conflicts where current values differ from both before/after.
- [ ] Implement injected bridge actions and `compareMeasurements` using same chat/probe/visibility/duration/capability-set gates.
- [ ] Run focused tests and commit `feat: add reversible butler optimization transactions`.

### Task 7: Official extension governance and cross-reload A/B

**Files:**
- Create: `st-extension/src/apps/butler/experiments.ts`
- Create: `st-extension/src/apps/butler/experiments.test.ts`
- Modify: `st-extension/src/apps/butler/bridge.ts`

- [ ] Write failing tests for self-protection, dependency confirmation, user-selected third-party defaults, one reload after a successful batch, no reload on partial failure, selected-extension A/B resume, binary isolation rounds, and complete restore.
- [ ] Add emergency backup tests for appData, `localStorage`, and a console recovery command containing only extension names/timestamp.
- [ ] Implement the state machine and official API calls; run tests and commit `feat: add reversible extension ab governance`.

### Task 8: Gameplay/server advisors and phone UI

**Files:**
- Rewrite: `st-extension/src/apps/butler-app.ts`
- Modify: `st-extension/src/apps/butler-app.test.ts`
- Modify: `st-extension/style.css`
- Modify: `core/phone-shell.test.ts` only if a missing modal/navigation contract is exposed

- [ ] Write failing jsdom tests for the compact main screen, start/cancel sample, findings, change preview, apply/remeasure/restore, no score, unavailable metrics, and three full-screen modal entry points.
- [ ] Require extension and gameplay actions to have separate confirmations; require every finding detail to display detection/change/reason/impact/reload/restore/result.
- [ ] Implement the UI using existing fold sections and `ctx.openModal`; keep main phone view limited to summary, sampling, safe plan, comparison, and latest restore.
- [ ] Run focused tests, typecheck, lint, and commit `feat: deliver explainable butler performance workflow`.

### Task 9: Capability-layer dogfood record and browser coverage

**Files:**
- Modify: `playwright.config.ts`
- Modify: `e2e/mobile.spec.ts`
- Create: `docs/maintenance/history/2026-08-xx-butler-capability-dogfood.md`
- Modify: `docs/maintenance/DEFERRED.md`

- [ ] Add desktop Chromium alongside Pixel 7 and Galaxy S8 and test long finding text, modal scrolling, sample cancellation, action preview, and restore layout without overlap.
- [ ] Record capability-layer v1.5 candidates: appData/openModal/timers validated; host performance/extension/DOM APIs remain bridge escape hatches; do not add full chat-read API for one consumer.
- [ ] Run Playwright projects and commit `test: cover butler desktop and mobile workflows`.

### Task 10: Complete gates, distribution, and next real-ST acceptance

**Files:**
- Modify build artifacts and `version.json`
- Modify: `docs/maintenance/CURRENT.md`
- Create: `docs/maintenance/history/2026-08-xx-butler-performance-2.md`

- [ ] Run frozen install, lint, typecheck, full Vitest, Next production build, all Playwright projects, extension build tests, and `git diff --check`.
- [ ] Rebuild root and six-file `st-distribution/` with one fixed build stamp; verify shared hashes and no resource-source leakage.
- [ ] Append the nine Butler real-ST checks after the round-three regression group, distinguishing automated evidence from real ST.
- [ ] Keep semantic version `0.9.0` until all real-ST groups pass; commit `docs: record butler performance verification`.
