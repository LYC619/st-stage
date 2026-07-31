# Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver six review fixes as independently testable and reviewable commits without changing unrelated behavior.

**Architecture:** Shared invariants are enforced at the lowest common utility, stateful browser operations are serialized or explicitly disposed, and large galleries cap only rendered DOM while retaining complete data. The existing UI, storage schema, App context, and SillyTavern integration contracts remain intact.

**Tech Stack:** TypeScript 5.7, Vitest 4 with jsdom, native DOM, esbuild, pnpm 10, GitHub Actions.

---

## Per-Batch Verification Gate

For each implementation batch, run the focused test first, then:

```powershell
pnpm test
pnpm typecheck
pnpm lint
git diff --check
```

For batches 1 through 6, also run:

```powershell
pnpm build:ext
```

Inspect `git status --short` before staging. Stage only the current batch, review `git diff --cached --stat` and `git diff --cached`, then commit. If any verification fails, diagnose and fix that batch before staging or proceeding.

### Task 0: Freeze the Review Contract

**Problem and consequence:** Six cross-cutting fixes lack a committed scope and acceptance contract; implementation could drift or mix unrelated changes.

**Result:** Two documents define behavior, file boundaries, failure semantics, RED/GREEN evidence, verification, and commit order.

**Files:**
- Create: `docs/superpowers/specs/2026-07-31-review-fixes-design.md`
- Create: `docs/superpowers/plans/2026-07-31-review-fixes.md`

- [ ] **Step 1: Confirm the baseline**

Run:

```powershell
git branch --show-current
git status --short --branch
git rev-parse --short HEAD
```

Expected: `codex/review-fixes`, no changed files before writing docs, and `9451fc0`.

- [ ] **Step 2: Self-review both documents**

Check that every batch states the problem, consequence, expected behavior, files, error handling, and acceptance conditions. Search for incomplete placeholders:

```powershell
rg -n "TB[D]|TO[D]O|implement[ ]later|fill[ ]in" docs/superpowers/specs/2026-07-31-review-fixes-design.md docs/superpowers/plans/2026-07-31-review-fixes.md
```

Expected: no matches.

- [ ] **Step 3: Verify and commit documentation only**

Run the per-batch verification gate without `build:ext`, then:

```powershell
git add docs/superpowers/specs/2026-07-31-review-fixes-design.md docs/superpowers/plans/2026-07-31-review-fixes.md
git commit -m "docs: plan review fix batches"
```

Expected: one documentation-only commit.

### Task 1: Reject Dangerous Variable Paths

**Problem and consequence:** Nested path traversal follows JavaScript prototype properties, allowing object prototype pollution from configuration, designer input, AI Patch, manual editing, and MVU callers.

**Result:** All shared nested read/write/delete calls reject `__proto__`, `prototype`, and `constructor` segments while preserving paths such as `状态.体力`.

**Files:**
- Create: `st-extension/src/apps/path-utils.test.ts`
- Modify: `st-extension/src/apps/path-utils.ts`
- Verify integration through: `st-extension/src/apps/newvar/engine.test.ts`

- [ ] **Step 1: Write the failing path tests**

Cover `splitPath`, `getNested`, `setNested`, and `deleteNested`. The core pollution assertion is:

```ts
const target: Record<string, unknown> = {}
setNested(target, '__proto__.pollutedByPath', true)
expect(({} as Record<string, unknown>).pollutedByPath).toBeUndefined()
```

Repeat with `safe.constructor.prototype.pollutedByPath` and `safe.prototype.pollutedByPath`, and assert normal `状态.体力` read/write/delete behavior.

- [ ] **Step 2: Verify RED**

```powershell
pnpm exec vitest run st-extension/src/apps/path-utils.test.ts
```

Expected: pollution or dangerous-segment assertions fail because `splitPath` currently accepts all non-empty segments.

- [ ] **Step 3: Implement the lowest common guard**

Add one forbidden-segment set in `path-utils.ts`. Make `splitPath` return `[]` whenever any parsed segment is forbidden so existing empty-path behavior makes reads undefined and writes/deletes no-ops. Do not duplicate checks in newvar or MVU.

- [ ] **Step 4: Verify GREEN and all entry paths**

```powershell
pnpm exec vitest run st-extension/src/apps/path-utils.test.ts st-extension/src/apps/newvar/engine.test.ts
```

