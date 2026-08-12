# Third Real-ST Acceptance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the third real SillyTavern acceptance failures while preserving raw chat data, eliminating duplicate preset packs, and making resource/display behavior explicit and reversible.

**Architecture:** Keep protocol parsing and preset merging in pure core modules, inject raw ST message access into the DOM postprocessor, and make the gallery consume a merged runtime pack view plus a separately persisted preset override map. Runtime event wiring remains centralized in `index.ts`; UI code delegates state transitions to tested helpers.

**Tech Stack:** TypeScript 5.7, browser DOM APIs, SillyTavern 1.18.0 event contracts, Vitest/jsdom, CSS, esbuild, Playwright.

---

### Task 1: Message update lifecycle and independent tag visibility

**Files:**
- Modify: `st-extension/src/message-postprocess.ts`
- Modify: `st-extension/src/message-postprocess.test.ts`

- [ ] **Step 1: Write failing lifecycle and inline-label tests**

Add tests that register handlers by event name and prove `MESSAGE_UPDATED` invokes both the generic postprocessor and Renderer hook after ST replaces `.mes_text`. Add separate assertions for `inline` and `both`: hiding off leaves `[立绘:微笑]` visible and inserts one image; hiding on inserts one image without the tag.

```ts
expect(handlers.get('updated')).toBeTypeOf('function')
mesText(0).textContent = '编辑后 [立绘:微笑]'
handlers.get('updated')?.(0)
await Promise.resolve()
expect(processMessage).toHaveBeenCalledWith(mesText(0))

processMessages(baseSettings({ spriteDisplayMode: 'inline', hideTagInMessage: false }), 0)
expect(mesText(0).textContent).toContain('[立绘:微笑]')
expect(mesText(0).querySelectorAll('.so-inline-sprite')).toHaveLength(1)
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run st-extension/src/message-postprocess.test.ts`

Expected: FAIL because `MESSAGE_UPDATED` is not registered and inline rendering removes the raw tag.

- [ ] **Step 3: Implement the minimal lifecycle and insertion behavior**

Include `ctx.eventTypes?.MESSAGE_UPDATED` in the deduplicated rendered-event set. In the tag replacement callback, return `raw + marker(image)` when `hideTagInMessage` is false, otherwise return only the marker. Preserve the current unmatched-tag behavior.

- [ ] **Step 4: Verify GREEN and commit**

Run: `pnpm vitest run st-extension/src/message-postprocess.test.ts`

Expected: PASS.

Commit: `fix: reprocess edited messages and preserve visible sprite tags`

### Task 2: Safe hiding of ST-sanitized variable blocks

**Files:**
- Modify: `st-extension/src/message-postprocess.ts`
- Modify: `st-extension/src/message-postprocess.test.ts`
- Modify: `st-extension/src/index.ts`
- Modify: `st-extension/src/index.test.ts`

- [ ] **Step 1: Write failing tests for raw-message-assisted hiding**

Extend `PostprocessDeps` in the test's desired API with `getRawMessage(messageId): string | null`. Build visible DOM where DOMPurify has removed `<UpdateVariable>` and `<Analysis>` but retained their content. Assert the unique block content is hidden, duplicate visible content is not removed, and disabling the setting restores the original DOM.

```ts
mountMessagePostprocess({
  getSettings: () => settings,
  getRawMessage: () => '正文\n<UpdateVariable><Analysis>检查</Analysis>[{"op":"replace","path":"/好感","value":1}]</UpdateVariable>\n结尾',
})
handlers.get('rendered')?.(0)
await Promise.resolve()
expect(mesText(0).textContent).toBe('正文\n结尾')
```

