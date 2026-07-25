# Semantic Sprite Address and Large Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the uncommitted canonical-ID sprite addresses with reversible short semantic addresses, enforce active-address uniqueness at every normal mutation boundary, compress large-pack prompts, and bound image preloading.

**Architecture:** Add a pure `address-policy` module as the single source of effective coordinates and cross-pack conflict reports. Keep `sprite-store` responsible for parsing, binding mutations, and active address enumeration; every conflict-checked settings mutation returns a discriminated union. Build prompts from conflict-free semantic coordinates and move proactive image loading into a small tested preload module. Pack merging remains a pure core operation; Web and ST UI only collect user choices and commit successful results.

**Tech Stack:** TypeScript 5.7, Vitest 4, React 19 / Next.js 16, native DOM SillyTavern extension, esbuild.

**User constraint:** Do not create commits or push. Keep all changes in the shared working tree for Claude Code review. Each “checkpoint” below replaces the usual commit step.

---

## File map

- Create `core/address-policy.ts`: effective semantic coordinates, conflict keys, cross-pack reports.
- Create `core/address-policy.test.ts`: coordinate and final-set conflict policy tests.
- Create `core/sprite-preload.ts`: activation and matched-sequence preload budgets.
- Create `core/sprite-preload.test.ts`: `Image` creation limits and order tests.
- Create `core/pack-merge.ts`: import/binding merge preview and deterministic application.
- Create `core/pack-merge.test.ts`: materialization, duplicate, conflict-resolution, and no-drift tests.
- Modify `core/sprite-store.ts`: remove canonical helpers, use address policy, strict outfit parsing, conflict-checked settings results.
- Modify `core/sprite-store.test.ts`: short-address, dirty-data, binding atomicity, active-pack mutation tests.
- Modify `core/address-match.test.ts`: migrate binding result use and short semantic expectations.
- Modify `core/prompt-builder.ts`: grouped full, shared-plus-remainder repeat, deterministic length choice.
- Modify `core/prompt-builder.test.ts`: reversibility, wording, compression, and 1000-address tests.
- Modify `components/config-panel.tsx`: handle union results and import/bind conflict choices.
- Modify `st-extension/src/sprite-manager.ts`: same union and merge flow for native DOM UI.
- Modify `app/page.tsx`: bounded activation and matched-sequence preload wiring.
- Modify `st-extension/src/index.ts`: bounded activation and matched-sequence preload wiring.
- Modify `core/types.ts`: update prompt-mode comments only if needed; no settings version bump.
- Modify `progress.md` and scoped planning files: implementation/verification record.
- Rebuild `index.js` only after source and focused tests are green.

---

### Task 1: Effective address and conflict policy

**Files:**
- Create: `core/address-policy.test.ts`
- Create: `core/address-policy.ts`

- [x] **Step 1: Write failing effective-coordinate tests**

Cover these exact cases in `core/address-policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { effectiveSpriteAddress, findAddressConflicts } from './address-policy'
import type { SpritePack } from './types'

const sprite = { tag: '微笑', url: 'u' }

it('single plain pack keeps bare tag', () => {
  const pack: SpritePack = { id: 'a', name: '鸣人包', sprites: [sprite] }
  expect(effectiveSpriteAddress(pack, sprite, false)).toEqual({ role: '', outfit: '', tag: '微笑' })
})

it('single pack with outfit uses pack name so outfit remains representable', () => {
  const pack: SpritePack = { id: 'a', name: '鸣人包', outfit: '居家服', sprites: [sprite] }
  expect(effectiveSpriteAddress(pack, sprite, false)).toEqual({ role: '鸣人包', outfit: '居家服', tag: '微笑' })
})

it('multi-pack fallback is evaluated in the final collection context', () => {
  const a: SpritePack = { id: 'a', name: '同名', sprites: [{ tag: '微笑', url: 'a' }] }
  const b: SpritePack = { id: 'b', name: '同名', sprites: [{ tag: '微笑', url: 'b' }] }
  expect(findAddressConflicts([a, b])).toHaveLength(1)
})
```

