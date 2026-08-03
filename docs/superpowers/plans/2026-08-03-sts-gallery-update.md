# STS Gallery Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make gallery preview mobile-safe and add manual localization, labels/search, prompt notes, numbered action compaction, story image capture, and role-based folding without rewriting existing pack identities or bindings.

**Architecture:** Extend the versioned core schema first, then keep pure metadata/story/prompt rules in `core`. Extract the lightbox and story capture from the manager into lifecycle-owned DOM modules. Existing pack IDs and sprite addresses remain authoritative; folding and filtering are presentation-only.

**Tech Stack:** TypeScript 5.7, native DOM, Vitest 4/jsdom, Playwright mobile projects, esbuild, pnpm 10.

---

## Per-Task Verification

For every task, run its focused test, then:

```powershell
pnpm test -- --reporter=dot
pnpm typecheck
pnpm lint
pnpm build:ext
git diff --check
```

Use the timestamp committed in `version.json` for deterministic `build:ext`. Inspect and stage only the task files plus changed generated artifacts.

### Task 1: Version Gallery Metadata

**Files:**
- Modify: `core/types.ts`
- Modify: `core/migrate.ts`
- Modify: `core/migrate.test.ts`
- Modify: `core/pack-io.ts`
- Modify: `core/pack-io.test.ts`

- [ ] **Step 1: Write failing migration and pack-file tests**

Add assertions equivalent to:

```ts
expect(migrateSettings({ settingsVersion: 3, packs: [] }).galleryFoldByRole).toBe(false)
expect(migrateSettings({
  settingsVersion: 4,
  galleryFoldByRole: true,
  packs: [{
    id: 'p', name: 'pack', promptNote: ' note ', promptNotePlacement: 'after-list',
    outfitNotes: { 居家服: ' home ' }, sourceStoryKey: ' story ',
    sprites: [{ tag: '挥手1', url: 'u', labels: [' 动作 ', '动作', ''] }],
  }],
}).packs[0]).toMatchObject({
  promptNote: 'note', promptNotePlacement: 'after-list',
  outfitNotes: { 居家服: 'home' }, sourceStoryKey: 'story',
  sprites: [{ labels: ['动作'] }],
})
```

Verify `sprite-pack@3` JSON export/import round-trips `labels`, `promptNote`, `promptNotePlacement`, and `outfitNotes`; `@1` and `@2` still import.

- [ ] **Step 2: Verify RED**

```powershell
pnpm exec vitest run core/migrate.test.ts core/pack-io.test.ts --reporter=dot
```

Expected: missing version-4 fields and unsupported `sprite-pack@3` failures.

- [ ] **Step 3: Implement the schema and normalization**

Add:

```ts
export const SETTINGS_VERSION = 4
export type PromptNotePlacement = 'before-list' | 'after-list'

export interface Sprite {
  labels?: string[]
}

export interface SpritePack {
  promptNote?: string
  promptNotePlacement?: PromptNotePlacement
  outfitNotes?: Record<string, string>
  sourceStoryKey?: string
}

export interface PluginSettings {
  galleryFoldByRole: boolean
}
```

Normalize labels to at most 24 unique, trimmed, 32-character values; normalize notes to 500 characters. Add `SpritePackFileV3` and make new exports use `sprite-pack@3`.

- [ ] **Step 4: Verify GREEN and commit**

Commit:

```powershell
git commit -m "feat: version gallery metadata"
```

### Task 2: Add Prompt Notes and Numbered Action Ranges

**Files:**
- Create: `core/sprite-metadata.ts`
- Create: `core/sprite-metadata.test.ts`
- Modify: `core/prompt-builder.ts`
- Modify: `core/prompt-builder.test.ts`
- Modify: `st-extension/src/index.ts`

- [ ] **Step 1: Write range-compaction RED tests**

Define the desired API:

```ts
expect(compactNumberedTags(['挥手1', '挥手2', '挥手3', '微笑'])).toEqual([
  { kind: 'range', label: '挥手1-3', values: ['挥手1', '挥手2', '挥手3'] },
  { kind: 'tag', label: '微笑', values: ['微笑'] },
])
expect(compactNumberedTags(['挥手1', '挥手2', '挥手4'])).toEqual([
  { kind: 'tag', label: '挥手1', values: ['挥手1'] },
  { kind: 'tag', label: '挥手2', values: ['挥手2'] },
  { kind: 'tag', label: '挥手4', values: ['挥手4'] },
])
```