Expected: all focused tests pass and the pollution marker remains absent after every case.

- [ ] **Step 5: Run the full gate and commit**

Commit message:

```powershell
git commit -m "fix: reject unsafe variable paths"
```

### Task 2: Restore Temporary API Keys Atomically

**Problem and consequence:** `fetchModels` skips restoration for an empty prior key, resolves before non-empty restoration finishes, and allows concurrent calls to interleave credential writes.

**Result:** Each model lookup serializes the complete temporary-key transaction and settles only after restoration, including restoration to `''`.

**Files:**
- Create: `st-extension/src/apps/api/bridge.test.ts`
- Modify: `st-extension/src/apps/api/bridge.ts`

- [ ] **Step 1: Build a jsdom bridge fixture**

Install a minimal `window.SillyTavern.getContext()`, optional `#api_key_custom`, and a fetch mock that records parsed bodies for `/api/secrets/write` and returns a model status JSON response. Reset the DOM and mocks after each test.

- [ ] **Step 2: Write and verify the empty-key RED test**

Call `fetchModels('https://one.example', 'temporary', '')` and assert secret values equal:

```ts
expect(secretValues).toEqual(['temporary', ''])
```

Run:

```powershell
pnpm exec vitest run st-extension/src/apps/api/bridge.test.ts
```

Expected: only `temporary` is written because the current `finally` requires a truthy prior key.

- [ ] **Step 3: Add await and failure RED tests**

Hold the restore fetch promise unresolved and assert the `fetchModels` promise is still pending. Reject or return HTTP failure from the model request and assert restoration is still attempted before rejection. Add a restoration-failure assertion matching the specified failure policy.

- [ ] **Step 4: Add the concurrency RED test**

Start two calls without awaiting the first. Hold the first status request and assert the second temporary secret write has not started. After releasing the first status and restore, assert the second transaction begins. Expected write order:

```ts
expect(secretValues).toEqual(['key-one', 'original', 'key-two', 'original'])
```

- [ ] **Step 5: Implement the serialized transaction**

Use a module-local promise tail. Each call schedules a private function containing temporary write, model fetch, and awaited restore in `finally`. Advance the tail with a rejection-swallowing continuation so one failed lookup does not poison later queue entries. Restore whenever a temporary value was written, not only when the prior value is truthy.

- [ ] **Step 6: Verify GREEN, run the full gate, and commit**

Focused command:

```powershell
pnpm exec vitest run st-extension/src/apps/api/bridge.test.ts st-extension/src/apps/api/core.test.ts
```

Commit message:

```powershell
git commit -m "fix: restore temporary API keys atomically"
```

### Task 3: Finalize Every Upload Run

**Problem and consequence:** Conflict and exception exits can skip upload cleanup, repeated clicks can start duplicate work, and post-persistence UI failures can misreport successful imports.

**Result:** One guarded upload run records success, conflict, failure, and unprocessed counts, preserves committed images, and always restores the UI.

**Files:**
- Modify: `st-extension/src/sprite-manager.ts`
- Modify: `st-extension/src/sprite-manager.test.ts`

- [ ] **Step 1: Add deterministic upload dependencies to the existing fixture**

Use fake `File` objects and the existing adapter fixture. Mock only unavoidable browser/storage boundaries such as compression and `adapter.saveImage`; keep `createSpriteManager` and DOM events real.

- [ ] **Step 2: Write the duplicate-click RED test**

Open a pack, enter direct upload, click `开始上传` twice while the first save is held, and assert only one save sequence begins and the action is disabled or ignored.

- [ ] **Step 3: Write conflict/finalization RED tests**

Create a plan where the first image can be committed and the second causes a binding conflict. Assert the first sprite remains in settings, the upload overlay closes, running state clears, and summary text reports one success, one conflict, zero failures, and the exact unprocessed count.

- [ ] **Step 4: Write post-persistence UI failure RED test**

Make the settings update complete, then make the following render or notification boundary throw. Assert the stored sprite remains and the summary does not classify that image as import failure.

- [ ] **Step 5: Implement one guarded `try/finally` workflow**

Add a closure-local `uploading` flag and a result record `{ success, conflict, failed, unprocessed }`. Disable/ignore the entry while active. Move every exit through `finally`, persist before UI refresh, and isolate final render/notification errors from import accounting. Do not roll back prior successful entries.