Also test group > roleName > pack-name fallback, sprite outfit > pack outfit, disjoint tags allowed, different outfits allowed, pack-name ↔ roleName/group collisions, and same URL in different packs still reported as two owners.

- [x] **Step 2: Run the focused test and verify RED**

Run: `pnpm test -- core/address-policy.test.ts`

Expected: FAIL because `./address-policy` does not exist.

- [x] **Step 3: Implement the pure policy module**

Use these public shapes:

```ts
export interface AddressConflictOwner {
  packId: string
  packName: string
  spriteUrl: string
}

export interface AddressConflict {
  key: string
  address: SpriteAddress
  formattedAddress: string
  owners: AddressConflictOwner[]
}

export function addressConflictKey(address: SpriteAddress): string {
  return JSON.stringify([address.role, address.outfit, address.tag])
}

export function effectiveSpriteAddress(
  pack: SpritePack,
  sprite: Sprite,
  multiPack: boolean,
): SpriteAddress {
  const outfit = spriteOutfit(pack, sprite)
  const semanticRole = (sprite.group ?? '').trim() || (pack.roleName ?? '').trim()
  const role = semanticRole || ((multiPack || outfit) ? normalizeTag(pack.name) : '')
  return { role, outfit, tag: sprite.tag }
}
```

`findAddressConflicts(packs)` must compute `multiPack` from `packs.length`, group by `addressConflictKey`, deduplicate owners by pack ID, and return only groups owned by two or more distinct packs.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm test -- core/address-policy.test.ts`

Expected: all address-policy tests PASS.

- [x] **Step 5: Checkpoint**

Run: `git diff --check -- core/address-policy.ts core/address-policy.test.ts`

Expected: exit 0.

---

### Task 2: Restore short semantic addressing and deterministic parsing

**Files:**
- Modify: `core/sprite-store.test.ts`
- Modify: `core/address-match.test.ts`
- Modify: `core/sprite-store.ts`

- [x] **Step 1: Replace canonical expectations with failing short-address tests**

Add/adjust tests for:

```ts
expect(getActiveAddresses(settings, '阿珍').map(formatAddress)).toEqual([
  '鸣人包/微笑',
  '鸣人包/生气',
  '佐助包/微笑',
  '佐助包/生气',
])
expect(addresses.every((x) => !x.includes('@p=') && !x.includes('@r='))).toBe(true)
```

Add the strict outfit regression:

```ts
it('role/tag means empty outfit and never falls into an outfit variant', () => {
  const pack: SpritePack = {
    id: 'p', name: '鸣人包', roleName: '鸣人',
    sprites: [
      { tag: '微笑', url: 'plain' },
      { tag: '微笑', outfit: '居家服', url: 'home' },
    ],
  }
  expect(resolveSprite([pack], '鸣人/微笑')?.url).toBe('plain')
  expect(resolveSprite([pack], '鸣人/居家服/微笑')?.url).toBe('home')
})
```

Also test: only-outfit data makes `role/tag` return `null`; single no-role outfit emits `包名/服装/tag`; dirty cross-pack exact duplicates are absent from `getActiveAddresses`; non-conflicting addresses from the same dirty packs remain listed; fuzzy cross-pack ambiguity returns `null`.

- [x] **Step 2: Run focused tests and verify RED**

Run: `pnpm test -- core/sprite-store.test.ts core/address-match.test.ts`

Expected: FAIL because canonical tokens are still generated and role/tag still searches outfit variants.

- [x] **Step 3: Remove canonical helpers and use `effectiveSpriteAddress`**

Delete `CanonicalRoleKind`, `encodePackId`, canonical parsing/locking, and canonical candidate fields. Make `flatten()` compute addresses through `effectiveSpriteAddress(pack, sprite, multiPack)`.

Keep safe legacy name matching by allowing role queries to match the candidate’s effective role, semantic role, or normalized pack name; final cross-pack ambiguity must still return `null`.

In `resolveSprite()` apply this rule after role lock:

```ts
if (role) {
  pool = lockByRole(pool, role)
  if (pool.length === 0) return null
  if (!outfit) {
    pool = pool.filter((candidate) => candidate.outfit === '')
    if (pool.length === 0) return null
  }
}
```

In `getActiveAddresses()`, build a set from `findAddressConflicts(packs).map(c => c.key)` and omit candidates whose effective coordinate key is conflicted.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm test -- core/sprite-store.test.ts core/address-match.test.ts core/address-policy.test.ts`

