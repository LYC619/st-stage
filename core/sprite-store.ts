/**
 * 立绘包管理逻辑：增删改查、角色绑定解析、标签 → 图片匹配（含模糊回退）。
 * 纯函数式，状态由调用方（适配器）持有并持久化。
 */

import type { PluginSettings, Sprite, SpriteAddress, SpritePack } from './types'
import { parseAddress, spriteOutfit, spriteRole } from './types'
import { normalizeTag } from './naming'

/** 生成简单唯一 ID */
export function genId(): string {
  return `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 获取某角色当前启用的全部立绘包（按绑定顺序；无绑定/未启用返回空数组） */
export function getActivePacks(settings: PluginSettings, characterName: string): SpritePack[] {
  const binding = settings.bindings.find((b) => b.characterName === characterName && b.enabled)
  if (!binding) return []
  const byId = new Map(settings.packs.map((p) => [p.id, p]))
  return binding.packIds.map((id) => byId.get(id)).filter((p): p is SpritePack => p != null)
}

/** 获取某角色第一个启用的立绘包（单包场景的便捷入口；多包匹配请用 getActivePacks） */
export function getActivePack(settings: PluginSettings, characterName: string): SpritePack | null {
  return getActivePacks(settings, characterName)[0] ?? null
}

/** 某角色全部启用包的完整地址坐标（用于 prompt 注入） */
export function getActiveAddresses(
  settings: PluginSettings,
  characterName: string,
): SpriteAddress[] {
  const out: SpriteAddress[] = []
  for (const pack of getActivePacks(settings, characterName)) {
    for (const s of pack.sprites) {
      out.push({ role: spriteRole(pack, s), outfit: spriteOutfit(pack, s), tag: s.tag })
    }
  }
  return out
}

/** 获取某角色可用的标签列表（单包纯图名场景的便捷入口） */
export function getAvailableTags(settings: PluginSettings, characterName: string): string[] {
  const pack = getActivePack(settings, characterName)
  return pack ? pack.sprites.map((s) => s.tag) : []
}

/** 立绘的分组标签（功能②），缺省为空串 */
export function spriteGroup(sprite: Sprite): string {
  return sprite.group ?? ''
}

/** 包内出现过的分组（非空、按首次出现顺序去重），用于 UI 与 prompt 枚举 */
export function getGroups(pack: SpritePack): string[] {
  const seen: string[] = []
  for (const s of pack.sprites) {
    const g = spriteGroup(s)
    if (g && !seen.includes(g)) seen.push(g)
  }
  return seen
}

/** 展平的立绘候选：携带所属包及三级坐标，供严格解析用 */
interface Candidate {
  pack: SpritePack
  sprite: Sprite
  role: string
  outfit: string
}

function flatten(packs: SpritePack[]): Candidate[] {
  const out: Candidate[] = []
  for (const pack of packs) {
    for (const sprite of pack.sprites) {
      out.push({ pack, sprite, role: spriteRole(pack, sprite), outfit: spriteOutfit(pack, sprite) })
    }
  }
  return out
}

/** 名称匹配：精确优先，其次双向子串（用于人名/服装/图名各层的容错） */
function nameMatches(actual: string, query: string): boolean {
  if (actual === query) return true
  return actual.length > 0 && (actual.includes(query) || query.includes(actual))
}

/**
 * 按人名锁定候选（严格·禁止跨角色回退）：
 * 先取精确同名；无精确时用子串匹配，但锁定到「首个匹配到的那个人名」，
 * 不把多个不同人名混在一起（避免 鸣人 误匹配 雷鸣 后又混入其他人）。
 * 请求的人名在候选中完全不存在时返回空数组（调用方据此判定失败，不跨包回退）。
 */
function lockByName(pool: Candidate[], query: string, of: (c: Candidate) => string): Candidate[] {
  const exact = pool.filter((c) => of(c) === query)
  if (exact.length > 0) return exact
  const fuzzy = pool.filter((c) => nameMatches(of(c), query))
  if (fuzzy.length === 0) return []
  const locked = of(fuzzy[0])
  return fuzzy.filter((c) => of(c) === locked)
}

/** 在已锁定人名/服装的候选池内按图名匹配（精确→双向子串） */
function matchTagInPool(pool: Candidate[], tag: string): Sprite | null {
  const exact = pool.find((c) => c.sprite.tag === tag)
  if (exact) return exact.sprite
  const partial = pool.find((c) => c.sprite.tag.includes(tag) || tag.includes(c.sprite.tag))
  return partial?.sprite ?? null
}

/**
 * 多包严格地址解析（六期核心）：地址 → 立绘。
 * - 「图名」：全局按图名匹配（单包简写；多包时取首个命中）
 * - 「人名/图名」：先严格锁人名，锁定后在该人名范围内匹配图名；人名不存在→null
 * - 「人名/服装/图名」：依次严格锁人名、锁服装，再匹配图名；任一层不存在→null
 * 禁止跨包回退：人名/服装指定后，绝不落到其他角色的同名图名上。
 */
export function resolveSprite(packs: SpritePack[], address: string): Sprite | null {
  const raw = address.trim()
  if (!raw) return null
  const { role, outfit, tag } = parseAddress(raw)
  if (!tag) return null

  let pool = flatten(packs)
  if (role) {
    pool = lockByName(pool, role, (c) => c.role)
    if (pool.length === 0) return null // 严格：请求人名不存在，不跨角色回退
  }
  if (outfit) {
    pool = lockByName(pool, outfit, (c) => c.outfit)
    if (pool.length === 0) return null // 严格：请求服装不存在，不跨服装回退
  }
  return matchTagInPool(pool, tag)
}

/**
 * 一条消息的多个地址 → 有序立绘序列（功能③，多包严格寻址）。
 * 逐个解析；未命中跳过；折叠相邻重复（同一张连着出现只保留一次），保留 A→B→A 往返。
 */
export function resolveSprites(packs: SpritePack[], addresses: string[]): Sprite[] {
  const out: Sprite[] = []
  for (const address of addresses) {
    const sprite = resolveSprite(packs, address)
    if (sprite && out[out.length - 1] !== sprite) out.push(sprite)
  }
  return out
}

/* ---------- 单包匹配（向后兼容：单包场景仍可直接用 pack 匹配） ---------- */

/**
 * 标签 → 立绘匹配，带模糊回退（单包）：精确 → 双向子串 → null。
 */
export function matchSprite(pack: SpritePack, tag: string): Sprite | null {
  const normalized = tag.trim()
  if (!normalized) return null
  const exact = pack.sprites.find((s) => s.tag === normalized)
  if (exact) return exact
  return pack.sprites.find((s) => s.tag.includes(normalized) || normalized.includes(s.tag)) ?? null
}

/** 地址 → 立绘匹配（单包）：等价 resolveSprite([pack], address)。 */
export function matchAddress(pack: SpritePack, address: string): Sprite | null {
  return resolveSprite([pack], address)
}

/** 一条消息的多个标签 → 有序立绘序列（单包）：等价 resolveSprites([pack], addresses)。 */
export function matchSprites(pack: SpritePack, addresses: string[]): Sprite[] {
  return resolveSprites([pack], addresses)
}

/** 添加/更新立绘包（同 id 覆盖），返回新 settings */
export function upsertPack(settings: PluginSettings, pack: SpritePack): PluginSettings {
  const exists = settings.packs.some((p) => p.id === pack.id)
  return {
    ...settings,
    packs: exists ? settings.packs.map((p) => (p.id === pack.id ? pack : p)) : [...settings.packs, pack],
  }
}

/** 删除立绘包，并从所有绑定中摘除该包（绑定变空时整条移除） */
export function removePack(settings: PluginSettings, packId: string): PluginSettings {
  const bindings = settings.bindings
    .map((b) => ({ ...b, packIds: b.packIds.filter((id) => id !== packId) }))
    .filter((b) => b.packIds.length > 0)
  return {
    ...settings,
    packs: settings.packs.filter((p) => p.id !== packId),
    bindings,
  }
}

/** 给角色的启用包集合追加一个包（已在其中则不动；自动启用绑定） */
export function bindPack(
  settings: PluginSettings,
  characterName: string,
  packId: string,
): PluginSettings {
  const existing = settings.bindings.find((b) => b.characterName === characterName)
  if (existing) {
    if (existing.packIds.includes(packId)) {
      return { ...settings, bindings: settings.bindings.map((b) => (b === existing ? { ...b, enabled: true } : b)) }
    }
    return {
      ...settings,
      bindings: settings.bindings.map((b) =>
        b === existing ? { ...b, packIds: [...b.packIds, packId], enabled: true } : b,
      ),
    }
  }
  return {
    ...settings,
    bindings: [...settings.bindings, { characterName, packIds: [packId], enabled: true }],
  }
}

/** 从角色的启用包集合中移除一个包（绑定变空时整条移除） */
export function unbindPack(
  settings: PluginSettings,
  characterName: string,
  packId: string,
): PluginSettings {
  const bindings = settings.bindings
    .map((b) =>
      b.characterName === characterName
        ? { ...b, packIds: b.packIds.filter((id) => id !== packId) }
        : b,
    )
    .filter((b) => b.packIds.length > 0)
  return { ...settings, bindings }
}

/** 设置角色的启用包集合（整体替换，去重丢空；空集合则移除绑定） */
export function setBinding(
  settings: PluginSettings,
  characterName: string,
  packIds: string[],
): PluginSettings {
  const ids: string[] = []
  for (const id of packIds) if (id && !ids.includes(id)) ids.push(id)
  const others = settings.bindings.filter((b) => b.characterName !== characterName)
  if (ids.length === 0) return { ...settings, bindings: others }
  const prev = settings.bindings.find((b) => b.characterName === characterName)
  return {
    ...settings,
    bindings: [...others, { characterName, packIds: ids, enabled: prev?.enabled ?? true }],
  }
}

/** 调整角色启用包的顺序（把 packId 从 fromIndex 移到 toIndex） */
export function reorderBinding(
  settings: PluginSettings,
  characterName: string,
  fromIndex: number,
  toIndex: number,
): PluginSettings {
  return {
    ...settings,
    bindings: settings.bindings.map((b) => {
      if (b.characterName !== characterName) return b
      const ids = [...b.packIds]
      if (fromIndex < 0 || fromIndex >= ids.length || toIndex < 0 || toIndex >= ids.length) return b
      const [moved] = ids.splice(fromIndex, 1)
      ids.splice(toIndex, 0, moved)
      return { ...b, packIds: ids }
    }),
  }
}

/** 绑定角色到单个立绘包（覆盖旧绑定为仅此一包；兼容旧调用方） */
export function bindCharacter(
  settings: PluginSettings,
  characterName: string,
  packId: string,
): PluginSettings {
  return setBinding(settings, characterName, [packId])
}

/* ---------- 单张立绘操作（M2 图库管理） ---------- */

/** 更新包内容并盖 updatedAt 时间戳 */
function touchPack(pack: SpritePack, sprites: Sprite[]): SpritePack {
  return { ...pack, sprites, updatedAt: new Date().toISOString() }
}

/** 在包内新增或替换立绘（同 分组+tag 覆盖 url/code） */
export function upsertSprite(pack: SpritePack, sprite: Sprite): SpritePack {
  const g = spriteGroup(sprite)
  const idx = pack.sprites.findIndex((s) => s.tag === sprite.tag && spriteGroup(s) === g)
  const sprites =
    idx >= 0
      ? pack.sprites.map((s, i) => (i === idx ? sprite : s))
      : [...pack.sprites, sprite]
  return touchPack(pack, sprites)
}

/** 删除包内一张立绘（按 分组+tag 定位）；若该 tag 已无任何立绘且是封面则清掉 coverTag */
export function removeSprite(pack: SpritePack, tag: string, group = ''): SpritePack {
  const next = touchPack(
    pack,
    pack.sprites.filter((s) => !(s.tag === tag && spriteGroup(s) === group)),
  )
  if (next.coverTag === tag && !next.sprites.some((s) => s.tag === tag)) delete next.coverTag
  return next
}

/**
 * 重命名立绘 tag（在其所在分组内）。失败时抛出带中文说明的 Error：
 * 新 tag 清洗后为空、或与同分组内其他立绘重名。
 */
export function renameSprite(
  pack: SpritePack,
  oldTag: string,
  newTagRaw: string,
  group = '',
): SpritePack {
  const newTag = normalizeTag(newTagRaw)
  if (!newTag) throw new Error('表情名不能为空，且不能包含 [ ] / : | = @ 等符号')
  if (newTag === oldTag) return pack
  if (pack.sprites.some((s) => s.tag === newTag && spriteGroup(s) === group)) {
    throw new Error(`表情名「${newTag}」在该分组中已存在`)
  }
  const sprites = pack.sprites.map((s) =>
    s.tag === oldTag && spriteGroup(s) === group ? { ...s, tag: newTag } : s,
  )
  const next = touchPack(pack, sprites)
  if (next.coverTag === oldTag) next.coverTag = newTag
  return next
}

/**
 * 修改某张立绘的分组（按当前 分组+tag 定位，功能②）。
 * 目标分组内若已有同 tag 立绘则抛错避免撞车；toGroup 清洗后为空表示移出分组。
 */
export function setSpriteGroup(
  pack: SpritePack,
  tag: string,
  fromGroup: string,
  toGroupRaw: string,
): SpritePack {
  const toGroup = normalizeTag(toGroupRaw)
  if (toGroup === fromGroup) return pack
  if (pack.sprites.some((s) => s.tag === tag && spriteGroup(s) === toGroup)) {
    throw new Error(`分组「${toGroup || '未分组'}」中已存在表情「${tag}」`)
  }
  const sprites = pack.sprites.map((s) => {
    if (!(s.tag === tag && spriteGroup(s) === fromGroup)) return s
    const next = { ...s }
    if (toGroup) next.group = toGroup
    else delete next.group
    return next
  })
  return touchPack(pack, sprites)
}

/** 移动立绘顺序（fromIndex → toIndex，越界时原样返回） */
export function moveSprite(pack: SpritePack, fromIndex: number, toIndex: number): SpritePack {
  const len = pack.sprites.length
  if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= len || toIndex < 0 || toIndex >= len) {
    return pack
  }
  const sprites = [...pack.sprites]
  const [moved] = sprites.splice(fromIndex, 1)
  sprites.splice(toIndex, 0, moved)
  return touchPack(pack, sprites)
}

/** 切换角色绑定的启用状态 */
export function toggleBinding(settings: PluginSettings, characterName: string, enabled: boolean): PluginSettings {
  return {
    ...settings,
    bindings: settings.bindings.map((b) =>
      b.characterName === characterName ? { ...b, enabled } : b,
    ),
  }
}

/** 预加载一个立绘包的全部图片（浏览器环境） */
export function preloadPack(pack: SpritePack): void {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return
  for (const sprite of pack.sprites) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = sprite.url
  }
}
