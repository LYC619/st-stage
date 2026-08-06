# STS UX and Performance Implementation Plan

> **For agentic workers:** Execute task-by-task with TDD checkpoints. Keep the ignored session plan at `.planning/ux-performance-2026-08-07/` synchronized after each phase.

**Goal:** Make Renderer V1 discoverable to new users and add a reproducible ST distribution export without bundling the uncleaned 173 MiB reference image set.

**Architecture:** Keep Renderer behavior and persisted settings unchanged. Add a pure DOM onboarding/status layer inside `renderer-app.ts`, using existing widgets and deriving all status from `RendererSettings`. Extend `buildExtension` with an optional output-root export that copies only the ST manifest and generated runtime artifacts; retain the repository-root build as the compatibility path. Treat remote sprites as a later manifest/localization feature, not as this batch's runtime dependency.

**Tech Stack:** TypeScript, native DOM, Vitest/jsdom, esbuild, pnpm scripts, committed deterministic extension artifacts.

---

### Task 1: Add failing Renderer onboarding tests

**Files:**
- Modify: `st-extension/src/apps/renderer-app.test.ts`
- Reference: `st-extension/src/apps/renderer-app.ts`, `st-extension/src/apps/renderer/config.ts`

- [ ] **Step 1: Test the disabled first-use surface**

Add a test that mounts the App with default settings and asserts:

```ts
expect(container.querySelector('.renderer-quick-start')).not.toBeNull()
expect(container.querySelector('.renderer-status')?.textContent).toContain('未启用')
expect(container.querySelectorAll('.renderer-quick-step')).toHaveLength(3)
expect(container.querySelector('.renderer-mode-guide')).not.toBeNull()
```

Find the action by its button text and assert it is present only while disabled.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' run st-extension/src/apps/renderer-app.test.ts
```

Expected: the new assertions fail because the current App renders no onboarding/status nodes.

- [ ] **Step 3: Test the recommendation action contract**

Mount with a custom setting such as `{ cardsEnabled: false, battleEnabled: true }`, click `启用推荐设置`, and assert:

```ts
expect(getData()).toMatchObject({ enabled: true, cardsEnabled: false, battleEnabled: true })
expect(runtime.reprocessAll).toHaveBeenCalledTimes(1)
expect(injectPrompt.mock.calls.at(-1)?.[0]).toContain('ST Stage 结构化渲染协议')
```

This proves the action changes only the Renderer total switch while retaining the user's mode preferences.

- [ ] **Step 4: Test the no-mode warning**

Mount with `enabled: true` and all three mode flags false. Assert the status contains `没有启用模式` and the prompt channel receives an empty string. This captures the configuration state that otherwise looks enabled but cannot produce a protocol prompt.

- [ ] **Step 5: Run the focused test and confirm all new tests are RED for the missing behavior**

Run the same Vitest command. Fix only test setup errors if present; do not alter production code before the intended missing-node assertions fail.

### Task 2: Implement the Renderer onboarding surface

**Files:**
- Modify: `st-extension/src/apps/renderer-app.ts`
- Modify: `st-extension/src/apps/renderer-app.test.ts`
- Modify: `st-extension/style.css`

- [ ] **Step 1: Add pure UI helper functions**

In `renderer-app.ts`, add helpers that accept `RendererSettings` and return DOM nodes:

```ts
function rendererStatus(settings: RendererSettings): HTMLElement
function quickStart(): HTMLElement
function modeGuide(): HTMLElement
```

Use `textContent` for all copy. Use existing `foldSection` for mode/troubleshooting detail and `appButton` for the action. The status text must have three branches: disabled, enabled with at least one mode, and enabled with no mode.

- [ ] **Step 2: Add the recommendation action through the existing save path**

Render `appButton('启用推荐设置', () => save({ ...current, enabled: true }))` only when `current.enabled` is false. Do not change the mode flags, injection depth, typewriter setting, or reduced-motion setting. Keep `save` as the only persistence/prompt/reprocess path.

- [ ] **Step 3: Compose onboarding before the existing settings sections**

Append the quick-start block, status block, and mode guide before the existing `状态`/`模式`/`行为` sections. Preserve all existing labels and controls so current settings tests remain valid.

- [ ] **Step 4: Add compact responsive styles**

Add only `renderer-` prefixed rules to `st-extension/style.css` for the guide, status, steps, and mode rows. Keep the phone page dense, ensure long Chinese/English labels wrap, and keep the action at a stable minimum height. Reuse `.so-app-desc` for secondary copy.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' run st-extension/src/apps/renderer-app.test.ts
```

Expected: all Renderer App tests pass, including the original persistence/prompt tests and the new onboarding tests.

### Task 3: Add the generated ST distribution export contract

**Files:**
- Modify: `st-extension/build.mjs`
- Modify: `st-extension/build.test.ts`
- Modify: `package.json`
- Create: `st-extension/distribution-readme.md`

- [ ] **Step 1: Add a failing separate-output build test**

Extend the build fixture with `st-extension/distribution-readme.md`, create a second temporary `outputRoot`, and call:

