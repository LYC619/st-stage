/**
 * 浏览器端图片压缩：canvas 重绘导出 WebP，用于上传立绘时减小体积。
 * ST 端（saveBase64AsFile 落盘）与 Web 端（data URI 存 localStorage）共用。
 * 仅浏览器可用（依赖 Image/canvas）；GIF/SVG 跳过压缩（保动画/本身够小）。
 */

import { removeBakedCheckerboard, type CheckerboardImageData } from './checkerboard-cleanup'

export interface CompressOptions {
  /** 最长边像素，超出则等比缩小；默认 1024（立绘悬浮窗最大 600px 宽，1024 留足余量） */
  maxDimension?: number
  /** WebP 质量 0–1；默认 0.85 */
  quality?: number
}

export interface CompressResult {
  /** 压缩后的 data URI；判定不划算（压缩后更大/环境不支持）时为原图 */
  dataUri: string
  /** 是否实际执行了压缩 */
  compressed: boolean
  /** 输出体积（字节，由 base64 长度估算） */
  bytes: number
  /** 解码后像素证据；环境无法读取 canvas 时缺省。 */
  transparency?: ImageTransparencyEvidence
}

export type ImageTransparencyEvidence = 'transparent' | 'opaque' | 'opaque-checkerboard'

export interface CheckerboardImageCodec {
  decode(blob: Blob): Promise<CheckerboardImageData>
  encodePng(data: Uint8ClampedArray, width: number, height: number): Promise<Blob>
}

export interface CleanCheckerboardResult {
  blob: Blob
  removedPixels: number
}

/** 从 RGBA 像素判断透明度，并保守识别常见浅灰棋盘格背景。 */
export function analyzeImagePixels(data: Uint8ClampedArray): ImageTransparencyEvidence {
  if (data.length < 4) return 'opaque'
  const luminanceBins = new Map<number, number>()
  let grayscalePixels = 0
  const totalPixels = Math.floor(data.length / 4)

  for (let offset = 0; offset + 3 < data.length; offset += 4) {
    const red = data[offset]
    const green = data[offset + 1]
    const blue = data[offset + 2]
    const alpha = data[offset + 3]
    if (alpha < 250) return 'transparent'
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 5) continue
    grayscalePixels += 1
    const bin = Math.round(((red + green + blue) / 3) / 8) * 8
    luminanceBins.set(bin, (luminanceBins.get(bin) ?? 0) + 1)
  }

  const dominant = [...luminanceBins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
  if (dominant.length === 2) {
    const [[firstValue, firstCount], [secondValue, secondCount]] = dominant
    const difference = Math.abs(firstValue - secondValue)
    const dominantCount = firstCount + secondCount
    if (
      grayscalePixels / totalPixels >= 0.5 &&
      firstCount / totalPixels >= 0.1 &&
      secondCount / totalPixels >= 0.1 &&
      dominantCount / totalPixels >= 0.5 &&
      Math.min(firstValue, secondValue) >= 160 &&
      difference >= 8 &&
      difference <= 64
    ) return 'opaque-checkerboard'
  }
  return 'opaque'
}

/** Blob/File → data URI */
export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** 估算 data URI 的字节体积（base64 编码率 4/3） */
export function estimateDataUriBytes(dataUri: string): number {
  const comma = dataUri.indexOf(',')
  const payload = comma >= 0 ? dataUri.length - comma - 1 : dataUri.length
  return Math.round(payload * 0.75)
}

async function decodeImagePixels(blob: Blob): Promise<CheckerboardImageData> {
  const img = await loadImage(await blobToDataUri(blob))
  const width = img.naturalWidth
  const height = img.naturalHeight
  if (width < 1 || height < 1) throw new Error('图片尺寸无效')
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器无法读取图片像素')
  ctx.drawImage(img, 0, 0)
  return { data: ctx.getImageData(0, 0, width, height).data, width, height }
}

async function encodePng(data: Uint8ClampedArray, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器无法写入透明图片')
  const imageData = ctx.createImageData(width, height)
  imageData.data.set(data)
  ctx.putImageData(imageData, 0, 0)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('透明 PNG 编码失败'))
    }, 'image/png')
  })
}

const browserCheckerboardCodec: CheckerboardImageCodec = {
  decode: decodeImagePixels,
  encodePng,
}

/** 检测并清除烤入像素的棋盘格；证据不足时拒绝生成新文件。 */
export async function cleanCheckerboardImage(
  blob: Blob,
  codec: CheckerboardImageCodec = browserCheckerboardCodec,
): Promise<CleanCheckerboardResult> {
  if (!blob.type.startsWith('image/')) throw new Error('所选内容不是图片')
  const decoded = await codec.decode(blob)
  const cleaned = removeBakedCheckerboard(decoded)
  if (!cleaned) throw new Error('没有确认到可安全去除的棋盘格背景')
  return {
    blob: await codec.encodePng(cleaned.data, decoded.width, decoded.height),
    removedPixels: cleaned.removedPixels,
  }
}

/** 人类可读体积，如 "384 KB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** 压缩一张图片。任何失败都安全回退为原图 data URI，不会抛异常（读文件失败除外）。 */
export async function compressImage(
  file: Blob,
  options: CompressOptions = {},
): Promise<CompressResult> {
  const { maxDimension = 1024, quality = 0.85 } = options
  const originalUri = await blobToDataUri(file)
  const original: CompressResult = {
    dataUri: originalUri,
    compressed: false,
    bytes: estimateDataUriBytes(originalUri),
  }

  // GIF 压缩会丢动画；SVG 矢量无需压缩
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return original
  if (typeof document === 'undefined') return original

  try {
    const img = await loadImage(originalUri)
    const longest = Math.max(img.naturalWidth, img.naturalHeight)
    if (longest === 0) return original
    const scale = Math.min(1, maxDimension / longest)
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(img, 0, 0, width, height)
    let transparency: ImageTransparencyEvidence | undefined
    try {
      transparency = analyzeImagePixels(ctx.getImageData(0, 0, width, height).data)
    } catch {
      // 某些浏览器或受限 canvas 不允许读取像素；压缩流程仍可继续。
    }

    const compressedUri = canvas.toDataURL('image/webp', quality)
    // 浏览器不支持 WebP 编码时 toDataURL 静默回退 PNG；压缩后更大也不采用
    if (!compressedUri.startsWith('data:image/webp') || compressedUri.length >= originalUri.length) {
      return { ...original, ...(transparency ? { transparency } : {}) }
    }
    return {
      dataUri: compressedUri,
      compressed: true,
      bytes: estimateDataUriBytes(compressedUri),
      ...(transparency ? { transparency } : {}),
    }
  } catch {
    return original
  }
}

/**
 * data URI → 补压缩后的 data URI（导出内嵌时兜底：早期未压缩的存量图/导入的胖 JSON 在此收口）。
 * 已是 webp 视为压缩过直接跳过（避免反复导出导入的代际画质损失）；
 * GIF/SVG/非图片/非浏览器环境原样返回；任何失败安全回退原图。
 */
export async function recompressDataUri(
  dataUri: string,
  options: CompressOptions = {},
): Promise<string> {
  if (typeof document === 'undefined') return dataUri
  const mime = /^data:([^;,]+)/.exec(dataUri)?.[1] ?? ''
  if (!mime.startsWith('image/')) return dataUri
  if (mime === 'image/webp' || mime === 'image/gif' || mime === 'image/svg+xml') return dataUri
  try {
    const blob = await (await fetch(dataUri)).blob()
    return (await compressImage(blob, options)).dataUri
  } catch {
    return dataUri
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = src
  })
}