Expected: focused suites PASS and no generated address contains canonical ID syntax.

- [x] **Step 5: Checkpoint**

Run: `rg -n "encodePackId|canonicalRoleToken|parseCanonicalRole|@p=|@r=" core/sprite-store.ts core/*.test.ts`

Expected: no production helper hits; test hits only when asserting absence or documenting the removed experiment.

---

### Task 3: Atomic conflict-checked settings mutations

**Files:**
- Modify: `core/sprite-store.test.ts`
- Modify: `core/address-match.test.ts`
- Modify: `core/sprite-store.ts`
- Modify: `components/config-panel.tsx`
- Modify: `st-extension/src/sprite-manager.ts`

- [x] **Step 1: Write failing result-contract and atomicity tests**

Use the wished-for API directly:

```ts
const result = bindPack(settings, '阿珍', 'incoming')
expect(result).toEqual({
  ok: false,
  conflicts: [expect.objectContaining({
    characterName: '阿珍',
    formattedAddress: '鸣人/微笑',
  })],
})
expect(settings.bindings).toEqual(beforeBindings)
```

Test all of these separately:

- successful `bindPack`/`setBinding` return `{ok:true, settings}`;
- conflict failure contains both pack IDs/names/URLs;
- final-set multiPack recalculates coordinates for every pack;
- `toggleBinding(false)` always succeeds;
- `toggleBinding(true)` fails atomically for a dirty disabled set;
- after `unbindPack` removes the collision, re-enable succeeds;
- `bindCharacter` returns the same union contract;
- replacing an active pack with `upsertPack` can be rejected for every affected character;
- inserting a new unbound pack through `upsertPack` succeeds;
- changing an active pack without creating conflict succeeds.

- [x] **Step 2: Run focused tests and verify RED**

Run: `pnpm test -- core/sprite-store.test.ts core/address-match.test.ts`

Expected: FAIL because binding/upsert functions still return plain `PluginSettings` and perform no conflict validation.

- [x] **Step 3: Implement discriminated result types and validators**

Use these public types in `core/sprite-store.ts`:

```ts
export interface BindingConflict extends AddressConflict {
  characterName: string
}

export type ConflictCheckedSettingsResult =
  | { ok: true; settings: PluginSettings }
  | { ok: false; conflicts: BindingConflict[] }

export type BindingChangeResult = ConflictCheckedSettingsResult
export type PackChangeResult = ConflictCheckedSettingsResult
```

Create a private `conflictsForBinding(settings, characterName, packIds)` that resolves packs in the proposed order and maps `findAddressConflicts()` to `BindingConflict`. `bindPack`, `setBinding`, `bindCharacter`, and `toggleBinding` must only return a new settings object after validation succeeds. `toggleBinding(false)` bypasses validation.

For `upsertPack`, first build an unchecked candidate settings object, then validate each enabled binding whose `packIds` includes the changed pack ID. Return all conflicts without mutating the caller’s settings.

- [x] **Step 4: Migrate core tests and thin UI call sites**

At call sites, only commit success:

```ts
const result = bindPack(settings, characterName, packId)
if (result.ok) onSettingsChange(result.settings)
else showBindingConflicts(result.conflicts)
```