Add an `index.test.ts` assertion that `mountMessagePostprocess` receives a getter backed by the adapter/chat context rather than reading `window.SillyTavern` from the DOM module.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run st-extension/src/message-postprocess.test.ts st-extension/src/index.test.ts`

Expected: FAIL because no raw-message dependency or sanitized-block mapping exists.

- [ ] **Step 3: Implement deterministic text mapping**

Add a helper that extracts complete update blocks from raw text, strips known protocol tags, normalizes consecutive whitespace while retaining offsets, and returns a visible range only when exactly one match exists. Keep the getter on each registered `PostprocessDeps`; `processMessages` receives the matching controller only for event-driven work, while full reprocessing consults registered controllers. Wire `getRawMessage` in `index.ts` to `STAdapter.getRawMessage(messageId)`.

Safety invariants:

```ts
if (rawBlocks.length !== 1 || visibleMatches.length !== 1) return []
// Never delete when mapping is ambiguous.
```

- [ ] **Step 4: Verify GREEN and commit**

Run: `pnpm vitest run st-extension/src/message-postprocess.test.ts st-extension/src/index.test.ts`

Expected: PASS.

Commit: `fix: hide sanitized variable records from raw message evidence`

### Task 3: Conservative bare Renderer JSON recovery

**Files:**
- Modify: `st-extension/src/apps/renderer/parser.ts`
- Modify: `st-extension/src/apps/renderer/parser.test.ts`
- Modify: `st-extension/src/apps/renderer/prompt.ts`
- Modify: `st-extension/src/apps/renderer/prompt.test.ts`
- Modify: `st-extension/src/apps/renderer/runtime.test.ts`

- [ ] **Step 1: Write failing parser and prompt tests**

Cover a single Gal/Cards/Battle object mixed with prose, braces and escaped quotes inside strings, two valid objects, a partial `<STStageRender>` tag, oversized JSON, and unrelated JSON. Require `raw` to equal only the accepted JSON slice.

```ts
const source = `前文\n${JSON.stringify(validGal)}\n后文`
expect(parseRendererBlock(source)).toMatchObject({ ok: true, raw: JSON.stringify(validGal) })
expect(parseRendererBlock(`${JSON.stringify(validGal)}\n${JSON.stringify(validGal)}`))
  .toMatchObject({ ok: false, found: false })
```

Require the generated prompt to contain “不得只输出裸 JSON” and all examples to remain parseable.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run st-extension/src/apps/renderer/parser.test.ts st-extension/src/apps/renderer/prompt.test.ts st-extension/src/apps/renderer/runtime.test.ts`

Expected: FAIL because bare JSON currently returns `found=false`.

- [ ] **Step 3: Implement a string-aware object scanner**

Scan source character-by-character, tracking quote, escape, and brace depth. Parse each balanced object under 64 KiB, pass it to the existing `validateBlock`, and accept only when exactly one candidate validates. If either wrapper tag token appears, skip fallback and retain current wrapper error semantics.

- [ ] **Step 4: Verify GREEN and commit**

Run the focused Renderer tests above.

Expected: PASS.

Commit: `fix: recover unique valid renderer json without wrapper tags`

### Task 4: Versioned preset override model and migrations

**Files:**
- Modify: `core/types.ts`
- Modify: `core/migrate.ts`
- Modify: `core/migrate.test.ts`
- Modify: `core/presets.ts`
- Modify: `core/presets.test.ts`
- Modify: `st-extension/src/st-adapter.ts`
- Modify: `st-extension/src/st-adapter.test.ts`
- Modify: `lib/web-adapter.ts`

- [ ] **Step 1: Write failing type/migration/merge tests**

Define the expected `PresetPackOverride` behavior in tests: metadata `null` clears optional values, missing values follow current presets, local paths override `url`, current preset URLs refresh `remoteUrl`, added current sprites appear, removed sprites disappear, invalid paths are ignored, and settings v5 migrates folding to true.

