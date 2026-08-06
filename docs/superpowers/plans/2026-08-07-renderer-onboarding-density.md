# Renderer Onboarding Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show full Renderer onboarding only while disabled, use an accurate activation label, and verify the state transition in mobile E2E.

**Architecture:** Keep `quickStart` as the only onboarding composer and derive its density entirely from normalized `RendererSettings`. Preserve the existing `save` path so activation still persists settings, refreshes the prompt, reprocesses messages, and rerenders the App. Extend the existing real-extension E2E fixture with an initial enabled flag instead of creating a second harness.

**Tech Stack:** TypeScript, native DOM, Vitest/jsdom, Playwright, esbuild.

---

### Task 1: Specify compact enabled behavior

**Files:**
- Modify: `st-extension/src/apps/renderer-app.test.ts`
- Test: `st-extension/src/apps/renderer-app.test.ts`

- [ ] **Step 1: Write failing assertions for the activation label and enabled density**

Update the disabled-state assertion to require `启用渲染`. Add an enabled-state test that expects `.renderer-status` to remain, `.renderer-quick-step` to have length zero, and `.renderer-recommend` to be absent.

- [ ] **Step 2: Verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run st-extension/src/apps/renderer-app.test.ts
```

Expected: fail because the current label is `启用推荐设置` and enabled settings still render three steps.

### Task 2: Implement state-dependent onboarding density

**Files:**
- Modify: `st-extension/src/apps/renderer-app.ts`
- Modify: `README.md`

- [ ] **Step 1: Make quick steps conditional**

Always append the heading and `rendererStatus(settings)`. Append the three `quickStep` nodes and activation action only inside `if (!settings.enabled)`.

- [ ] **Step 2: Rename the action without changing its callback**

Use:

```ts
const activation = appButton('启用渲染', onEnable)
activation.classList.add('renderer-recommend')
```

Keep `onEnable` wired to `save({ ...current, enabled: true })`.

- [ ] **Step 3: Align the user guide**

Replace `启用推荐设置` with `启用渲染` in `README.md`, while retaining the instruction that at least one mode must be enabled.

- [ ] **Step 4: Verify GREEN**

Run the focused Renderer App test and expect all tests to pass.

### Task 3: Add real-extension mobile coverage

**Files:**
- Modify: `e2e/mobile.spec.ts`

- [ ] **Step 1: Parameterize initial Renderer state**

Add an `enabled` argument with default `true` to `loadRealExtensionRenderer`, feed it into the fixture settings, and expect either three rendered blocks or zero according to that argument.

- [ ] **Step 2: Add the onboarding transition test**

Load the real extension disabled, open the phone and Renderer App, assert three quick steps and `启用渲染`, verify `.renderer-settings` has no horizontal overflow, tap activation, then assert the enabled status remains while steps and action disappear. Attach a mobile screenshot for review.

- [ ] **Step 3: Run the targeted E2E test on both configured mobile projects**

Run the new test by title and expect two passes, one for Pixel 7 and one for Galaxy S8.

### Task 4: Build, verify, and hand off

**Files:**
- Update generated: `bundle.js`, `style.css`, `version.json`
- Update generated: `st-distribution/bundle.js`, `st-distribution/style.css`, `st-distribution/version.json`
- Modify: `docs/maintenance/CURRENT.md`
- Create: `docs/maintenance/history/2026-08-07-renderer-onboarding-density.md`

- [ ] **Step 1: Rebuild root and distribution artifacts with one fixed timestamp**

Run `st-extension/build.mjs` for both output roots with the same `ST_STAGE_BUILD_TIME` and verify shared hashes match.

- [ ] **Step 2: Run focused tests, typecheck, lint, E2E, and diff checks**

Do not rerun unrelated full suites. Record exact passing counts and any environment-only failures separately.

- [ ] **Step 3: Commit code and generated artifacts**

Commit the scoped code, tests, docs, and generated artifacts without pushing.

- [ ] **Step 4: Update the maintenance handoff**

Point `verified_code_head` to the new code commit, retain `real-sillytavern-acceptance`, record the automated checks, and preserve the real ST acceptance boundary.

