/**
 * 设置存储迁移：把任意历史版本的持久化对象升级到当前 SETTINGS_VERSION。
 * 两端适配器 loadSettings 统一调用，保证旧用户升级插件后数据不丢、字段齐全。
 *
 * v1 → v2：
 * - 补 settingsVersion / renderInlineImages / imageHost 字段
 * - sprite.url 为图床 URL 时反推 code（URL 最后一段文件名）
 * - tag / 包名过 naming.ts 清洗（清洗后为空或重复的条目原样保留 tag，不静默丢图）
 */

import type { PluginSettings, SpritePack } from './types'
import { createDefaultSettings, SETTINGS_VERSION } from './types'
import { normalizeTag, sanitizePackName } from './naming'
import { extractImageCode } from './share-code'

/** 判断持久化对象是否需要迁移 */
export function needsMigration(saved: unknown): boolean {
  if (!saved || typeof saved !== 'object') return false
  return (saved as Partial<PluginSettings>).settingsVersion !== SETTINGS_VERSION
}

/**
 * 迁移入口：任意历史版本 → 当前版本。
 * 输入不可信（可能是手改过的 JSON），逐字段容错，异常字段回退默认值。
 */
export function migrateSettings(saved: unknown): PluginSettings {
  const defaults = createDefaultSettings()
  if (!saved || typeof saved !== 'object') return defaults
  const raw = saved as Partial<PluginSettings>

  return {
    settingsVersion: SETTINGS_VERSION,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : defaults.enabled,
    hideTagInMessage:
      typeof raw.hideTagInMessage === 'boolean' ? raw.hideTagInMessage : defaults.hideTagInMessage,
    renderInlineImages:
      typeof raw.renderInlineImages === 'boolean'
        ? raw.renderInlineImages
        : defaults.renderInlineImages,
    imageHost:
      typeof raw.imageHost === 'string' && /^https?:\/\//.test(raw.imageHost)
        ? raw.imageHost
        : defaults.imageHost,
    overlay: migrateOverlay(raw.overlay, defaults.overlay),
    phone: migratePhone(raw.phone, defaults.phone),
    showPhone: typeof raw.showPhone === 'boolean' ? raw.showPhone : defaults.showPhone,
    packs: Array.isArray(raw.packs) ? raw.packs.flatMap((p) => migratePack(p) ?? []) : [],
    bindings: Array.isArray(raw.bindings)
      ? raw.bindings.filter(
          (b) =>
            b &&
            typeof b.characterName === 'string' &&
            typeof b.packId === 'string' &&
            typeof b.enabled === 'boolean',
        )
      : [],
    apps: raw.apps && typeof raw.apps === 'object' && !Array.isArray(raw.apps) ? raw.apps : {},
  }
}

function migrateOverlay(
  raw: PluginSettings['overlay'] | undefined,
  fallback: PluginSettings['overlay'],
): PluginSettings['overlay'] {
  if (
    raw &&
    typeof raw.x === 'number' &&
    typeof raw.y === 'number' &&
    typeof raw.width === 'number' &&
    Number.isFinite(raw.x + raw.y + raw.width)
  ) {
    return { x: raw.x, y: raw.y, width: raw.width }
  }
  return fallback
}

function migratePhone(
  raw: PluginSettings['phone'] | undefined,
  fallback: PluginSettings['phone'],
): PluginSettings['phone'] {
  if (
    raw &&
    typeof raw.x === 'number' &&
    typeof raw.y === 'number' &&
    Number.isFinite(raw.x + raw.y)
  ) {
    return { x: raw.x, y: raw.y, open: typeof raw.open === 'boolean' ? raw.open : fallback.open }
  }
  return fallback
}

/** 单个包迁移；结构完全非法时返回 null（丢弃并由调用方 flatMap 过滤） */
function migratePack(raw: unknown): SpritePack | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Partial<SpritePack>
  if (typeof p.id !== 'string' || !p.id || !Array.isArray(p.sprites)) return null

  const name = sanitizePackName(typeof p.name === 'string' ? p.name : '') || '未命名立绘包'
  const sprites = p.sprites.flatMap((s) => {
    if (!s || typeof s.tag !== 'string' || typeof s.url !== 'string' || !s.url) return []
    // 清洗失败（结果为空）时保留原 tag：宁可留下不规范旧 tag，也不静默丢用户的图
    const tag = normalizeTag(s.tag) || s.tag.trim()
    if (!tag) return []
    const code =
      typeof s.code === 'string' && s.code ? s.code : (extractImageCode(s.url) ?? undefined)
    return [{ tag, url: s.url, ...(code ? { code } : {}) }]
  })

  return {
    id: p.id,
    name,
    ...(typeof p.author === 'string' && p.author ? { author: p.author } : {}),
    ...(typeof p.description === 'string' && p.description ? { description: p.description } : {}),
    ...(typeof p.coverTag === 'string' && p.coverTag ? { coverTag: p.coverTag } : {}),
    ...(typeof p.updatedAt === 'string' && p.updatedAt ? { updatedAt: p.updatedAt } : {}),
    sprites,
  }
}