Cover leading zeros, Unicode prefixes, mixed prefixes, duplicates, runs shorter than three, and descending source order.

- [ ] **Step 2: Write prompt-note RED tests**

Extend `buildPrompt` input to accept scene metadata:

```ts
interface PromptSceneNote {
  role: string
  outfit: string
  note: string
  placement: PromptNotePlacement
}
```

Assert `before-list` and `after-list` ordering, active-pack-only notes, outfit-note attachment, and that compact output explicitly says to emit one complete real tag rather than the range label.

- [ ] **Step 3: Verify RED and implement**

```powershell
pnpm exec vitest run core/sprite-metadata.test.ts core/prompt-builder.test.ts --reporter=dot
```

Build scenes from active packs in `index.ts`, preserving pack/binding order. Run compaction before prompt-budget fitting. Keep existing output byte-for-byte when no notes or compactable runs exist.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
git commit -m "feat: enrich sprite prompts"
```

### Task 3: Extract a Mobile-Safe Lightbox

**Files:**
- Create: `st-extension/src/sprite-lightbox.ts`
- Create: `st-extension/src/sprite-lightbox.test.ts`
- Modify: `st-extension/src/sprite-manager.ts`
- Modify: `st-extension/src/sprite-manager.test.ts`
- Modify: `st-extension/style.css`

- [ ] **Step 1: Write visual-viewport RED tests**

Use real DOM and a configurable `window.visualViewport` fixture. Assert the layer receives current `offsetLeft`, `offsetTop`, `width`, and `height`, updates on viewport resize, and unregisters listeners on close.

```ts
expect(layer.style.cssText).toContain('left: 0px')
expect(layer.style.cssText).toContain('top: 72px')
expect(layer.style.cssText).toContain('width: 390px')
expect(layer.style.cssText).toContain('height: 620px')
```

Assert image, caption, close, previous, next, and an action rail are all descendants of the viewport layer rather than the scroll body.

- [ ] **Step 2: Verify RED**

```powershell
pnpm exec vitest run st-extension/src/sprite-lightbox.test.ts st-extension/src/sprite-manager.test.ts --reporter=dot
```

- [ ] **Step 3: Implement the controller**

Expose:

```ts
export interface SpriteLightboxController {
  update(pack: SpritePack, index: number): void
  close(): void
}

export function openSpriteLightbox(options: {
  pack: SpritePack
  index: number
  readonly: boolean
  actions: SpriteLightboxAction[]
  onNavigate(index: number): void
  onClose(): void
}): SpriteLightboxController
```

Use stable 44 px controls, CSS safe-area padding, desktop right rail, and mobile bottom rail. Preserve full-list keyboard navigation and manager cleanup semantics.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
git commit -m "fix: keep sprite previews inside mobile viewport"
```

### Task 4: Share Lightbox and Grid Editing Actions

**Files:**
- Create: `st-extension/src/sprite-actions.ts`
- Create: `st-extension/src/sprite-actions.test.ts`
- Modify: `st-extension/src/sprite-manager.ts`
- Modify: `st-extension/src/sprite-lightbox.ts`
- Modify: `st-extension/src/sprite-manager.test.ts`

- [ ] **Step 1: Write RED tests for text actions and live refresh**

Assert the lightbox exposes text-labeled Rename, Labels, Group, Replace, Save locally, Remote address, Set cover, and Delete actions. Rename must update the caption without closing. Delete must navigate to the next item, then previous at the end, then close on an empty pack.

- [ ] **Step 2: Implement shared action descriptors**

```ts
export interface SpriteActionContext {
  getPack(): SpritePack | null
  getSprite(): Sprite | null
  commit(pack: SpritePack): void
  pickReplacement(): void
  localize(): Promise<void>
  refresh(): void
  close(): void
}

export interface SpriteAction {
  id: string
  label: string
  destructive?: boolean
  disabled?: boolean
  run(): void | Promise<void>
}
```

Grid cards may retain compact icons, but both surfaces call the same operations. Never capture a stale pack array across edits.

- [ ] **Step 3: Verify and commit**

```powershell
git commit -m "feat: edit sprites from preview"
```

### Task 5: Add Explicit Local Save

**Files:**
- Create: `st-extension/src/sprite-localize.ts`
- Create: `st-extension/src/sprite-localize.test.ts`
- Modify: `st-extension/src/st-adapter.ts`
- Modify: `st-extension/src/sprite-actions.ts`
- Modify: `st-extension/src/sprite-manager.test.ts`

