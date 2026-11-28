import { t } from './i18n'
/**
 * 立绘包导入导出（sprite-pack@3 JSON 格式，导入兼容 @1 / @2）。
 * 导出时本地图片（ST 用户目录/扩展目录路径）自动内嵌 base64 —— 本地路径只在导出者
 * 机器上有效，不内嵌的话别人导入后图全裂；图床 URL 默认保持轻量，可选全部内嵌。
 * 一行紧凑分享串见 core/share-code.ts。
 */

import type { SpritePack, SpritePackFileV3 } from './types'
import { getSpriteSource } from './types'
import { genId } from './sprite-store'
import { normalizeTag, sanitizeDescription, sanitizePackName } from './naming'
import { extractImageCode } from './share-code'
import { recompressDataUri } from './image-compress'
import {
  normalizeLabels,
  normalizeInventoryPrompt,
  normalizeNote,
  normalizeOutfitNotes,
  normalizePackKind,
} from './sprite-metadata'

const RASTER_DATA_URI_REGEX = /^data:image\/(?:png|jpe?g|webp|gif|avif|bmp);base64,[A-Za-z0-9+/]+={0,2}$/i
const RASTER_IMAGE_MIME_REGEX = /^image\/(?:png|jpe?g|webp|gif|avif|bmp)$/i
const SAFE_LOCAL_SPRITE_PREFIX = /^(?:\/user\/images\/|\.\/|assets\/|\/assets\/|\/scripts\/extensions\/third-party\/)/i

/** 仅允许栅格位图 Data URI（禁止 image/svg+xml 等可执行矢量脚本）。 */
export function isSafeRasterDataUri(value: string): boolean {
  return RASTER_DATA_URI_REGEX.test(value)
}

