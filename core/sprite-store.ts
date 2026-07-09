/**
 * 立绘包管理逻辑：增删改查、角色绑定解析、标签 → 图片匹配（含模糊回退）。
 * 纯函数式，状态由调用方（适配器）持有并持久化。
 */

import type { PluginSettings, Sprite, SpritePack } from './types'
import { normalizeTag } from './naming'

/** 生成简单唯一 ID */
export function genId(): string {
  return `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 获取某角色当前启用的立绘包，无绑定或未启用返回 null */
export function getActivePack(settings: PluginSettings, characterName: string): SpritePack | null {
  const binding = settings.bindings.find((b) => b.characterName === characterName && b.enabled)
  if (!binding) return null
  return settings.packs.find((p) => p.id === binding.packId) ?? null
}

/** 获取某角色可用的标签列表（用于 prompt 注入） */
export function getAvailableTags(settings: PluginSettings, characterName: string): string[] {
  const pack = getActivePack(settings, characterName)
  return pack ? pack.sprites.map((s) => s.tag) : []
}

/**
 * 标签 → 立绘匹配，带模糊回退：
 * 1. 精确匹配
 * 2. 立绘标签包含提取标签，或提取标签包含立绘标签（子串）
 * 3. 都失败返回 null（调用方保持当前立绘不变）
 */
export function matchSprite(pack: SpritePack, tag: string): Sprite | null {
  const normalized = tag.trim()
  if (!normalized) return null

  const exact = pack.sprites.find((s) => s.tag === normalized)
  if (exact) return exact

  const partial = pack.sprites.find(
    (s) => s.tag.includes(normalized) || normalized.includes(s.tag),
  )
  return partial ?? null
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

/** 在指定分组内按 tag 匹配（精确→子串）。group 为空串表示只在「未分组」里找 */
function matchInGroup(pack: SpritePack, group: string, tag: string): Sprite | null {
  const g = group.trim()
  const pool = pack.sprites.filter((s) => {
    const sg = spriteGroup(s)
    if (!g) return sg === '' // 查询无分组 → 只匹配未分组立绘
    if (!sg) return false // 未分组立绘不匹配具名分组
    return sg === g || sg.includes(g) || g.includes(sg)
  })
  const exact = pool.find((s) => s.tag === tag)
  if (exact) return exact
  return pool.find((s) => s.tag.includes(tag) || tag.includes(s.tag)) ?? null
}

/**
 * 地址 → 立绘匹配（功能②）：
 * - 含 `/`：拆成「分组/图名」，先在该分组内按图名匹配；失败回退按图名全局匹配
 * - 不含 `/`：按图名全局匹配（等价 matchSprite，完全兼容旧行为）
 */
export function matchAddress(pack: SpritePack, address: string): Sprite | null {
  const raw = address.trim()
  if (!raw) return null
  const slash = raw.indexOf('/')
  if (slash >= 0) {
    const group = raw.slice(0, slash).trim()
    const tag = raw.slice(slash + 1).trim()
    const inGroup = matchInGroup(pack, group, tag)
    if (inGroup) return inGroup
    // 回退：忽略分组按图名匹配，再退而用整段
    return matchSprite(pack, tag) ?? matchSprite(pack, raw)
  }
  return matchSprite(pack, raw)
}

/**
 * 一条消息的多个标签 → 有序立绘序列（功能③，兼容功能②的 分组/图名 地址）。
 * 逐个按地址匹配；未命中跳过；折叠相邻重复（同一张连着出现只保留一次），
 * 保留 A→B→A 往返。空数组表示无命中（调用方保持当前立绘不变）。
 */
export function matchSprites(pack: SpritePack, addresses: string[]): Sprite[] {
  const out: Sprite[] = []
  for (const address of addresses) {
    const sprite = matchAddress(pack, address)
    if (sprite && out[out.length - 1] !== sprite) {
      out.push(sprite)
    }
  }
  return out
}

/** 添加/更新立绘包（同 id 覆盖），返回新 settings */
export function upsertPack(settings: PluginSettings, pack: SpritePack): PluginSettings {
  const exists = settings.packs.some((p) => p.id === pack.id)
  return {
    ...settings,
    packs: exists ? settings.packs.map((p) => (p.id === pack.id ? pack : p)) : [...settings.packs, pack],
  }
}

/** 删除立绘包，并清理相关绑定 */
export function removePack(settings: PluginSettings, packId: string): PluginSettings {
  return {
    ...settings,
    packs: settings.packs.filter((p) => p.id !== packId),
    bindings: settings.bindings.filter((b) => b.packId !== packId),
  }
}

/** 绑定角色到立绘包（覆盖旧绑定） */
export function bindCharacter(
  settings: PluginSettings,
  characterName: string,
  packId: string,
): PluginSettings {
  const others = settings.bindings.filter((b) => b.characterName !== characterName)
  return {
    ...settings,
    bindings: [...others, { characterName, packId, enabled: true }],
  }
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
