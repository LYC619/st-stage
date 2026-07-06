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
    if (source === 'embedded') {
      sprites.push({ tag: sprite.tag, data: sprite.url })
    } else if (source === 'local' || embedHosted) {
      try {
        const data = await urlToDataUri(sprite.url)
        sprites.push({ tag: sprite.tag, data })
      } catch {
        // 转换失败则回退为 URL
        sprites.push({ tag: sprite.tag, url: sprite.url, ...codeField(sprite.url, sprite.code) })
      }
    } else {
      sprites.push({ tag: sprite.tag, url: sprite.url, ...codeField(sprite.url, sprite.code) })
    }
  }
  return {
    format: 'sprite-pack@2',
    name: pack.name,
    author: pack.author,
    description: pack.description,
    coverTag: pack.coverTag,
    exportedAt: new Date().toISOString(),
    sprites,
  }
}

function codeField(url: string, code?: string): { code?: string } {
  const resolved = code ?? extractImageCode(url)
  return resolved ? { code: resolved } : {}
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
    coverTag?: unknown
    sprites?: unknown
  }
  if (file.format !== 'sprite-pack@2' && file.format !== 'sprite-pack@1') {
    throw new Error('导入失败：不是 sprite-pack@1 / @2 格式的立绘包')
  }
  if (typeof file.name !== 'string' || !file.name || !Array.isArray(file.sprites) || file.sprites.length === 0) {
    throw new Error('导入失败：立绘包缺少名称或立绘列表为空')
  }

  const seenTags = new Set<string>()
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
    if (!tag || seenTags.has(tag)) continue
    seenTags.add(tag)
    const code =
      typeof item.code === 'string' && item.code ? item.code : (extractImageCode(url) ?? undefined)
    sprites.push({ tag, url, ...(code ? { code } : {}) })
  }
  if (sprites.length === 0) {
    throw new Error('导入失败：没有可用的立绘条目（表情名可能全部为空或重复）')
  }

  const normalizedCover = typeof file.coverTag === 'string' ? normalizeTag(file.coverTag) : ''
  const coverTag = sprites.some((s) => s.tag === normalizedCover) ? normalizedCover : undefined

  return {
    id: genId(),
    name: sanitizePackName(file.name) || '导入立绘包',
    author:
      typeof file.author === 'string' ? sanitizePackName(file.author) || undefined : undefined,
    description:
      typeof file.description === 'string'
        ? sanitizeDescription(file.description) || undefined
        : undefined,
    coverTag,
    updatedAt: new Date().toISOString(),
    sprites,
  }
}

/** 把远程/本地 URL 图片转为 data URI */
async function urlToDataUri(url: string): Promise<string> {
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
