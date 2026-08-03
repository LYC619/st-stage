# STS Renderer V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reversible, lifecycle-owned Galgame, SLG card-choice, and simple battle rendering driven by validated AI structured blocks.

**Architecture:** Parse one bounded JSON block into discriminated TypeScript models, then mount independent mode controllers through a renderer runtime attached to message postprocessing. Mode DOM uses text nodes and safe URL validation. Battle calculations live in a deterministic pure engine; AI supplies initial data but no hidden API call occurs during interaction.

**Tech Stack:** TypeScript 5.7, native DOM, Vitest 4/jsdom, Playwright, existing STS App context and lifecycle, esbuild.

---

### Task 1: Define and Validate the Renderer Protocol

**Files:**
- Create: `st-extension/src/apps/renderer/types.ts`
- Create: `st-extension/src/apps/renderer/parser.ts`
- Create: `st-extension/src/apps/renderer/parser.test.ts`

- [ ] **Step 1: Write parser RED tests**

Cover valid `gal`, `cards`, and `battle` blocks; no block; malformed JSON; duplicate blocks; unsupported version/mode; missing fields; oversized text; too many beats/cards/skills; negative or excessive stats; dangerous URL schemes; and extra unknown fields.

```ts
expect(parseRendererBlock(`before
<STStageRender>{"version":1,"mode":"cards","title":"选择","cards":[
  {"id":"a","title":"前进","description":"继续探索","action":"我选择前进"}
]}</STStageRender>`)).toMatchObject({
  ok: true,
  block: { mode: 'cards', title: '选择' },
})
```

- [ ] **Step 2: Verify RED**

```powershell
pnpm exec vitest run st-extension/src/apps/renderer/parser.test.ts --reporter=dot
```

- [ ] **Step 3: Implement discriminated schemas**

Define `GalRenderBlock`, `CardsRenderBlock`, `BattleRenderBlock`, `FighterConfig`, `SkillConfig`, and `ItemConfig`. Implement explicit validators without evaluating code or accepting HTML.

Limits:

- one block, maximum 64 KiB JSON;
- 1-50 Gal beats;
- 2-8 cards;
- fighter stats 0-9999, attributes 0-100;
- at most 12 skills, 12 items, and 12 initial statuses;
- string fields bounded by purpose.

Only `https:`, `http:`, `data:image/`, `/user/`, and extension-relative image paths are accepted.

- [ ] **Step 4: Verify and commit**

```powershell
git commit -m "feat: define renderer response protocol"
```

### Task 2: Generate the Renderer Prompt

**Files:**
- Create: `st-extension/src/apps/renderer/prompt.ts`
- Create: `st-extension/src/apps/renderer/prompt.test.ts`
- Create: `st-extension/src/apps/renderer/config.ts`
- Create: `st-extension/src/apps/renderer/config.test.ts`

- [ ] **Step 1: Write prompt/config RED tests**

Define defaults:

```ts
export interface RendererSettings {
  enabled: boolean
  galEnabled: boolean
  cardsEnabled: boolean
  battleEnabled: boolean
  injectionDepth: number
  typewriter: boolean
  reducedMotion: boolean
}
```

Assert sanitization, depth bounds, disabled-mode omission, valid JSON examples, and an empty prompt when the master switch or every mode is disabled.

- [ ] **Step 2: Implement prompt generation**

The prompt states that ordinary replies need no block, allows at most one block, lists only enabled schemas, forbids HTML/code, and requires narrative outside the block to remain readable without the renderer.

- [ ] **Step 3: Verify and commit**

```powershell
git commit -m "feat: generate renderer instructions"
```

### Task 3: Add a Reversible Renderer Runtime

**Files:**
- Create: `st-extension/src/apps/renderer/runtime.ts`
- Create: `st-extension/src/apps/renderer/runtime.test.ts`
- Modify: `st-extension/src/message-postprocess.ts`
- Modify: `st-extension/src/message-postprocess.test.ts`
- Modify: `st-extension/src/index.ts`

- [ ] **Step 1: Write runtime RED tests**

Assert:

- valid blocks mount exactly one renderer after a mode factory succeeds;
- the original block is hidden only after mount success;
- malformed blocks and throwing factories leave original content visible;
- rerender, message swipe, settings disable, and lifecycle dispose invoke mode cleanup once;
- streaming partial blocks do not mount;
- the runtime never processes user messages.

- [ ] **Step 2: Implement a mode registry and DOM ownership**

```ts
export interface RendererMount {
  destroy(): void
}

export type RendererModeFactory<T extends RendererBlock = RendererBlock> = (
  root: HTMLElement,
  block: T,
  deps: RendererModeDeps,
) => RendererMount
```

Keep a `WeakMap<HTMLElement, RendererMount>` keyed by message body. Integrate through a narrow postprocessor hook rather than adding mode-specific code to `message-postprocess.ts`.

- [ ] **Step 3: Verify and commit**

```powershell
git commit -m "feat: mount reversible message renderers"
```

### Task 4: Add Renderer Settings App

**Files:**
- Create: `st-extension/src/apps/renderer-app.ts`
- Create: `st-extension/src/apps/renderer-app.test.ts`
- Modify: `st-extension/src/apps/index.ts`
- Modify: `st-extension/src/index.ts`
- Modify: `st-extension/style.css`

- [ ] **Step 1: Write App RED tests**

Mount the real App with a fake context. Assert master and mode toggles, bounded depth input, typewriter/reduced-motion controls, settings persistence, prompt refresh, and runtime reprocessing. No visible instructional prose is added beyond field labels and status/error messages.

- [ ] **Step 2: Implement App and prompt channel lifecycle**

Register `renderer` with the built-in App list. Store data under `settings.apps.renderer`. Inject through `app:renderer`; clear the channel when disabled or disposed.

