/**
 * 立绘包管理逻辑（v2）：增删改查、角色绑定解析、标签 → 图片匹配、URL 解析。
 * 纯函数式，状态由调用方（适配器）持有并持久化。
 */

import type { PluginSettings, SpriteEntry, SpritePack } from './types'
import { DEFAULT_CLOUD_PREFIX } from './types'

/** 生成简单唯一 ID */
export function genId(prefix = 'pack'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 创建一个 v2 立绘条目（tags 默认含 label） */
export function createEntry(
  label: string,
  source: SpriteEntry['source'],
  ref: string,
  tags?: string[],
): SpriteEntry {
  const trimmed = label.trim()
  const tagSet = new Set([trimmed, ...(tags ?? []).map((t) => t.trim()).filter(Boolean)])
  return { id: genId('spr'), label: trimmed, tags: [...tagSet], source, ref }
}

/**
 * 解析立绘条目的最终图片 URL。
 * @param baseUrl 扩展静态目录前缀（local 条目用；Web 端传 ''）
 */
export function resolveSpriteUrl(pack: SpritePack, entry: SpriteEntry, baseUrl = ''): string {
  switch (entry.source) {
    case 'cloud':
      return `${pack.cloudPrefix ?? DEFAULT_CLOUD_PREFIX}${entry.ref}`
    case 'local': {
      const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
      const path = entry.ref.startsWith('/') ? entry.ref : `/${entry.ref}`
      // 相对路径按段编码（处理中文文件名），已编码或含协议的跳过
      const encoded = path.includes('%')
        ? path
        : path.split('/').map((seg) => encodeURIComponent(seg)).join('/')
      return `${base}${encoded}`
    }
    case 'embedded':
    default:
      return entry.ref
  }
}

/** 获取某角色当前启用的立绘包，无绑定或未启用返回 null */
export function getActivePack(settings: PluginSettings, characterName: string): SpritePack | null {
  const binding = settings.bindings.find((b) => b.characterName === characterName && b.enabled)
  if (!binding) return null
  return settings.packs.find((p) => p.id === binding.packId) ?? null
}

/** 获取某角色可用的标签列表（用于 prompt 注入，取每条目的 label） */
export function getAvailableTags(settings: PluginSettings, characterName: string): string[] {
  const pack = getActivePack(settings, characterName)
  return pack ? pack.sprites.map((s) => s.label) : []
}

/**
 * 标签 → 立绘匹配（忽略大小写），带模糊回退：
 * 1. tags/label 精确匹配
 * 2. 子串互含（立绘标签含提取标签，或反之）
 * 3. 都失败返回 null（调用方保持当前立绘不变）
 */
export function matchSprite(pack: SpritePack, tag: string): SpriteEntry | null {
  const normalized = tag.trim().toLowerCase()
  if (!normalized) return null

  const allTags = (s: SpriteEntry) => [s.label, ...s.tags].map((t) => t.toLowerCase())

  const exact = pack.sprites.find((s) => allTags(s).includes(normalized))
  if (exact) return exact

  const partial = pack.sprites.find((s) =>
    allTags(s).some((t) => t.includes(normalized) || normalized.includes(t)),
  )
  return partial ?? null
}

/* ============ 包级操作 ============ */

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

/* ============ 单条目操作（图库管理） ============ */

/** 向包内添加立绘条目 */
export function addSprite(pack: SpritePack, entry: SpriteEntry): SpritePack {
  return { ...pack, sprites: [...pack.sprites, entry] }
}

/** 更新包内某条目（改 label/tags/ref 等） */
export function updateSprite(pack: SpritePack, entryId: string, patch: Partial<Omit<SpriteEntry, 'id'>>): SpritePack {
  return {
    ...pack,
    sprites: pack.sprites.map((s) => (s.id === entryId ? { ...s, ...patch } : s)),
  }
}

/** 删除包内单张立绘 */
export function removeSprite(pack: SpritePack, entryId: string): SpritePack {
  return { ...pack, sprites: pack.sprites.filter((s) => s.id !== entryId) }
}

/* ============ 角色绑定 ============ */

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
export function preloadPack(pack: SpritePack, baseUrl = ''): void {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return
  for (const entry of pack.sprites) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = resolveSpriteUrl(pack, entry, baseUrl)
  }
}
