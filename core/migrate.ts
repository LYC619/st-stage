/**
 * 旧版（一期）设置 → v2 设置的一次性迁移。
 * 旧立绘条目形如 { tag, url }，升级为 { id, label, tags, source, ref }。
 */

import type { PluginSettings, SpriteEntry, SpritePack } from './types'
import { createDefaultSettings } from './types'
import { createEntry } from './sprite-store'

interface LegacySprite {
  tag: string
  url: string
}

/** 判断一个包是否为旧格式（无 version 字段或条目带 tag/url） */
function isLegacyPack(pack: unknown): boolean {
  const p = pack as { version?: number; sprites?: unknown[] }
  if (p.version === 2) return false
  const first = p.sprites?.[0] as LegacySprite | undefined
  return first !== undefined && typeof first.tag === 'string' && typeof first.url === 'string'
}

function migrateLegacySprite(s: LegacySprite): SpriteEntry {
  if (s.url.startsWith('data:')) return createEntry(s.tag, 'embedded', s.url)
  // 旧版 url 是完整地址：cloudPrefix='' + ref=完整 URL
  return createEntry(s.tag, 'cloud', s.url)
}

function migrateLegacyPack(pack: {
  id: string
  name: string
  author?: string
  description?: string
  sprites: LegacySprite[]
}): SpritePack {
  return {
    id: pack.id,
    name: pack.name,
    version: 2,
    author: pack.author,
    description: pack.description,
    cloudPrefix: '',
    sprites: pack.sprites.map(migrateLegacySprite),
  }
}

/**
 * 将任意版本的持久化设置迁移到当前 v2 结构。
 * - 补齐新增字段（phone/regexDisplay）
 * - 旧格式包自动升级
 * - 幂等：v2 数据原样通过
 */
export function migrateSettings(saved: unknown): PluginSettings {
  const defaults = createDefaultSettings()
  if (!saved || typeof saved !== 'object') return defaults
  const s = saved as Partial<PluginSettings> & { packs?: unknown[] }

  const packs: SpritePack[] = (s.packs ?? []).map((p) =>
    isLegacyPack(p) ? migrateLegacyPack(p as Parameters<typeof migrateLegacyPack>[0]) : (p as SpritePack),
  )

  return {
    ...defaults,
    ...s,
    // 深合并嵌套对象，防止旧数据缺字段
    overlay: { ...defaults.overlay, ...(s.overlay ?? {}) },
    phone: { ...defaults.phone, ...(s.phone ?? {}) },
    packs,
    bindings: s.bindings ?? [],
  }
}
