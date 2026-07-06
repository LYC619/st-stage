/**
 * 立绘包管理逻辑：增删改查、角色绑定解析、标签 → 图片匹配（含模糊回退）。
 * 纯函数式，状态由调用方（适配器）持有并持久化。
 */

import type { PluginSettings, Sprite, SpritePack } from './types'

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