- [ ] **Step 1: Write transactional RED tests**

Assert no fetch occurs merely by opening the manager or lightbox. For an explicit action, assert fetch -> compression -> `saveImage` -> settings commit order. On success, `url` becomes local and the original HTTP URL becomes `remoteUrl`. On CORS, HTTP, compression, or save failure, the sprite remains byte-for-byte unchanged.

- [ ] **Step 2: Implement**

```ts
export async function localizeSprite(
  sprite: Sprite,
  fileName: string,
  deps: { fetch: typeof fetch; saveImage(file: File, fileName: string): Promise<string> },
): Promise<Sprite>
```

Reject data/local sources as already local, cap input size using response headers and decoded blob size, and revoke temporary URLs.

- [ ] **Step 3: Verify and commit**

```powershell
git commit -m "feat: save remote sprites locally on demand"
```

### Task 6: Add Labels, Search, and Role Folding

**Files:**
- Modify: `core/sprite-metadata.ts`
- Modify: `core/sprite-metadata.test.ts`
- Modify: `st-extension/src/sprite-manager.ts`
- Modify: `st-extension/src/sprite-manager.test.ts`
- Modify: `st-extension/src/apps/sprite-app.ts`
- Modify: `st-extension/style.css`

- [ ] **Step 1: Write pure filtering/grouping tests**

Expose and test:

```ts
filterSprites(pack, { query: '居家', labels: ['动作'] })
groupPacksByRole(packs)
```

Filtering uses case-insensitive substring matching across tag, labels, effective role/outfit, and pack name; labels use AND semantics. Grouping preserves pack order, leaves empty-role packs independent, and reports pack/sprite counts.

- [ ] **Step 2: Write DOM RED tests**

Assert filters reset the render window to 60, label chips are removable and deduplicated, and enabling fold mode produces one role row with a pack count that expands to the original pack cards.

- [ ] **Step 3: Implement, verify, and commit**

```powershell
git commit -m "feat: organize gallery labels and outfits"
```

### Task 7: Capture External Story Images

**Files:**
- Create: `core/story-archive.ts`
- Create: `core/story-archive.test.ts`
- Create: `st-extension/src/story-image-capture.ts`
- Create: `st-extension/src/story-image-capture.test.ts`
- Modify: `st-extension/src/message-postprocess.ts`
- Modify: `st-extension/src/message-postprocess.test.ts`
- Modify: `st-extension/src/st-adapter.ts`
- Modify: `st-extension/src/index.ts`

- [ ] **Step 1: Write pure archive RED tests**

```ts
expect(storyArchiveKey({ chatId: 'chat/1', characterId: 'c1' })).toBe('c1::chat/1')
expect(upsertStorySprite(settings, story, sprite)).toEqual(/* one matching archive pack */)
```

Cover group chat, missing chat ID fallback, stable names, duplicate URL idempotence, and safe generated tags.

- [ ] **Step 2: Write DOM and workflow RED tests**

Eligible AI-message images receive one "Save to gallery" action. Exclude avatars, emoji, tiny assets, `.so-inline-sprite`, and `.so-renderer-*`. Clicking calls the existing localize/save pipeline and creates or reuses the story pack. CORS failure offers remote-reference storage and never reports it as local.

- [ ] **Step 3: Implement adapter story context and lifecycle cleanup**

Add a narrow adapter method returning:

```ts
interface StoryContext {
  key: string
  title: string
  characterName: string
}
```

Register decorators through message postprocessing and remove buttons/listeners on restore or disposal.

- [ ] **Step 4: Verify and commit**

```powershell
git commit -m "feat: archive generated story images"
```

### Task 8: Gallery Mobile and Integration Verification

**Files:**
- Modify: `e2e/mobile.spec.ts`
- Regenerate: `bundle.js`
- Regenerate only when changed: `index.js`, `style.css`, `version.json`

- [ ] **Step 1: Add Playwright coverage**

At 390x844 and 844x390, open the manager and lightbox. Assert the layer bounding box stays inside the viewport, the image and action bar do not overlap, labels fit, and controls remain clickable. Test one folded-role expansion and one search result.

- [ ] **Step 2: Run final gallery verification**

```powershell
pnpm exec playwright test e2e/mobile.spec.ts
pnpm test -- --reporter=dot
pnpm typecheck
pnpm lint
pnpm build:ext
git diff --check
```

- [ ] **Step 3: Commit generated integration output**

```powershell
git commit -m "test: verify gallery update integration"
```