- [ ] **Step 3: Verify and commit**

```powershell
git commit -m "feat: configure renderer modes"
```

### Task 5: Implement Galgame Mode

**Files:**
- Create: `st-extension/src/apps/renderer/modes/gal.ts`
- Create: `st-extension/src/apps/renderer/modes/gal.test.ts`
- Modify: `st-extension/style.css`

- [ ] **Step 1: Write Galgame RED tests**

Assert safe rendering of scene, optional background, optional portrait, speaker, and dialogue through `textContent`; previous/next/skip controls; keyboard navigation; first/last disabled states; typewriter cancellation; reduced-motion instant display; and cleanup of timers/listeners.

Portrait strings matching sprite addresses resolve through a supplied gallery resolver; unresolved addresses show no broken portrait.

- [ ] **Step 2: Implement**

Create one contained stage inside the AI message. Keep stable aspect-ratio constraints, leave a visible caption/dialogue area on mobile, and never replace the whole ST page.

- [ ] **Step 3: Verify and commit**

```powershell
git commit -m "feat: render Galgame dialogue"
```

### Task 6: Implement SLG Card Choices and Composer Bridge

**Files:**
- Create: `st-extension/src/apps/renderer/composer.ts`
- Create: `st-extension/src/apps/renderer/composer.test.ts`
- Create: `st-extension/src/apps/renderer/modes/cards.ts`
- Create: `st-extension/src/apps/renderer/modes/cards.test.ts`
- Modify: `st-extension/src/st-adapter.ts`
- Modify: `st-extension/style.css`

- [ ] **Step 1: Write composer RED tests**

Assert insertion into the discovered SillyTavern textarea dispatches `input`, focuses the composer, and returns an error when unavailable. A renderer-owned draft may be replaced by another card only while the user has not changed it; user edits are never overwritten.

- [ ] **Step 2: Write card-mode RED tests**

Assert 2-8 cards render with title, description, optional consequence hint, and an icon-plus-text Select command. Selecting marks one card, inserts its action without sending, and announces success/failure accessibly.

- [ ] **Step 3: Implement and commit**

```powershell
git commit -m "feat: render interactive story choices"
```

### Task 7: Implement a Deterministic Battle Engine

**Files:**
- Create: `st-extension/src/apps/renderer/battle-engine.ts`
- Create: `st-extension/src/apps/renderer/battle-engine.test.ts`

- [ ] **Step 1: Write engine RED tests**

Inject a deterministic RNG and cover attack, critical, dodge, defense duration, skill MP cost, healing, items, status replacement/expiry, enemy turn, flee success/failure, zero-HP termination, invalid action rejection, snapshot immutability, and calls after completion.

```ts
const engine = createBattleEngine(config, { random: () => 0.5 })
expect(engine.dispatch({ type: 'attack' }).state.enemy.hp).toBeLessThan(100)
```

- [ ] **Step 2: Implement pure state transitions**

No timers, DOM, prompt calls, or HTML belong in the engine. Return structured log entries and state snapshots from every action. Use bounded arithmetic and stable IDs from validated protocol data.

- [ ] **Step 3: Verify and commit**

```powershell
git commit -m "feat: add renderer battle engine"
```

### Task 8: Implement Battle Mode

**Files:**
- Create: `st-extension/src/apps/renderer/modes/battle.ts`
- Create: `st-extension/src/apps/renderer/modes/battle.test.ts`
- Modify: `st-extension/style.css`

- [ ] **Step 1: Write battle-mode RED tests**

Assert combatant summaries, HP/MP bars, status chips, intent, log, attack/skill/defend/item/flee controls, disabled unavailable actions, turn updates, end state, and cleanup. Free action opens a text field and inserts a structured readable action into the ST composer without local fake resolution or automatic sending.

- [ ] **Step 2: Implement mode-controller orchestration**

Keep one engine per rendered message. Serialize button actions while an enemy transition is pending. Use text labels with familiar icons; compact secondary controls only on narrow screens.

- [ ] **Step 3: Verify and commit**

```powershell
git commit -m "feat: render interactive battles"
```

### Task 9: Renderer Mobile and Integration Verification

**Files:**
- Modify: `e2e/mobile.spec.ts`
- Regenerate: `bundle.js`
- Regenerate: `style.css`
- Regenerate only when changed: `index.js`, `version.json`

- [ ] **Step 1: Add mobile E2E scenarios**

At portrait and landscape mobile sizes, mount each mode fixture. Assert no overflow/overlap, controls fit and remain reachable, long text wraps, and switching settings restores original message text. Use screenshot and bounding-box assertions.

- [ ] **Step 2: Run final renderer verification**

```powershell
pnpm exec vitest run st-extension/src/apps/renderer --reporter=dot
pnpm exec playwright test e2e/mobile.spec.ts
pnpm test -- --reporter=dot
pnpm typecheck
pnpm lint
pnpm build:ext
git diff --check
```

- [ ] **Step 3: Commit integration output**

```powershell
git commit -m "test: verify renderer v1 integration"
```

### Task 10: Unified Review Handoff

**Files:**
- No production changes expected

- [ ] **Step 1: Verify the complete update range**

Run all full gates again, fixed-time rebuild twice, artifact diff, clean status, and commit-boundary inspection from `1680db8..HEAD`.

- [ ] **Step 2: Request independent review**

Review gallery data compatibility, network behavior, lifecycle cleanup, parser security, variable schema enforcement, renderer fallback, composer safety, mobile layout, generated artifacts, and missing tests. Resolve every Critical or Important finding before handoff.

- [ ] **Step 3: Prepare CC handoff**

List every commit, solved requirement, focused RED/GREEN evidence, full verification, known real-SillyTavern checks, and any intentionally excluded scope. Do not push or merge.
