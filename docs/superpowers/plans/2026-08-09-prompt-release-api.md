# Prompt, Release, and API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce materially shorter truthful sprite prompts, retain address compatibility, and close the lightweight distribution and common-channel API gates for 1.0 acceptance.

**Architecture:** Add relative resolution as a conservative fallback, render compact prompts from role/outfit scene data, and keep build output deterministic. API profiles own plaintext values and apply them through the existing ST bridge transaction.

**Tech Stack:** TypeScript pure functions, Vitest, esbuild, Next.js, SillyTavern connection DOM/secret APIs.

---

### Task 1: Relative sprite address resolution

**Files:** `core/types.ts`, `core/sprite-store.ts`, `core/sprite-store.test.ts`

- [x] Add failing tests for first-enabled-pack bare-tag defaults, outfit/tag fallback, legacy role/tag precedence, and ambiguous fallback rejection.
- [x] Implement the fallback without changing full three-part address parsing.
- [x] Run focused store tests.

### Task 2: Role-level prompt compression

**Files:** `core/prompt-builder.ts`, `core/prompt-builder.test.ts`

- [x] Add a Seraphina-shaped fixture and assert one role header, one base pool, outfit increments, exact suffix lists, and a shorter result than grouped full mode.
- [x] Treat `BUILTIN_TEMPLATE` equality as built-in behavior rather than custom-template mode.
- [x] Render same-role scene labels as outfits and emit relative output rules consistent with Task 1.
- [x] Preserve full mode and budget fitting, then run prompt tests.

### Task 3: Injection/preview parity

**Files:** `st-extension/src/apps/sprite-app.ts`, `st-extension/src/apps/sprite-app.test.ts`, `st-extension/src/index.ts`

- [x] Add tests proving preview and injection receive identical notes and lengths.
- [x] Reuse one active-prompt builder in the App preview and injection paths.
- [x] Change the built-in-template action/copy so an unchanged baseline keeps auto compression.
- [x] Run focused App and entry tests.

### Task 4: Plaintext common-channel API release gate

**Files:** `st-extension/src/apps/api/core.ts`, `st-extension/src/apps/api/core.test.ts`, `st-extension/src/apps/api/bridge.ts`, `st-extension/src/apps/api/bridge.test.ts`, `st-extension/src/apps/api/manager.ts`

- [x] Add migration tests retaining plaintext profile keys and application tests that write the selected key before connection.
- [x] Audit and test OpenAI/custom, OpenRouter, Claude, and Google AI Studio; route other OpenAI-schema services through custom.
- [x] Keep existing imported profiles readable and avoid duplicating niche forms.
- [x] Run focused API tests and typecheck.

### Task 5: Distribution, verification, and maintenance handoff

**Files:** `st-extension/build.test.ts`, `st-extension/distribution-readme.md`, `README.md`, `docs/maintenance/CURRENT.md`, `docs/maintenance/DEFERRED.md`, `docs/maintenance/history/2026-08-10-acceptance-round2.md`, generated root and `st-distribution/` artifacts

- [x] Add/adjust build tests proving no image assets or development/reference files enter `st-distribution/`.
- [x] Run focused tests after each task, then full Vitest, lint, typecheck, Next build, mobile E2E, and `git diff --check`.
- [x] Rebuild root and distribution with one fixed stamp and compare shared SHA-256 hashes.
- [ ] Record automated evidence separately from real-ST checks, update deferred items honestly, and leave semantic version at 0.9.0 until the maintainer completes final acceptance.
