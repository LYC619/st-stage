# Stable Sprite Alias Implementation Plan

> 历史实施记录：本计划对应的 canonical ID 方案已被 `docs/superpowers/specs/2026-07-25-semantic-sprite-address-and-large-pack-design.md` supersede。当前不要按本文件继续实现；仅保留作为上一轮验证记录。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace activation-dependent sprite-pack aliases with stable, injective multi-pack role tokens; make legacy ambiguous addresses fail safely; and repair effective-address CRUD normalization.

**Architecture:** In multi-pack mode every candidate receives a canonical role token `<label>@<p|r>=<encodedPackId>`. The encoded ID is injective over JavaScript strings, while `p` and `r` distinguish package-name fallback from semantic roles. Canonical parsing locks by ID first; legacy noncanonical parsing collects every plausible candidate and returns a sprite only when the final match is unique.

**Tech Stack:** TypeScript 5.7, Vitest 4, ESLint 10, esbuild extension bundle, Next.js 16.

---

## File map

- Modify `core/sprite-store.test.ts`: regression tests for stable canonical tokens, safe legacy ambiguity, semantic collisions, ID encoding, and CRUD duplicate handling.
- Modify `core/address-match.test.ts`: update multi-pack address expectations to the canonical role-token format.
- Modify `core/sprite-store.ts`: canonical token encoding/parsing, candidate flattening, safe resolver filtering, prompt address deduplication, and CRUD normalization.
- Rebuild `index.js`: generated extension bundle containing the new core behavior.
- Preserve existing uncommitted UI changes in `app/page.tsx` and `components/phone-mount.tsx`; do not edit them.
- Keep the implementation uncommitted so the user can hand the complete working-tree diff to Claude for review.

### Task 1: Add stable-address regression tests

**Files:**
- Modify: `core/sprite-store.test.ts`
- Reference: `docs/superpowers/specs/2026-07-24-stable-sprite-alias-design.md`

- [x] **Step 1: Add shared test helpers inside the multi-pack describe block**

```ts
function oneSprite(id: string, name: string, url = `${id}-smile`): SpritePack {
  return { id, name, sprites: [{ tag: '微笑', url }] }
}

function rolePack(id: string, name: string, roleName: string, url: string): SpritePack {
  return { id, name, roleName, sprites: [{ tag: '微笑', url }] }
}

function groupPack(id: string, name: string, group: string, url: string): SpritePack {
  return { id, name, sprites: [{ tag: '微笑', url, group }] }
}

function settingsFor(
  packs: SpritePack[],
  packIds = packs.map((pack) => pack.id),
): PluginSettings {
  return {
    ...createDefaultSettings(),
    packs,
    bindings: [{ characterName: '阿珍', packIds, enabled: true }],
  }
}

const resolveSpriteUrl = (s: PluginSettings, address: string): string | undefined =>
  resolveSprite(getActivePacks(s, '阿珍'), address)?.url

function ownedAddress(s: PluginSettings, url: string): string {
  return getActiveAddresses(s, '阿珍')
    .map(formatAddress)
    .find((address) => resolveSpriteUrl(s, address) === url)!
}

function twoSameName(idA: string, idB: string): PluginSettings {
  return settingsFor([
    oneSprite(idA, '同名包', `${idA}-smile`),
    oneSprite(idB, '同名包', `${idB}-smile`),
  ])
}
```

- [x] **Step 2: Replace the current conditional-alias assertions with canonical multi-pack assertions**

Add or update tests so every multi-pack candidate includes `@p=` or `@r=` and resolves back to its owning sprite:

```ts
it('多包所有候选都使用稳定规范 token，并分别解析到所属包', () => {
  const a: SpritePack = { id: 'p_a', name: '鸣人包', sprites: [{ tag: '微笑', url: 'a' }] }
  const b: SpritePack = { id: 'p_b', name: '佐助包', roleName: '佐助', sprites: [{ tag: '微笑', url: 'b' }] }
  const s = settingsFor([a, b])
  const addresses = getActiveAddresses(s, '阿珍').map(formatAddress)

  expect(addresses).toEqual([
    '鸣人包@p=p_a/微笑',
    '佐助@r=p_b/微笑',
  ])
  expect(resolveSpriteUrl(s, addresses[0])).toBe('a')
  expect(resolveSpriteUrl(s, addresses[1])).toBe('b')
})
```

