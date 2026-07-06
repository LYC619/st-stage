/**
 * 浏览器端图片压缩：canvas 重绘导出 WebP，用于上传立绘时减小体积。
 * ST 端（saveBase64AsFile 落盘）与 Web 端（data URI 存 localStorage）共用。
 * 仅浏览器可用（依赖 Image/canvas）；GIF/SVG 跳过压缩（保动画/本身够小）。
 */

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

    const compressedUri = canvas.toDataURL('image/webp', quality)
    // 浏览器不支持 WebP 编码时 toDataURL 静默回退 PNG；压缩后更大也不采用
    if (!compressedUri.startsWith('data:image/webp') || compressedUri.length >= originalUri.length) {
      return original
    }
    return {
      dataUri: compressedUri,
      compressed: true,
      bytes: estimateDataUriBytes(compressedUri),
    }
  } catch {
    return original
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