/** 校验立绘地址：仅接受栅格 Data URI、无凭据 http(s) URL、或受控无穿越的本地图片路径。 */
export function isSafeSpriteUrl(value: string): boolean {
  if (isSafeRasterDataUri(value)) return true
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value)
      return (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        parsed.hostname.length > 0 &&
        !parsed.username &&
        !parsed.password
      )
    } catch {
      return false
    }
  }
  if (value.startsWith('//') || value.includes('\\') || value.includes('\0') || /[\s<>]/.test(value)) {
    return false
  }
  if (!SAFE_LOCAL_SPRITE_PREFIX.test(value)) return false
  const rawPath = value.split(/[?#]/, 1)[0].replace(/^\.\//, '')
  try {
    return !rawPath.split('/').some((segment) => {
      let decoded = segment
      for (let depth = 0; depth < 2; depth += 1) {
        decoded = decodeURIComponent(decoded)
        if (decoded === '.' || decoded === '..' || decoded.includes('\0') || /[\\/]/.test(decoded)) {
          return true
        }
      }
      return false
    })
  } catch {
    return false
  }
}

/**
 * 将 SpritePack 序列化为导出文件对象。
 * - data: 图源 → 始终内嵌
 * - 本地路径图源 → 始终尝试转 base64 内嵌（失败回退原路径）
 * - 图床 URL → 默认保留 URL；embedHosted 时也转 base64（离线分享，文件更大）
 */
export async function exportPack(pack: SpritePack, embedHosted = false): Promise<SpritePackFileV3> {
  const sprites: SpritePackFileV3['sprites'] = []
  for (const sprite of pack.sprites) {
    const source = getSpriteSource(sprite)
    const labels = normalizeLabels(sprite.labels)
    const extra = {
      ...remoteField(sprite),
      ...(sprite.group ? { group: sprite.group } : {}),
      ...(sprite.outfit ? { outfit: sprite.outfit } : {}),
      ...(labels.length > 0 ? { labels } : {}),
    }
    if (source === 'embedded') {
      // 补压缩兜底：早期未压缩的存量图/导入的胖 JSON，导出时在此收口（已压缩的 webp 直接跳过）
      sprites.push({ tag: sprite.tag, data: await recompressDataUri(sprite.url), ...extra })
    } else if (source === 'local' || embedHosted) {
      try {
        const data = await recompressDataUri(await urlToDataUri(sprite.url))
        sprites.push({ tag: sprite.tag, data, ...extra })
      } catch (err) {
        console.warn('[st-stage:pack-io] 本地立绘转内嵌数据失败，回退保留原路径:', sprite.tag, err)
        sprites.push({ tag: sprite.tag, url: sprite.url, ...codeField(sprite.url, sprite.code), ...extra })
      }
    } else {
      sprites.push({ tag: sprite.tag, url: sprite.url, ...codeField(sprite.url, sprite.code), ...extra })
    }
  }
  const promptNote = normalizeNote(pack.promptNote)
  const inventoryPrompt = normalizeInventoryPrompt(pack.inventoryPrompt)
  const outfitNotes = normalizeOutfitNotes(pack.outfitNotes)
  const sourceStoryKey = typeof pack.sourceStoryKey === 'string' ? pack.sourceStoryKey.trim() : ''
  const kind = normalizePackKind(pack.kind)
  const customTags = normalizeLabels(pack.customTags)
  return {
    format: 'sprite-pack@3',
    name: pack.name,
    author: pack.author,
    description: pack.description,
    ...(kind ? { kind } : {}),
    ...(customTags.length > 0 ? { customTags } : {}),
    ...(pack.roleName ? { roleName: pack.roleName } : {}),
    ...(pack.outfit ? { outfit: pack.outfit } : {}),
    ...(promptNote ? { promptNote } : {}),
    ...(inventoryPrompt ? { inventoryPrompt } : {}),
    ...(pack.promptNotePlacement === 'before-list' || pack.promptNotePlacement === 'after-list'
      ? { promptNotePlacement: pack.promptNotePlacement }
      : {}),
    ...(Object.keys(outfitNotes).length > 0 ? { outfitNotes } : {}),
    ...(sourceStoryKey ? { sourceStoryKey } : {}),
    coverTag: pack.coverTag,
    exportedAt: new Date().toISOString(),
    sprites,
  }
}

function codeField(url: string, code?: string): { code?: string } {
  const resolved = code ?? extractImageCode(url)
  return resolved ? { code: resolved } : {}
}

/** 导出时的远程直链字段：仅保留合法的 HTTPS remoteUrl（分享用），本地 url/data 另行保留 */
function remoteField(sprite: SpritePack['sprites'][number]): { remoteUrl?: string } {
  const r = sprite.remoteUrl
  return r && /^https:\/\/.+/i.test(r) && isSafeSpriteUrl(r) ? { remoteUrl: r } : {}
}

/** 解析导入的 JSON 文本为 SpritePack（@3 / @2 / @1 均可）。格式非法时抛出带说明的 Error。 */
export function importPack(jsonText: string): SpritePack {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new Error(t("sprite.manager.content.error.invalid_json", "导入失败：不是合法的 JSON 文件"))
  }
  // 各版本字段是超集关系，按宽结构收窄后统一处理
  const file = raw as {
    format?: string
    name?: unknown
    author?: unknown
    description?: unknown
    kind?: unknown
    customTags?: unknown
    roleName?: unknown
    outfit?: unknown
    inventoryPrompt?: unknown
    promptNote?: unknown
    promptNotePlacement?: unknown
    outfitNotes?: unknown
    sourceStoryKey?: unknown
    coverTag?: unknown
    sprites?: unknown
  }
  if (
    file.format !== 'sprite-pack@3' &&
    file.format !== 'sprite-pack@2' &&
    file.format !== 'sprite-pack@1'
  ) {
    throw new Error(t("sprite.manager.content.error.pack_format", "导入失败：不是 sprite-pack@1 / @2 / @3 格式的立绘包"))
  }
  if (typeof file.name !== 'string' || !file.name || !Array.isArray(file.sprites) || file.sprites.length === 0) {
    throw new Error(t("sprite.manager.content.error.empty_pack", "导入失败：立绘包缺少名称或立绘列表为空"))
  }

  const seen = new Set<string>()
  const sprites: SpritePack['sprites'] = []
  for (const item of file.sprites as Array<Record<string, unknown>>) {
    if (!item || typeof item.tag !== 'string') continue
    const url =
      typeof item.data === 'string' && isSafeRasterDataUri(item.data)
        ? item.data
        : typeof item.url === 'string' && isSafeSpriteUrl(item.url)
          ? item.url
          : ''
    if (!url) continue
    const tag = normalizeTag(item.tag)
    if (!tag) continue
    const group = typeof item.group === 'string' ? normalizeTag(item.group) : ''
    const outfit = typeof item.outfit === 'string' ? normalizeTag(item.outfit) : ''
    // 去重键含分组+服装：不同分组/服装可复用同一 tag（如 鸣人/微笑 与 佐助/微笑）
    const key = `${group}|${outfit}|${tag}`
    if (seen.has(key)) continue
    seen.add(key)
    const code =
      typeof item.code === 'string' && item.code ? item.code : (extractImageCode(url) ?? undefined)
    // remoteUrl 只接受合法无凭据 http/https，非法值直接丢弃；本地 url/data 与 remoteUrl 并存
    const remoteUrl =
      typeof item.remoteUrl === 'string' && /^https?:\/\/.+/i.test(item.remoteUrl) && isSafeSpriteUrl(item.remoteUrl)
        ? item.remoteUrl
        : ''
    const labels = normalizeLabels(item.labels)
    sprites.push({
      tag,
      url,
      ...(code ? { code } : {}),
      ...(remoteUrl ? { remoteUrl } : {}),
      ...(group ? { group } : {}),
      ...(outfit ? { outfit } : {}),
      ...(labels.length > 0 ? { labels } : {}),
    })
  }
  if (sprites.length === 0) {
    throw new Error(t("sprite.manager.content.error.no_entries", "导入失败：没有可用的立绘条目（表情名可能全部为空或重复）"))
  }

  const normalizedCover = typeof file.coverTag === 'string' ? normalizeTag(file.coverTag) : ''
  const coverTag = sprites.some((s) => s.tag === normalizedCover) ? normalizedCover : undefined
  const roleName = typeof file.roleName === 'string' ? normalizeTag(file.roleName) : ''
  const outfit = typeof file.outfit === 'string' ? normalizeTag(file.outfit) : ''
  const kind = normalizePackKind(file.kind)
  const customTags = normalizeLabels(file.customTags)
  const promptNote = normalizeNote(file.promptNote)
  const inventoryPrompt = normalizeInventoryPrompt(file.inventoryPrompt)
  const outfitNotes = normalizeOutfitNotes(file.outfitNotes)
  const sourceStoryKey = typeof file.sourceStoryKey === 'string' ? file.sourceStoryKey.trim() : ''

  return {
    id: genId(),
    name: sanitizePackName(file.name) || '导入立绘包',
    author:
      typeof file.author === 'string' ? sanitizePackName(file.author) || undefined : undefined,
    description:
      typeof file.description === 'string'
        ? sanitizeDescription(file.description) || undefined
        : undefined,
    ...(roleName ? { roleName } : {}),
    ...(outfit ? { outfit } : {}),
    ...(kind ? { kind } : {}),
    ...(customTags.length > 0 ? { customTags } : {}),
    ...(promptNote ? { promptNote } : {}),
    ...(inventoryPrompt ? { inventoryPrompt } : {}),
    ...(file.promptNotePlacement === 'before-list' || file.promptNotePlacement === 'after-list'
      ? { promptNotePlacement: file.promptNotePlacement }
      : {}),
    ...(Object.keys(outfitNotes).length > 0 ? { outfitNotes } : {}),
    ...(sourceStoryKey ? { sourceStoryKey } : {}),
    coverTag,
    updatedAt: new Date().toISOString(),
    sprites,
  }
}

/** 把远程/本地 URL 图片转为 data URI（补传图床、离线内嵌导出等复用） */
export async function urlToDataUri(url: string): Promise<string> {
  if (!isSafeSpriteUrl(url)) {
    throw new Error(t('storage.errors.image_format', '不支持的图片格式，请转换为 PNG、WebP 或 GIF 后重试'))
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(t('sprite.manager.content.error.image_fetch', '读取图片失败：{{url}}（HTTP {{status}}）', { url, status: res.status }))
  const blob = await res.blob()
  const mime = blob.type.split(';', 1)[0].trim().toLowerCase()
  if (!RASTER_IMAGE_MIME_REGEX.test(mime)) {
    throw new Error(t('storage.errors.image_format', '不支持的图片格式，请转换为 PNG、WebP 或 GIF 后重试'))
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