- [x] **Step 3: Add injective ID encoding cases**

```ts
it.each([
  ['pack_ab', 'ab'],
  ['pack_a.b', 'pack_ab'],
  ['pack_猫', 'pack_狗'],
  ['pack_a~b', 'pack_a.b'],
])('不同完整 id %s / %s 生成不同规范地址', (idA, idB) => {
  const s = twoSameName(idA, idB)
  const addresses = getActiveAddresses(s, '阿珍').map(formatAddress)
  expect(new Set(addresses).size).toBe(2)
})
```

- [x] **Step 4: Add rename and activation-set stability cases**

```ts
it('包改名后历史 p 类型规范地址仍按 id 命中', () => {
  const before = settingsFor([
    oneSprite('p_a', '旧包名', 'a'),
    oneSprite('p_b', '其他包', 'b'),
  ])
  const oldAddress = ownedAddress(before, 'a')
  const after = settingsFor([{ ...before.packs[0], name: '新包名' }], ['p_a'])
  expect(resolveSpriteUrl(after, oldAddress)).toBe('a')
})

it('新增冲突语义包后旧裸地址返回 null，不改指向新包', () => {
  const a = oneSprite('p_a', '鸣人', 'a')
  const c = oneSprite('p_c', '小樱', 'c')
  const oldAddress = '鸣人/微笑'
  const b: SpritePack = { id: 'p_b', name: '佐助包', roleName: '鸣人', sprites: [{ tag: '微笑', url: 'b' }] }
  const after = settingsFor([a, b, c])
  expect(resolveSpriteUrl(after, oldAddress)).toBeUndefined()
})
```

- [x] **Step 5: Add semantic collision cases**

```ts
it('相同 roleName 或 sprite.group 的不同包仍生成唯一地址', () => {
  const rolePacks = settingsFor([
    rolePack('p_a', '包A', '鸣人', 'a'),
    rolePack('p_b', '包B', '鸣人', 'b'),
  ])
  const groupPacks = settingsFor([
    groupPack('p_c', '包C', '鸣人', 'c'),
    groupPack('p_d', '包D', '鸣人', 'd'),
  ])

  for (const s of [rolePacks, groupPacks]) {
    const addresses = getActiveAddresses(s, '阿珍').map(formatAddress)
    expect(new Set(addresses).size).toBe(2)
    expect(addresses.every((x) => x.includes('@r='))).toBe(true)
  }
})
```

- [x] **Step 6: Add order, disable, malformed-token, and single-pack compatibility cases**

```ts
it('规范地址与启用顺序无关，目标包停用后严格返回 null', () => {
  const a = oneSprite('p_a', '包A', 'a')
  const b = oneSprite('p_b', '包B', 'b')
  const forward = settingsFor([a, b], ['p_a', 'p_b'])
  const reversed = settingsFor([a, b], ['p_b', 'p_a'])
  const addressA = ownedAddress(forward, 'a')

  expect(ownedAddress(reversed, 'a')).toBe(addressA)
  expect(resolveSpriteUrl(settingsFor([a, b], ['p_b']), addressA)).toBeUndefined()
})

it('单包继续使用简写，并兼容曾经生成的规范地址', () => {
  const a = oneSprite('p_a', '包A', 'a')
  const multi = settingsFor([a, oneSprite('p_b', '包B', 'b')])
  const canonical = ownedAddress(multi, 'a')
  const single = settingsFor([a], ['p_a'])

  expect(getActiveAddresses(single, '阿珍').map(formatAddress)).toEqual(['微笑'])
  expect(resolveSpriteUrl(single, canonical)).toBe('a')
})

it('含 @ 但不符合规范格式的地址严格返回 null', () => {
  const s = settingsFor([oneSprite('p_a', '包A', 'a')])
  expect(resolveSpriteUrl(s, '包A@错误格式/微笑')).toBeUndefined()
})
```