Add strict old-copy migration coverage using the five conditions from the spec and a near-match that must remain custom.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run core/migrate.test.ts core/presets.test.ts st-extension/src/st-adapter.test.ts`

Expected: FAIL because settings v6 and preset overrides do not exist.

- [ ] **Step 3: Implement pure preset functions and v6 migration**

Add:

```ts
export interface PresetPackOverride { metadata?: PresetMetadataOverride; localSprites?: Record<string, string>; updatedAt?: string }
export function presetSpriteKey(sprite: Sprite): string
export function mergePresetPacks(overrides: Record<string, PresetPackOverride>): SpritePack[]
export function migrateLegacyPresetCopies(settings: PluginSettings): PluginSettings
```

Set `SETTINGS_VERSION = 6`, default `galleryFoldByRole = true`, and default `presetOverrides = {}`. Migrate v5's old default `false` to true; preserve explicit values saved at v6 onward. Sanitize override metadata and local paths.

- [ ] **Step 4: Persist only custom packs plus overrides**

`STAdapter.loadSettings` merges current presets and overrides before custom packs. `saveSettings` filters generated preset runtime packs but retains `presetOverrides`. Keep Web adapter behavior structurally compatible.

- [ ] **Step 5: Verify GREEN and commit**

Run focused tests plus `pnpm typecheck`.

Expected: PASS.

Commit: `feat: add persistent same-id preset overrides`

### Task 5: In-place preset localization and editable metadata

**Files:**
- Create: `core/preset-overrides.ts`
- Create: `core/preset-overrides.test.ts`
- Modify: `st-extension/src/sprite-manager.ts`
- Modify: `st-extension/src/sprite-manager.test.ts`

- [ ] **Step 1: Write failing pure transition tests**

Specify helpers that record one localized preset sprite, update preset metadata overrides, and clear metadata overrides without clearing local sprites. Assert pack ID, pack count, and bindings are unchanged.

```ts
const next = setPresetLocalSprite(settings, presetId, sprite, '/user/images/local.webp')
expect(next.packs).toHaveLength(settings.packs.length)
expect(next.bindings[0].packIds).toEqual([presetId])
expect(next.presetOverrides[presetId].localSprites?.[presetSpriteKey(sprite)])
  .toBe('/user/images/local.webp')
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run core/preset-overrides.test.ts st-extension/src/sprite-manager.test.ts`

Expected: FAIL because localization creates a duplicate and preset metadata is read-only.

- [ ] **Step 3: Implement pure override transitions**

Keep merge/materialization in `presets.ts`; keep user state transitions in the new focused module. Every transition returns updated settings with a re-materialized same-ID runtime preset.

- [ ] **Step 4: Rewire gallery actions**

Replace the preset-copy branch in `localizeSelectedPacks` with per-sprite override commits. Show the package metadata form for presets, persist edits into overrides, hide destructive sprite actions, and add “恢复内置信息” with explicit confirmation.

- [ ] **Step 5: Verify GREEN and commit**

Run focused tests.

Expected: PASS; the old “（本地）” assertion is replaced by same-ID expectations.

Commit: `feat: localize and edit presets in place`

### Task 6: Resource badges, folding state, and batch layout

**Files:**
- Create: `core/sprite-resources.ts`
- Create: `core/sprite-resources.test.ts`
- Modify: `st-extension/src/sprite-manager.ts`
- Modify: `st-extension/src/sprite-manager.test.ts`
- Modify: `st-extension/style.css`

- [ ] **Step 1: Write failing status and DOM tests**

Table-test hosted-only, local-only, dual, and partial packs. Require card resource chips in `.so-card-resource-status`, batch mode class/banner, and non-overlapping semantic positions: check at top-right or dedicated batch corner, active badge left, preset top-right only outside batch, resources bottom-right.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run core/sprite-resources.test.ts st-extension/src/sprite-manager.test.ts`

Expected: FAIL because resource summaries and chips do not exist.

- [ ] **Step 3: Implement resource summaries and card UI**

Expose a pure result:

```ts
interface PackResourceSummary { total: number; local: number; cloud: number }
```

Render complete or fractional labels from this result. Keep normal role folding and explicit batch flattening. Add `.so-manager-batch-mode` and CSS grid/absolute positions that cannot overlap at desktop or mobile widths.

- [ ] **Step 4: Verify GREEN and commit**

Run focused tests and `pnpm lint`.

Commit: `feat: show gallery resource state and clarify batch mode`

