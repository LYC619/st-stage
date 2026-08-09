# Runtime Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep sprites active across new chats, update the overlay during streaming, hide new-variable protocol records, and correct two real-ST layout/display regressions.

**Architecture:** Extend the ST adapter with explicit navigation and stream events, keep stream de-duplication in the extension entry point, and make message post-processing reversible for variable blocks. UI changes remain settings-driven.

**Tech Stack:** TypeScript, DOM APIs, SillyTavern eventSource, Vitest/jsdom, CSS.

---

### Task 1: Navigation and stream event contracts

**Files:** `st-extension/src/st-adapter.ts`, `st-extension/src/st-adapter.test.ts`, `core/adapter.ts`

- [ ] Add failing tests that expose `CHAT_CREATED`, `STREAM_TOKEN_RECEIVED`, and generation-end subscriptions and verify unsubscribe behavior.
- [ ] Run `node node_modules/vitest/vitest.mjs run st-extension/src/st-adapter.test.ts` and confirm the new assertions fail.
- [ ] Add typed adapter methods that resolve modern event names with stable fallbacks.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Self-healing navigation and streaming overlay

**Files:** `st-extension/src/index.ts`, `st-extension/src/index.test.ts`

- [ ] Add failing lifecycle tests for immediate plus delayed refresh and cumulative stream tag de-duplication.
- [ ] Implement one debounced navigation refresh path shared by chat-changed and chat-created signals.
- [ ] Parse only complete stream tags and send only newly appended matches to the overlay; clear stream state on navigation and generation end.
- [ ] Re-run `st-extension/src/index.test.ts`.

### Task 3: Reversible new-variable block hiding

**Files:** `st-extension/src/apps/newvar/config.ts`, `st-extension/src/apps/newvar/config.test.ts`, `st-extension/src/apps/newvar-app.ts`, `st-extension/src/message-postprocess.ts`, `st-extension/src/message-postprocess.test.ts`

- [ ] Add `hideUpdateBlocks: boolean` with a normalized default of `true` and a phone App toggle.
- [ ] Add failing post-process tests proving visible text hides complete update blocks without changing stored message text and restores them when disabled.
- [ ] Implement a text-node-safe DOM marker path using `textContent`; do not mutate `chat[].mes`.
- [ ] Run focused config and post-process tests.

### Task 4: Display semantics and upload controls

**Files:** `st-extension/src/apps/sprite-app.ts`, `st-extension/src/message-postprocess.ts`, `st-extension/src/message-postprocess.test.ts`, `st-extension/style.css`, `st-extension/src/sprite-manager.test.ts`

- [ ] Add a failing test proving inline sprite images never receive opacity styles.
- [ ] Remove inline opacity application and update copy to say overlay opacity.
- [ ] Relabel story-image parsing and add a help hint using the existing widgets.
- [ ] Give `.so-upload-actions` its own non-wrapping flex layout and stable button dimensions; add a DOM/class regression assertion.
- [ ] Run focused tests, typecheck, and lint.