```ts
await buildExtension({ sourceRoot: root, outputRoot, env: fixedEnv, logLevel: 'silent', log: () => {} })
```

Assert that `outputRoot` contains exactly `manifest.json`, `README.md`, `index.js`, `bundle.js`, `style.css`, and `version.json`; assert `manifest.json` matches the source manifest, `README.md` contains the distribution boundary text, and `public`/`reference` are absent.

- [ ] **Step 2: Run the focused build test and confirm RED**

Run:

```powershell
& '.\node_modules\.bin\vitest.cmd' run st-extension/build.test.ts
```

Expected: the new export assertions fail because the current build does not copy the manifest/readme or create the output directory.

- [ ] **Step 3: Implement output-root preparation and metadata copy**

In `build.mjs`:

1. Import `copyFileSync` and `mkdirSync` from `node:fs`.
2. Call `mkdirSync(outputRoot, { recursive: true })` before esbuild writes.
3. When `path.resolve(outputRoot) !== path.resolve(sourceRoot)`, copy `manifest.json` to the output and copy `st-extension/distribution-readme.md` to `README.md`.
4. Leave the root-output path unchanged.
5. Add a `--output-root <directory>` CLI parser for the direct script invocation; resolve the argument from `process.cwd()` and throw a clear error when the value is absent.

- [ ] **Step 4: Add the package script and source README**

Add:

```json
"build:st": "node st-extension/build.mjs --output-root st-distribution"
```

Create `st-extension/distribution-readme.md` explaining that `st-distribution/` is generated ST install output, that source lives in `st-extension/` and `core/`, and that reference images are intentionally excluded.

- [ ] **Step 5: Run the focused build test and verify GREEN**

Run the same build test command. Confirm the existing deterministic root-output tests still pass.

### Task 4: Generate and inspect the ST export

**Files:**
- Create/update generated: `st-distribution/manifest.json`
- Create/update generated: `st-distribution/README.md`
- Create/update generated: `st-distribution/index.js`
- Create/update generated: `st-distribution/bundle.js`
- Create/update generated: `st-distribution/style.css`
- Create/update generated: `st-distribution/version.json`

- [ ] **Step 1: Build the root compatibility artifacts with a fixed timestamp**

Run with an explicit valid build time, then inspect the version stamp and artifact diff. This keeps generated output reproducible.

- [ ] **Step 2: Build the optional distribution export**

Run:

```powershell
$env:ST_STAGE_BUILD_TIME = '2026-08-07 09:00'
& '.\node_modules\.bin\pnpm.cmd' run build:st
```

Expected: `st-distribution/` contains only the six declared distribution files, with no `reference/` or `public/` copy.

- [ ] **Step 3: Inspect generated contents**

Verify `st-distribution/manifest.json` has the product manifest, `version.json` has the fixed suffix, `index.js` remains the stable loader, and `style.css` includes both extension and phone-shell rules.

### Task 5: Update documentation and maintenance handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/APP-SPEC.md`
- Modify: `docs/maintenance/CURRENT.md`
- Create: `docs/maintenance/history/2026-08-07-ux-distribution-review.md`
- Modify: `docs/maintenance/DEFERRED.md`

- [ ] **Step 1: Document the new-user Renderer path**

Add the actual phone path, the three steps, the mode meanings, the recommendation action, and the fact that a normal reply without a valid render block remains unchanged.

- [ ] **Step 2: Document source/output ownership**

State that `st-extension/` is source, repository root is compatibility output, and `st-distribution/` is an optional generated export. State that `reference/新内置图片` is not shipped.

- [ ] **Step 3: Record deferred image work**

Add the baked-checkerboard cleanup, remote catalog host selection, manifest normalization, and local/server download behavior as separate deferred items with their measured 143-file/181,125,118-byte baseline.

- [ ] **Step 4: Record fresh verification evidence**

Update `CURRENT.md` only after the code/build commit exists; distinguish focused automated tests from the still-open real ST manual acceptance items.

### Task 6: Complete verification

**Files:**
- No source changes; inspect Git and generated artifacts.

- [ ] **Step 1: Run focused Renderer and build tests**

```powershell
& '.\node_modules\.bin\vitest.cmd' run st-extension/src/apps/renderer-app.test.ts st-extension/build.test.ts
```

- [ ] **Step 2: Run typecheck and lint**

```powershell
& '.\node_modules\.bin\pnpm.cmd' run typecheck
& '.\node_modules\.bin\pnpm.cmd' run lint
```

- [ ] **Step 3: Run the existing mobile E2E suite**

```powershell
& '.\node_modules\.bin\pnpm.cmd' run test:mobile
```

- [ ] **Step 4: Check deterministic artifacts and whitespace**

Use the fixed-time root/distribution builds, compare hashes for repeated builds, run `git diff --check`, and verify `git status --short --branch` before any commit.

- [ ] **Step 5: Commit the completed batch**

Stage only the source, tests, docs, and generated export artifacts belonging to this batch. Use a message such as `feat: improve renderer onboarding and ST export boundary`.