- [x] **Step 7: Run the focused tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run core/sprite-store.test.ts --reporter=verbose
```

Expected: the new tests fail because the current code still emits conditional `name@filteredId`, retargets legacy bare aliases, and does not canonicalize semantic roles.

### Task 2: Implement stable canonical role tokens and safe resolution

**Files:**
- Modify: `core/sprite-store.ts`
- Test: `core/sprite-store.test.ts`

- [x] **Step 1: Replace filtered ID discriminators with an injective encoder**

Implement:

```ts
type CanonicalRoleKind = 'p' | 'r'

function encodePackId(id: string): string {
  if (!id) return '~e'
  let out = ''
  for (let i = 0; i < id.length; i++) {
    const ch = id[i]
    if (/[0-9A-Za-z_-]/.test(ch)) out += ch
    else out += `~${id.charCodeAt(i).toString(16).padStart(4, '0')}`
  }
  return out
}

function semanticRole(pack: SpritePack, sprite: Sprite): string {
  return (sprite.group ?? '').trim() || (pack.roleName ?? '').trim()
}

function canonicalRoleToken(pack: SpritePack, sprite: Sprite): string {
  const role = semanticRole(pack, sprite)
  const kind: CanonicalRoleKind = role ? 'r' : 'p'
  const label = role || packBaseAlias(pack)
  return `${label}@${kind}=${encodePackId(pack.id)}`
}
```

Do not strip `pack_`; do not hash or truncate.

- [x] **Step 2: Parse canonical tokens strictly**

Implement:

```ts
interface ParsedCanonicalRole {
  label: string
  kind: CanonicalRoleKind
  packKey: string
}

function parseCanonicalRole(query: string): ParsedCanonicalRole | null {
  const match = /^(.+)@(p|r)=([0-9A-Za-z_~-]+)$/.exec(query)
  if (!match) return null
  return {
    label: match[1],
    kind: match[2] as CanonicalRoleKind,
    packKey: match[3],
  }
}
```

Malformed queries containing `@` must return no candidates and must not fall back to legacy matching.

- [x] **Step 3: Make candidate roles stable in all multi-pack cases**

Update `Candidate` and `flatten()`:

```ts
interface Candidate {
  pack: SpritePack
  sprite: Sprite
  semanticRole: string
  role: string
  outfit: string
  baseAlias: string
  packKey: string
}