Use one small local helper in each UI file for formatting conflicts. Do not silently select a pack or commit the original settings as if the operation succeeded.

- [x] **Step 5: Run focused tests and typecheck**

Run: `pnpm test -- core/sprite-store.test.ts core/address-match.test.ts`

Run: `pnpm typecheck`

Expected: tests PASS; TypeScript reports no remaining plain-settings assumptions at `bindPack`, `setBinding`, `bindCharacter`, `toggleBinding`, or `upsertPack` call sites.

- [x] **Step 6: Checkpoint**

Run: `rg -n "onSettingsChange\((bindPack|toggleBinding|upsertPack)|commit\((bindPack|toggleBinding|upsertPack)" components st-extension`

Expected: no direct union-to-settings commits.

---

### Task 4: Reversible grouped Prompt compression

**Files:**
- Modify: `core/prompt-builder.test.ts`
- Modify: `core/prompt-builder.ts`
- Modify: `core/types.ts`
- Modify: `st-extension/src/apps/sprite-app.ts`

- [x] **Step 1: Write failing grouped/full and repeat tests**

Assert exact semantic properties rather than incidental punctuation:

```ts
const full = buildPrompt([
  addr('鸣人', '', '微笑'),
  addr('鸣人', '居家服', '微笑'),
  addr('佐助', '', '微笑'),
], 'full', 1)
expect(full).toContain('- 鸣人：微笑')
expect(full).toContain('- 鸣人/居家服：微笑')
expect(full).toContain('- 佐助：微笑')
```

For repeat, assert the phrases `共有表情（适用于全部场景）` and `各场景其余表情`, and assert it never says `专属`. Add an A/B/C dataset where one tag belongs to A+B but not C and appears under both A and B remainder rows.

Add deterministic selection tests:

- repeat returns grouped full when the complete full prompt is shorter;
- repeat returns shared format when it is shorter;
- a test-only exported or internal helper comparison uses UTF-16 `string.length`, with equal length choosing grouped full.

Add a 50 roles × 20 shared tags fixture and assert shared tag names are not repeated per role, no `@p=`/`@r=` appears, and the result is shorter than a naïve full-address prompt. Add a 1000-address build test with a generous runtime assertion only if Vitest timing is stable; otherwise assert completeness and output size deterministically.

- [x] **Step 2: Run prompt tests and verify RED**

Run: `pnpm test -- core/prompt-builder.test.ts`

Expected: FAIL because full is still flat and repeat still uses “其他图片” complete addresses.

- [x] **Step 3: Implement scene grouping**

Build an ordered scene map keyed by role/outfit. A scene record must keep its exact output prefix and ordered unique tags:

```ts
interface PromptScene {
  key: string
  label: string
  prefix: string
  tags: string[]
}
```

`buildGroupedFull()` emits one row per scene. `buildShared()` computes the intersection, emits shared tags once, and emits each scene’s remaining tags as tag names rather than repeated full addresses. Both outputs include enough instructions to construct `[立绘:tag]`, `[立绘:role/tag]`, or `[立绘:role/outfit/tag]` exactly.

For `mode === 'repeat'`:

```ts
const grouped = buildGroupedFull(addresses, count)
const shared = buildShared(addresses, count)
return shared.length < grouped.length ? shared : grouped
```

If the intersection is empty, `buildShared()` returns the grouped form directly.

- [x] **Step 4: Run prompt tests and verify GREEN**

Run: `pnpm test -- core/prompt-builder.test.ts`

Expected: all prompt tests PASS.

- [x] **Step 5: Update visible labels and checkpoint**

Change UI copy from “智能精简（共有图名合并）” to wording matching “共有表情 + 各场景其余表情”.

Run: `git diff --check -- core/prompt-builder.ts core/prompt-builder.test.ts core/types.ts st-extension/src/apps/sprite-app.ts`

Expected: exit 0.

