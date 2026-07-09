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

/**
 * 一条消息的多个标签 → 有序立绘序列（功能③）。
 * 逐个模糊匹配，未命中的标签跳过；折叠相邻重复（同一张连着出现只保留一次），
 * 保留 A→B→A 这种往返。返回空数组表示没有任何标签命中（调用方保持当前立绘）。
 */
export function matchSprites(pack: SpritePack, tags: string[]): Sprite[] {
  const out: Sprite[] = []
  for (const tag of tags) {
    const sprite = matchSprite(pack, tag)
    if (sprite && (out.length === 0 || out[out.length - 1].tag !== sprite.tag)) {
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

/** 在包内新增或替换立绘（同 tag 覆盖 url/code） */
export function upsertSprite(pack: SpritePack, sprite: Sprite): SpritePack {
  const idx = pack.sprites.findIndex((s) => s.tag === sprite.tag)
  const sprites =
    idx >= 0
      ? pack.sprites.map((s, i) => (i === idx ? sprite : s))
      : [...pack.sprites, sprite]
  return touchPack(pack, sprites)
}

/** 删除包内一张立绘；若删的是封面则清掉 coverTag */
export function removeSprite(pack: SpritePack, tag: string): SpritePack {
  const next = touchPack(
    pack,
    pack.sprites.filter((s) => s.tag !== tag),
  )
  if (next.coverTag === tag) delete next.coverTag
  return next
}

/**
 * 重命名立绘 tag。失败时抛出带中文说明的 Error：
 * 新 tag 清洗后为空、或与包内其他立绘重名。
 */
export function renameSprite(pack: SpritePack, oldTag: string, newTagRaw: string): SpritePack {
  const newTag = normalizeTag(newTagRaw)
  if (!newTag) throw new Error('表情名不能为空，且不能包含 [ ] : | = @ 等符号')
  if (newTag === oldTag) return pack
  if (pack.sprites.some((s) => s.tag === newTag)) {
    throw new Error(`表情名「${newTag}」在该立绘包中已存在`)
  }
  const sprites = pack.sprites.map((s) => (s.tag === oldTag ? { ...s, tag: newTag } : s))
  const next = touchPack(pack, sprites)
  if (next.coverTag === oldTag) next.coverTag = newTag
  return next
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