function flatten(packs: SpritePack[]): Candidate[] {
  const multiPack = packs.length > 1
  const out: Candidate[] = []
  for (const pack of packs) {
    const baseAlias = packBaseAlias(pack)
    const packKey = encodePackId(pack.id)
    for (const sprite of pack.sprites) {
      const role = semanticRole(pack, sprite)
      out.push({
        pack,
        sprite,
        semanticRole: role,
        role: multiPack ? canonicalRoleToken(pack, sprite) : role,
        outfit: spriteOutfit(pack, sprite),
        baseAlias,
        packKey,
      })
    }
  }
  return out
}
```

Remove `buildPromptPrefixes`, `packDisc`, and the old whole-string `canonicalAlias` comparison.

- [x] **Step 4: Resolve canonical and legacy roles without first-match ambiguity**

Implement canonical locking:

```ts
function lockCanonicalRole(pool: Candidate[], query: string): Candidate[] {
  const parsed = parseCanonicalRole(query)
  if (!parsed) return []
  return pool.filter((c) => {
    if (c.packKey !== parsed.packKey) return false
    if (parsed.kind === 'p') return c.semanticRole === ''
    return c.semanticRole === parsed.label
  })
}
```

Implement safe legacy locking:

```ts
function lockLegacyRole(pool: Candidate[], query: string): Candidate[] {
  const names = (c: Candidate) => [c.semanticRole, c.baseAlias].filter(Boolean)
  const exact = pool.filter((c) => names(c).includes(query))
  if (exact.length > 0) return exact
  return pool.filter((c) => names(c).some((name) => nameMatches(name, query)))
}
```

Replace first-fuzzy-name locking with a filter that retains every possible candidate until the final uniqueness check:

```ts
function filterByName(
  pool: Candidate[],
  query: string,
  of: (candidate: Candidate) => string,
): Candidate[] {
  const exact = pool.filter((candidate) => of(candidate) === query)
  if (exact.length > 0) return exact
  return pool.filter((candidate) => nameMatches(of(candidate), query))
}
```

Update `lockByRole()` so any query containing `@` uses only strict canonical parsing. Replace final first-match tag selection with unique matching:

```ts
function matchUniqueTagInPool(pool: Candidate[], tag: string): Sprite | null {
  const exact = pool.filter((c) => c.sprite.tag === tag)
  if (exact.length === 1) return exact[0].sprite
  if (exact.length > 1) return null
  const fuzzy = pool.filter((c) => nameMatches(c.sprite.tag, tag))
  return fuzzy.length === 1 ? fuzzy[0].sprite : null
}
```

For outfit filtering, retain every exact match; when only fuzzy matches exist, retain all fuzzy candidates and let final uniqueness decide.

- [x] **Step 5: Deduplicate identical Prompt addresses**

Update `getActiveAddresses()` to preserve first occurrence order:

```ts
const out: SpriteAddress[] = []
const seen = new Set<string>()
for (const c of flatten(getActivePacks(settings, characterName))) {
  const address = { role: c.role, outfit: c.outfit, tag: c.sprite.tag }
  const key = formatAddress(address)
  if (!seen.has(key)) {
    seen.add(key)
    out.push(address)
  }
}
return out
```

- [x] **Step 6: Run the focused tests and verify GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run core/sprite-store.test.ts --reporter=verbose
```

Expected: all `core/sprite-store.test.ts` tests pass. If an old test expected first-match ambiguity, update only that expectation to the approved safe-`null` policy.

### Task 3: Add and implement effective-address CRUD cleanup

**Files:**
- Modify: `core/sprite-store.test.ts`
- Modify: `core/sprite-store.ts`

- [x] **Step 1: Add failing CRUD tests**

```ts
it('设置为包级继承人名时规范化为未分组，不与自己冲突', () => {
  const base: SpritePack = {
    id: 'p1',
    name: '鸣人包',
    roleName: '鸣人',
    sprites: [{ tag: '微笑', url: 'v1' }],
  }
  const next = setSpriteGroup(base, '微笑', '', '鸣人')
  expect(next.sprites[0].group).toBeUndefined()
  expect(getGroups(next)).toEqual([])
})

it('upsert 清理历史遗留的相同有效地址重复项', () => {
  const base: SpritePack = {
    id: 'p1',
    name: '鸣人包',
    roleName: '鸣人',
    sprites: [
      { tag: '微笑', url: 'old-a' },
      { tag: '微笑', url: 'old-b', group: '鸣人' },
    ],
  }
  const next = upsertSprite(base, { tag: '微笑', url: 'new', group: '鸣人' })
  expect(next.sprites).toEqual([{ tag: '微笑', url: 'new' }])
})
```

- [x] **Step 2: Run the CRUD tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run core/sprite-store.test.ts -t "设置为包级继承人名|upsert 清理历史" --reporter=verbose
```

Expected: `setSpriteGroup` throws a self-collision error and `upsertSprite` leaves the second duplicate.

- [x] **Step 3: Normalize and deduplicate sprite lists by effective identity**

Implement:

```ts
function identityKey(pack: SpritePack, sprite: Sprite): string {
  return JSON.stringify([
    effectiveRole(pack, spriteGroup(sprite)),
    effectiveOutfitOf(pack, spriteOutfitTag(sprite)),
    sprite.tag,
  ])
}