- [ ] **Step 6: Verify GREEN, run the full gate, and commit**

Focused command:

```powershell
pnpm exec vitest run st-extension/src/sprite-manager.test.ts
```

Commit message:

```powershell
git commit -m "fix: finalize interrupted sprite uploads"
```

### Task 4: Dispose All Platform-Owned Resources

**Problem and consequence:** Reload disposal omits several listeners, DOM mounts, Prompt channels, and delayed jobs; normally closed modal handles remain tracked.

**Result:** A second bundle execution fully disposes the prior instance, while modal resource ownership remains with the cleanup returned by `build`.

**Files:**
- Modify: `core/app-modal.ts`
- Modify: `core/app-modal.test.ts`
- Modify: `core/phone-registry.ts`
- Modify: `core/phone-registry.test.ts`
- Modify: `core/phone-shell.ts`
- Modify: `core/phone-shell.test.ts`
- Modify: `st-extension/src/index.ts`
- Modify as required by missing cleanup contracts: `st-extension/src/st-adapter.ts`, `st-extension/src/message-postprocess.ts`, `st-extension/src/settings-panel.ts`, `st-extension/src/sprite-manager.ts`, `st-extension/src/overlay-dom.ts`
- Add or modify the closest lifecycle tests for those modules.

- [ ] **Step 1: Add tracker unregistration RED coverage**

Extend the capability tracker API so `track(cleanup)` returns an untracking function that can optionally run the cleanup exactly once. Open a modal, close it normally, dispose the platform tracker, and assert modal cleanup and `onClose` each ran once rather than the tracker retaining an active close handle.

- [ ] **Step 2: Add duplicate-bootstrap RED coverage**

Use module isolation and fake top-level factories or a small exported bootstrap seam. Execute bootstrap twice. Assert the first instance releases message and character subscriptions, message postprocessing, Prompt channels, overlay, manager, phone shell, settings entry, dynamic style nodes, and delayed reprocessing before the second instance installs equivalents.

- [ ] **Step 3: Add idempotence and delayed-job tests**

Call the disposer twice and assert each owned cleanup runs once. Schedule character-change reprocessing, dispose, advance fake timers, and assert stale `reprocessAllMessages` does not run.

- [ ] **Step 4: Implement minimal cleanup contracts**

Return unsubscribe functions from adapter subscriptions and mount helpers. Add `destroy()` to manager only if needed, reusing its existing `close()` cleanup. Register `overlay.destroy`, `manager.destroy`, `phone.destroy`, settings/message-postprocess cleanup, subscriptions, timers, Prompt clearing, and dynamic style removal in one idempotent top-level disposer.

- [ ] **Step 5: Preserve modal lifecycle handoff**

Keep `openAppModal(build, hooks)` building one modal root. The function returned by `build(root)` owns inner resources. Wire normal close to both run that cleanup and unregister the tracked close handle. Do not create a modal-specific App context.

- [ ] **Step 6: Verify GREEN, run the full gate, and commit**

Focused command:

```powershell
pnpm exec vitest run core/app-modal.test.ts core/phone-registry.test.ts core/phone-shell.test.ts st-extension/src/message-postprocess.test.ts
```

Commit message:

```powershell
git commit -m "fix: dispose extension resources on reload"
```

### Task 5: Bound Sprite Gallery Rendering

**Problem and consequence:** A large pack creates every sprite card, layout object, and listener at once; native image lazy loading does not cap DOM work.

**Result:** The detail view renders 60 cards initially and at most 60 more per action while lightbox navigation retains the full sprite list.

**Files:**
- Modify: `st-extension/src/sprite-manager.ts`
- Modify: `st-extension/src/sprite-manager.test.ts`
- Modify only if required for the existing visual style: `st-extension/style.css`

- [ ] **Step 1: Write the 1,000-sprite RED test**

Build one pack with 1,000 unique sprites, open its detail view, and assert:

```ts
expect(document.querySelectorAll('.so-sprite-card')).toHaveLength(60)
expect(document.body.textContent).toContain('60/1000')
```

Also assert a load-more control exists. Run the focused test and expect 1,000 cards under current behavior.

- [ ] **Step 2: Add incremental and terminal tests**

