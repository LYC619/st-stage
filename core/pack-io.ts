/**
 * 立绘包导入导出（v2）。
 * - sprite-pack@2：完整包格式（local/cloud/embedded 条目均可）
 * - sprite-share@1：轻量分享格式（全 cloud，仅标签 → 图床编号映射），主要分享渠道
 * - sprite-pack@1：旧版格式，兼容导入自动升级
 */

import type {
  SpritePack,
  SpritePackFileV1,
  SpritePackFileV2,
  SpriteShareFile,
} from './types'
import { DEFAULT_CLOUD_PREFIX } from './types'
import { createEntry, genId } from './sprite-store'

/** 将 SpritePack 序列化为 sprite-pack@2 导出对象 */
export function exportPack(pack: SpritePack): SpritePackFileV2 {
  return {
    format: 'sprite-pack@2',
    name: pack.name,
    author: pack.author,
    description: pack.description,
    cloudPrefix: pack.cloudPrefix,
    sprites: pack.sprites.map((s) => ({
      label: s.label,
      tags: s.tags,
      source: s.source,
      ref: s.ref,
    })),
  }
}

/**
 * 导出为轻量分享格式（sprite-share@1）。
 * 仅包含 cloud 条目；若包内没有任何 cloud 条目则抛错。
 */
export function exportShare(pack: SpritePack): SpriteShareFile {
  const cloudSprites = pack.sprites.filter((s) => s.source === 'cloud')
  if (cloudSprites.length === 0) {
    throw new Error('导出失败：该包没有云端图床条目，请先上传图片到图床并添加编号')
  }
  return {
    format: 'sprite-share@1',
    name: pack.name,
    author: pack.author,
    cloudPrefix: pack.cloudPrefix ?? DEFAULT_CLOUD_PREFIX,
    sprites: cloudSprites.map((s) => ({ label: s.label, tags: s.tags, ref: s.ref })),
  }
}

/** 解析导入的 JSON 文本为 SpritePack，自动识别三种格式。非法时抛出带说明的 Error。 */
export function importPack(jsonText: string): SpritePack {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new Error('导入失败：不是合法的 JSON 文件')
  }
  const file = raw as { format?: string }
  switch (file.format) {
    case 'sprite-pack@2':
      return importV2(raw as SpritePackFileV2)
    case 'sprite-share@1':
      return importShare(raw as SpriteShareFile)
    case 'sprite-pack@1':
      return importV1(raw as SpritePackFileV1)
    default:
      throw new Error('导入失败：无法识别的格式（支持 sprite-pack@2 / sprite-share@1 / sprite-pack@1）')
  }
}

function importV2(file: SpritePackFileV2): SpritePack {
  if (!file.name || !Array.isArray(file.sprites) || file.sprites.length === 0) {
    throw new Error('导入失败：立绘包缺少名称或立绘列表为空')
  }
  const sprites = file.sprites
    .filter((s) => s && typeof s.label === 'string' && s.ref && s.source)
    .map((s) => createEntry(s.label, s.source, s.ref, s.tags))
  if (sprites.length === 0) throw new Error('导入失败：没有可用的立绘条目')
  return {
    id: genId(),
    name: file.name,
    version: 2,
    author: file.author,
    description: file.description,
    cloudPrefix: file.cloudPrefix,
    sprites,
  }
}

function importShare(file: SpriteShareFile): SpritePack {
  if (!file.name || !Array.isArray(file.sprites) || file.sprites.length === 0) {
    throw new Error('导入失败：分享文件缺少名称或立绘列表为空')
  }
  const sprites = file.sprites
    .filter((s) => s && typeof s.label === 'string' && typeof s.ref === 'string' && s.ref)
    .map((s) => createEntry(s.label, 'cloud', s.ref.trim(), s.tags))
  if (sprites.length === 0) throw new Error('导入失败：没有可用的立绘条目')
  return {
    id: genId(),
    name: file.name,
    version: 2,
    author: file.author,
    cloudPrefix: file.cloudPrefix ?? DEFAULT_CLOUD_PREFIX,
    sprites,
  }
}

/** 旧版 v1 兼容导入：tag → label，url/data 推断 source */
function importV1(file: SpritePackFileV1): SpritePack {
  if (!file.name || !Array.isArray(file.sprites) || file.sprites.length === 0) {
    throw new Error('导入失败：立绘包缺少名称或立绘列表为空')
  }
  const sprites = file.sprites
    .filter((s) => s && typeof s.tag === 'string' && (s.url || s.data))
    .map((s) => {
      const value = (s.data ?? s.url) as string
      if (value.startsWith('data:')) return createEntry(s.tag, 'embedded', value)
      // 完整 URL 直接嵌入为 cloud 无前缀不成立，保留为 embedded URL 形式的 cloud：
      // 用空前缀技巧不可靠，改用 cloudPrefix='' + ref=完整 URL
      return createEntry(s.tag, 'cloud', value)
    })
  if (sprites.length === 0) throw new Error('导入失败：没有可用的立绘条目')
  return {
    id: genId(),
    name: file.name,
    version: 2,
    author: file.author,
    description: file.description,
    // v1 的 url 是完整地址，置空前缀让 ref 原样使用
    cloudPrefix: '',
    sprites,
  }
}

/** 把远程/本地 URL 图片转为 data URI（上传压缩等场景用） */
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

/**
 * 浏览器端图片压缩：canvas 缩放至最长边 ≤ maxSize，输出 JPEG/WebP data URI。
 * 透明图（PNG）保留为 PNG 以免黑底。压缩失败返回原 data URI。
 */
export async function compressImage(
  dataUri: string,
  maxSize = 1024,
  quality = 0.85,
): Promise<string> {
  if (typeof document === 'undefined') return dataUri
  try {
    const img = await loadImage(dataUri)
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUri
    ctx.drawImage(img, 0, 0, w, h)
    // 检测透明度：PNG 带透明像素时保留 PNG
    const isPng = dataUri.startsWith('data:image/png')
    if (isPng && hasTransparency(ctx, w, h)) {
      const png = canvas.toDataURL('image/png')
      return png.length < dataUri.length ? png : dataUri
    }
    const jpeg = canvas.toDataURL('image/jpeg', quality)
    return jpeg.length < dataUri.length ? jpeg : dataUri
  } catch {
    return dataUri
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

/** 抽样检测画布是否含透明像素 */
function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const step = Math.max(1, Math.floor(Math.min(w, h) / 16))
    const data = ctx.getImageData(0, 0, w, h).data
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] < 250) return true
      }
    }
  } catch {
    // 跨域污染等情况，保守返回 true 保留 PNG
    return true
  }
  return false
}
