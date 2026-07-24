/**
 * 立绘包导入导出（sprite-pack@2 JSON 格式，导入兼容 @1）。
 * 导出时本地图片（ST 用户目录/扩展目录路径）自动内嵌 base64 —— 本地路径只在导出者
 * 机器上有效，不内嵌的话别人导入后图全裂；图床 URL 默认保持轻量，可选全部内嵌。
 * 一行紧凑分享串见 core/share-code.ts。
 */

import type { SpritePack, SpritePackFile } from './types'
import { getSpriteSource } from './types'
import { genId } from './sprite-store'
import { normalizeTag, sanitizeDescription, sanitizePackName } from './naming'
import { extractImageCode } from './share-code'

/**
 * 将 SpritePack 序列化为导出文件对象。
 * - data: 图源 → 始终内嵌
 * - 本地路径图源 → 始终尝试转 base64 内嵌（失败回退原路径）
 * - 图床 URL → 默认保留 URL；embedHosted 时也转 base64（离线分享，文件更大）
 */
export async function exportPack(pack: SpritePack, embedHosted = false): Promise<SpritePackFile> {
  const sprites: SpritePackFile['sprites'] = []
  for (const sprite of pack.sprites) {
    const source = getSpriteSource(sprite)
    const extra = {
      ...remoteField(sprite),
      ...(sprite.group ? { group: sprite.group } : {}),
      ...(sprite.outfit ? { outfit: sprite.outfit } : {}),
    }
    if (source === 'embedded') {
      sprites.push({ tag: sprite.tag, data: sprite.url, ...extra })
    } else if (source === 'local' || embedHosted) {
      try {
        const data = await urlToDataUri(sprite.url)
        sprites.push({ tag: sprite.tag, data, ...extra })
      } catch {
        // 转换失败则回退为 URL
        sprites.push({ tag: sprite.tag, url: sprite.url, ...codeField(sprite.url, sprite.code), ...extra })
      }
    } else {
      sprites.push({ tag: sprite.tag, url: sprite.url, ...codeField(sprite.url, sprite.code), ...extra })
    }
  }
  return {
    format: 'sprite-pack@2',
    name: pack.name,
    author: pack.author,
    description: pack.description,
    ...(pack.roleName ? { roleName: pack.roleName } : {}),
    ...(pack.outfit ? { outfit: pack.outfit } : {}),
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
  return r && /^https:\/\/.+/i.test(r) ? { remoteUrl: r } : {}
}

/** 解析导入的 JSON 文本为 SpritePack（@2 与 @1 均可）。格式非法时抛出带说明的 Error。 */
export function importPack(jsonText: string): SpritePack {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new Error('导入失败：不是合法的 JSON 文件')
  }
  // @1 与 @2 字段是超集关系，按宽结构收窄后统一处理
  const file = raw as {
    format?: string
    name?: unknown
    author?: unknown
    description?: unknown
    roleName?: unknown
    outfit?: unknown
    coverTag?: unknown
    sprites?: unknown
  }
  if (file.format !== 'sprite-pack@2' && file.format !== 'sprite-pack@1') {
    throw new Error('导入失败：不是 sprite-pack@1 / @2 格式的立绘包')
  }
  if (typeof file.name !== 'string' || !file.name || !Array.isArray(file.sprites) || file.sprites.length === 0) {
    throw new Error('导入失败：立绘包缺少名称或立绘列表为空')
  }

  const seen = new Set<string>()
  const sprites: SpritePack['sprites'] = []
  for (const item of file.sprites as Array<Record<string, unknown>>) {
    if (!item || typeof item.tag !== 'string') continue
    const url =
      typeof item.data === 'string' && item.data
        ? item.data
        : typeof item.url === 'string'
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
    // remoteUrl 只接受 http/https，非法值直接丢弃；本地 url/data 与 remoteUrl 并存
    const remoteUrl =
      typeof item.remoteUrl === 'string' && /^https?:\/\/.+/i.test(item.remoteUrl)
        ? item.remoteUrl
        : ''
    sprites.push({
      tag,
      url,
      ...(code ? { code } : {}),
      ...(remoteUrl ? { remoteUrl } : {}),
      ...(group ? { group } : {}),
      ...(outfit ? { outfit } : {}),
    })
  }
  if (sprites.length === 0) {
    throw new Error('导入失败：没有可用的立绘条目（表情名可能全部为空或重复）')
  }

  const normalizedCover = typeof file.coverTag === 'string' ? normalizeTag(file.coverTag) : ''
  const coverTag = sprites.some((s) => s.tag === normalizedCover) ? normalizedCover : undefined
  const roleName = typeof file.roleName === 'string' ? normalizeTag(file.roleName) : ''
  const outfit = typeof file.outfit === 'string' ? normalizeTag(file.outfit) : ''

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
    coverTag,
    updatedAt: new Date().toISOString(),
    sprites,
  }
}

/** 把远程/本地 URL 图片转为 data URI（补传图床、离线内嵌导出等复用） */
export async function urlToDataUri(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