Click load more once and expect 120 cards and `120/1000`. Repeatedly load to the end, assert no step adds more than 60, final count is 1,000, and the control disappears. Assert packs of 60 or fewer have no load-more control.

- [ ] **Step 3: Add full lightbox coverage**

Open the lightbox from a rendered card and navigate across the rendered boundary. Assert captions/URLs continue through sprite 61 and ultimately wrap through the complete 1,000-item array.

- [ ] **Step 4: Implement the 60-item rendering window**

Add `SPRITE_PAGE_SIZE = 60` and detail-view visible-count state. Render `pack.sprites.slice(0, visibleCount)`. The load-more action updates the count with `Math.min(total, visibleCount + SPRITE_PAGE_SIZE)` and re-renders. Reset when changing packs; clamp after deletions; pass the unsliced array to lightbox.

- [ ] **Step 5: Verify GREEN, run the full gate, and commit**

Focused command:

```powershell
pnpm exec vitest run st-extension/src/sprite-manager.test.ts
```

Commit message:

```powershell
git commit -m "perf: bound sprite gallery rendering"
```

### Task 6: Verify Committed Extension Artifacts in CI

**Problem and consequence:** CI rebuilds but never compares committed artifacts, and an always-current timestamp prevents deterministic comparison.

**Result:** A validated explicit timestamp makes builds reproducible; CI restores the committed timestamp and fails on any artifact drift.

**Files:**
- Modify: `st-extension/build.mjs`
- Modify: `.github/workflows/ci.yml`
- Create: `st-extension/build.test.ts` or a small importable build-time helper plus its test
- Regenerate: `index.js`
- Regenerate: `bundle.js`
- Regenerate: `style.css`
- Regenerate: `version.json`

- [ ] **Step 1: Write invalid-time RED tests**

Run the build in a temporary copied output location or test an extracted parser with values such as `2026-7-31 9:05`, `2026-02-30 12:00`, and an ISO value with seconds. Assert non-zero failure and, for an integration case, unchanged sentinel bytes in all four output files.

- [ ] **Step 2: Write deterministic-build RED coverage**

Run twice with `ST_STAGE_BUILD_TIME=2026-07-31 09:05` and identical sources. Compare hashes for `index.js`, `bundle.js`, `style.css`, and `version.json`; assert `version.json` contains the corresponding compact suffix and the bundle embeds the display timestamp.

- [ ] **Step 3: Implement parse-before-write behavior**

Read `process.env.ST_STAGE_BUILD_TIME`. If absent, retain `new Date().toLocaleString('sv-SE').slice(0, 16)`. If present, require exact `YYYY-MM-DD HH:mm` and a real local calendar minute by component validation. Complete validation before calling `build()` or any `writeFileSync`.

- [ ] **Step 4: Add the CI artifact check**

After the existing extension build prerequisite, extract the committed compact timestamp from `version.json`, convert it to `YYYY-MM-DD HH:mm`, export `ST_STAGE_BUILD_TIME`, run `pnpm build:ext`, then run:

```powershell
git diff --exit-code -- index.js bundle.js style.css version.json
```

The workflow shell is Ubuntu Bash, so implement extraction with Node rather than locale-dependent shell date parsing. Do not add `pnpm test:mobile`.

- [ ] **Step 5: Verify RED against an intentional source/artifact mismatch**

In the test fixture, change a source byte without rebuilding and confirm the comparison command fails. Restore the fixture through test teardown rather than touching tracked workspace files.

- [ ] **Step 6: Regenerate with the committed timestamp and verify GREEN**

Run the focused build tests, extract the current committed timestamp, rebuild with it, and run the four-file diff check twice. Then run the full verification gate.

- [ ] **Step 7: Commit the CI batch**

Commit message:

```powershell
git commit -m "ci: verify committed extension artifacts"
```

## Final Review Checklist

- [ ] Seven commits exist after `9451fc0`, ordered Task 0 through Task 6.
- [ ] Each commit contains only its documented file boundary plus generated extension artifacts where required.
- [ ] Fresh `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build:ext`, and `git diff --check` all exit zero.
- [ ] Fixed-time rebuild leaves `index.js`, `bundle.js`, `style.css`, and `version.json` unchanged.
- [ ] Working tree is clean.
- [ ] Handoff lists commit hash, solved issue, focused tests, full verification, and remaining real SillyTavern checks for each batch.