function dedupeSprites(pack: SpritePack, sprites: Sprite[]): Sprite[] {
  const seen = new Set<string>()
  const out: Sprite[] = []
  for (const raw of sprites) {
    const sprite = normalizeIdentityFields(pack, raw)
    const key = identityKey(pack, sprite)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(sprite)
  }
  return out
}
```

Change `upsertSprite()` so the new sprite replaces the first matching effective identity, all later duplicates are removed, and insertion order is preserved.

```ts
export function upsertSprite(pack: SpritePack, sprite: Sprite): SpritePack {
  const stored = normalizeIdentityFields(pack, sprite)
  const group = spriteGroup(stored)
  const outfit = spriteOutfitTag(stored)
  const sprites: Sprite[] = []
  let replaced = false

  for (const current of pack.sprites) {
    if (sameIdentity(pack, current, stored.tag, group, outfit)) {
      if (!replaced) {
        sprites.push(stored)
        replaced = true
      }
      continue
    }
    sprites.push(current)
  }
  if (!replaced) sprites.push(stored)
  return touchPack(pack, dedupeSprites(pack, sprites))
}
```

- [x] **Step 4: Exclude source entries from set-group collision checks**

Implement the source/target flow:

```ts
const sources = new Set(
  pack.sprites.filter((s) => sameIdentity(pack, s, tag, fromGroup, outfit)),
)
if (
  pack.sprites.some(
    (s) => !sources.has(s) && sameIdentity(pack, s, tag, toGroup, outfit),
  )
) {
  throw new Error(`分组「${toGroup || '未分组'}」中已存在表情「${tag}」`)
}

const sprites = pack.sprites.map((s) => {
  if (!sources.has(s)) return s
  const next = { ...s }
  if (toGroup) next.group = toGroup
  else delete next.group
  return normalizeIdentityFields(pack, next)
})
return touchPack(pack, dedupeSprites(pack, sprites))
```

Remove the raw-string early return when `toGroup === fromGroup` if it would prevent normalization; returning the original pack is allowed only when no field or duplicate cleanup is required.

- [x] **Step 5: Run focused and full core tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run core/sprite-store.test.ts --reporter=verbose
```

Expected: all sprite-store tests pass, including existing outfit and CRUD cases.

### Task 4: Full verification and review handoff

**Files:**
- Rebuild: `index.js`
- Verify only: all tracked source and test files

- [x] **Step 1: Run the complete test suite**

```powershell
.\node_modules\.bin\vitest.cmd run --reporter=dot
```

Expected: all test files and tests pass with exit code 0.

- [x] **Step 2: Run typecheck and lint**

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\eslint.cmd core st-extension/src lib components app --max-warnings=0
```

Expected: both commands exit 0 with no diagnostics.

- [x] **Step 3: Rebuild extension and Web app**

```powershell
node st-extension/build.mjs
.\node_modules\.bin\next.cmd build
```

Expected: `index.js` is regenerated, extension build reports success, and Next.js produces the static `/` route.

- [x] **Step 4: Verify symbols, control bytes, and workspace cleanliness**

```powershell
rg -n "encodePackId|canonicalRoleToken|parseCanonicalRole|buildPromptPrefixes|packDisc" core/sprite-store.ts index.js
git diff --check
git status --short
$targets = @('core/sprite-store.ts', 'core/sprite-store.test.ts', 'index.js')
foreach ($file in $targets) {
  $bytes = [System.IO.File]::ReadAllBytes((Join-Path (Get-Location) $file))
  $count = @($bytes | Where-Object {
    (($_ -lt 32) -and ($_ -notin 9, 10, 13)) -or ($_ -eq 127)
  }).Count
  Write-Output "$file control-bytes=$count"
}
```

Expected:

- New helpers appear in source and bundle.
- `buildPromptPrefixes` and `packDisc` no longer appear.
- No control bytes exist in `core/sprite-store.ts`, `core/sprite-store.test.ts`, or `index.js`.
- No temporary reproduction test remains.
- The working tree remains uncommitted for Claude review.

- [x] **Step 5: Produce the Claude review handoff**

Summarize changed invariants, exact regression cases, verification commands, and remaining known limitation: ambiguous historical bare addresses return `null` because no persisted alias history exists.