### Task 7: Legacy prompt recognition and real preset address matrix

**Files:**
- Modify: `core/prompt-builder.ts`
- Modify: `core/prompt-builder.test.ts`
- Modify: `core/migrate.ts`
- Modify: `core/migrate.test.ts`
- Modify: `core/address-match.test.ts`

- [ ] **Step 1: Write failing exact-template tests**

Add the exact historical “表情” template from commit `b75214d` as a fixture. Assert it receives the same compact output as an empty template, migrates to the current built-in value, and a one-character user modification remains unchanged.

Add a Seraphina matrix using `getPresetPacks()` for `[立绘:图名]`, `[立绘:服装/图名]`, full addresses, wrong coordinates, and a localized same-ID merge.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run core/prompt-builder.test.ts core/migrate.test.ts core/address-match.test.ts`

- [ ] **Step 3: Implement exact known-template recognition**

Export `LEGACY_BUILTIN_TEMPLATES` and `isKnownBuiltinTemplate(template)`. Use exact normalized line-ending comparison only. Replace current `custom !== BUILTIN_TEMPLATE.trim()` condition and normalize known templates during migration.

- [ ] **Step 4: Verify GREEN and commit**

Run focused tests.

Commit: `fix: migrate legacy builtin sprite prompts`

### Task 8: Opacity slider and overlay shortcut

**Files:**
- Modify: `st-extension/src/apps/widgets.ts`
- Modify: `st-extension/src/apps/widgets.test.ts`
- Modify: `st-extension/src/apps/sprite-app.ts`
- Modify: `st-extension/src/apps/sprite-app.test.ts`
- Modify: `st-extension/src/overlay-dom.ts`
- Create: `st-extension/src/overlay-dom.test.ts`
- Modify: `st-extension/src/index.ts`
- Modify: `st-extension/src/index.test.ts`
- Modify: `st-extension/style.css`

- [ ] **Step 1: Write failing slider and shortcut tests**

Specify `rangeRow(label, value, min, max, onInput, onCommit)` with a stable output element. Assert `input` updates percent/readout and `change` commits. For overlay, assert a button with `aria-label="打开立绘 App"` invokes the supplied callback without starting drag.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run st-extension/src/apps/widgets.test.ts st-extension/src/apps/sprite-app.test.ts st-extension/src/overlay-dom.test.ts st-extension/src/index.test.ts`

- [ ] **Step 3: Implement and wire controls**

Use `input[type=range]`, no viewport-scaled typography, and fixed button hit areas. Extend `createOverlay` with `onOpenSprites`, pass `() => phone.openApp('sprites')` after phone construction through a late-bound callback, and keep gear/close behavior unchanged.

- [ ] **Step 4: Verify GREEN and commit**

Run focused tests, `pnpm typecheck`, and `pnpm lint`.

Commit: `feat: add sprite opacity slider and overlay app shortcut`

### Task 9: Full verification, artifacts, and maintenance handoff

**Files:**
- Modify: `version.json`
- Modify generated root artifacts
- Modify generated `st-distribution/` artifacts
- Modify: `docs/maintenance/CURRENT.md`
- Create: `docs/maintenance/history/2026-08-12-acceptance-round3.md`

- [ ] **Step 1: Run complete automated gates**

Run:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:mobile
node --test st-extension/build.test.mjs
git diff --check
```

Expected: all pass. Do not convert these into real-ST evidence.

- [ ] **Step 2: Refresh the build stamp and build twice**

Use the repository's fixed-stamp builder flow. Build root and `st-distribution/`, verify shared artifact hashes match, and verify distribution remains six install files with no images, `public/`, `reference/`, or preset source.

- [ ] **Step 3: Update maintenance evidence**

Record the code head, build version, exact automated results, resolved acceptance findings, and the ten next real-ST checks from the design. Mark API as maintainer-smoke-tested without overstating provider coverage. Keep product semantic version at `0.9.0`.

- [ ] **Step 4: Commit the batch**

Commit: `docs: record third acceptance repair verification`