---

### Task 5: Bounded activation and matched-sequence preload

**Files:**
- Create: `core/sprite-preload.test.ts`
- Create: `core/sprite-preload.ts`
- Modify: `app/page.tsx`
- Modify: `st-extension/src/index.ts`
- Modify: `core/sprite-store.ts` (remove old `preloadPack`)

- [x] **Step 1: Write failing preload budget tests**

Install a fake `Image` constructor in the node test and restore it after each test. Assert:

```ts
expect(PRELOAD_ON_ACTIVATE_MAX).toBe(4)
expect(PRELOAD_MATCH_MAX).toBe(10)

preloadOnActivate(largePackList)
expect(createdImages).toHaveLength(4)

preloadMatchedSprites(twelveUniqueSprites)
expect(createdImages).toHaveLength(10)
```

Also test URL deduplication, binding order, fewer-than-limit inputs, and SSR/no-`Image` no-op behavior.

- [x] **Step 2: Run focused test and verify RED**

Run: `pnpm test -- core/sprite-preload.test.ts`

Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement the preload module**

Use these exports:

```ts
export const PRELOAD_ON_ACTIVATE_MAX = 4
export const PRELOAD_MATCH_MAX = 10

export function preloadOnActivate(packs: SpritePack[]): void {
  const firstSprites: Sprite[] = []
  for (const pack of packs) {
    const first = pack.sprites[0]
    if (first) firstSprites.push(first)
  }
  preloadSprites(firstSprites, PRELOAD_ON_ACTIVATE_MAX)
}

export function preloadMatchedSprites(sprites: Sprite[]): void {
  preloadSprites(sprites, PRELOAD_MATCH_MAX)
}
```

`preloadSprites` must dedupe by URL, preserve order, create at most `max` `Image` instances, set `crossOrigin='anonymous'`, and do nothing when `Image` is unavailable. It must not walk every sprite in every active pack.

- [x] **Step 4: Wire both runtimes**

Replace activation loops with `preloadOnActivate(activePacks)`. Immediately after `resolveSprites(...)`, call `preloadMatchedSprites(seq)` before passing the sequence to the overlay. Do not touch message-postprocess, `recentFloors`, or message fingerprints.

- [x] **Step 5: Run tests and typecheck**

Run: `pnpm test -- core/sprite-preload.test.ts core/sprite-store.test.ts`

Run: `pnpm typecheck`

Expected: PASS; `rg -n "preloadPack\(" app st-extension core` returns no hits.

- [x] **Step 6: Checkpoint**

Run: `rg -n "new Image\(" core app st-extension/src`

Expected: proactive sprite preload uses only `core/sprite-preload.ts`; unrelated image compression remains allowed.

---

### Task 6: Pack import overlap and merge policy

**Files:**
- Create: `core/pack-merge.test.ts`
- Create: `core/pack-merge.ts`
- Modify: `components/config-panel.tsx`
- Modify: `st-extension/src/sprite-manager.ts`

- [x] **Step 1: Write failing merge preview tests**

Test these behaviors:

- same name is reported even when tags do not overlap;
- pairwise overlap is calculated as if the two packs were simultaneously active (`multiPack=true`);
- identical address + identical URL is an automatic duplicate;
- identical address + different URL requires a choice;
- semantic role/outfit is materialized before pack defaults are recomputed;
- pack-name fallback is not fossilized as a semantic `group` when compatible plain packs merge;
- applying a merge without every required choice throws a clear error;
- merged output contains one sprite per final semantic coordinate and does not drift after re-addressing.

- [x] **Step 2: Run focused test and verify RED**

Run: `pnpm test -- core/pack-merge.test.ts`

Expected: FAIL because `./pack-merge` does not exist.

- [x] **Step 3: Implement pure preview/apply APIs**

Use a deterministic API:

```ts
export interface MergeCandidate {
  sourcePackId: string
  sourcePackName: string
  address: SpriteAddress
  sprite: Sprite
}

export interface MergeConflict {
  key: string
  address: SpriteAddress
  candidates: MergeCandidate[]
}

export interface PackMergeChoice {
  key: string
  sourcePackId: string
}

export interface PackMergePreview {
  sameName: boolean
  automatic: MergeCandidate[]
  conflicts: MergeConflict[]
}

export function previewPackMerge(packs: SpritePack[]): PackMergePreview
export function applyPackMerge(
  packs: SpritePack[],
  choices: PackMergeChoice[],
  result: { id: string; name: string },
): SpritePack
```

Merge identity uses semantic `group || pack.roleName`, effective outfit, and tag; pack-name fallback exists only to distinguish simultaneously active physical packs and must not be persisted as group. After selecting one candidate per coordinate, choose a common non-empty semantic role/outfit as pack defaults only when every result sprite shares it; otherwise store explicit sprite fields.

- [x] **Step 4: Run merge tests and verify GREEN**

Run: `pnpm test -- core/pack-merge.test.ts core/address-policy.test.ts`

Expected: PASS.

- [x] **Step 5: Add thin import/bind interaction**

On import/share decode, inspect same-name/overlap against installed packs before `upsertPack`:

- merge: collect a choice for each differing-URL conflict, create a new merged pack, install it unbound;
- rename: sanitize a user-provided unique name and install;
- install only: install the incoming pack without binding;
- cancel: do not change settings.

On bind conflict, present replace / merge into a new result / cancel. Replace removes only the conflicting currently bound pack IDs for that character. Merge creates a new pack, replaces the involved IDs in that character’s binding, and leaves source packs installed for other characters. Every final settings change must still go through `upsertPack` and `setBinding` union checks.

The interaction may use existing `window.prompt`/`window.confirm` primitives in this iteration; keep all merge correctness in the tested core module.

- [x] **Step 6: Typecheck and checkpoint**

Run: `pnpm typecheck`

Run: `git diff --check -- core/pack-merge.ts core/pack-merge.test.ts components/config-panel.tsx st-extension/src/sprite-manager.ts`

Expected: both pass.

---

### Task 7: Full regression, bundle, and documentation handoff

**Files:**
- Modify: `progress.md`
- Modify: `.planning/semantic-sprite-large-pack/task_plan.md`
- Modify: `.planning/semantic-sprite-large-pack/progress.md`
- Rebuild: `index.js`

- [x] **Step 1: Run all tests**

Run: `pnpm test`

Expected: all Vitest suites PASS.

- [x] **Step 2: Run static checks**

Run: `pnpm typecheck`

Run: `pnpm lint`

Expected: both exit 0 with no errors.

- [x] **Step 3: Build both targets**

Run: `pnpm build:ext`

Run: `pnpm build`

Expected: extension bundle and Next production build complete successfully.

- [x] **Step 4: Verify the generated bundle and removed experiment**

Run:

```powershell
rg -n "PRELOAD_ON_ACTIVATE_MAX|PRELOAD_MATCH_MAX|findAddressConflicts|BindingChangeResult" index.js
rg -n "encodePackId|canonicalRoleToken|parseCanonicalRole|@p=|@r=" core index.js
```

Expected: new logic is present; removed canonical helpers are absent. Literal `@p=`/`@r=` may occur only in tests/docs that assert non-generation, never in runtime source or bundle.

- [x] **Step 5: Check formatting and control bytes**

Run: `git diff --check`

Scan changed source, tests, and `index.js` for C0 bytes excluding tab/LF/CR. Expected: zero control bytes and `git diff --check` exit 0 (line-ending warnings are informational).

- [x] **Step 6: Update records and hand off uncommitted changes**

Append the implementation decisions and exact verification counts to root `progress.md`; mark every scoped plan phase complete. Report changed files, verification evidence, and any deliberately deferred UI polish. Do not commit or push.
