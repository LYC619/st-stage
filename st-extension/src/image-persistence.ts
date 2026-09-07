import { localUserImagePath } from '../../core/sprite-store'

export interface ImageSaveOptions {
  signal?: AbortSignal
}

export interface STImagePersistenceDeps {
  fetch: typeof fetch
  getRequestHeaders?: () => Record<string, string>
}

export const ST_IMAGE_SAVE_TIMEOUT_MS = 30_000
export const ST_IMAGE_MAX_BYTES = 20 * 1024 * 1024

const IMAGE_FORMATS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
}

interface ParsedImageData {
  image: string
  format: string
  bytes: Uint8Array
}

function uniqueImageName(): string {
  const cryptoApi = globalThis.crypto
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('当前环境不支持安全随机图片命名')
  }
  const bytes = new Uint8Array(16)
  cryptoApi.getRandomValues(bytes)
  return `sprite_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function parseImageData(dataUri: string): ParsedImageData {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUri)
  if (!match || match[2].length % 4 !== 0) throw new Error('图片数据格式不正确')
  const format = IMAGE_FORMATS[match[1].toLowerCase()]
  if (!format) throw new Error('不支持的图片格式，请转换为 PNG、WebP 或 GIF 后重试')
  const binarySize = match[2].length * 3 / 4 - (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0)
  if (binarySize > ST_IMAGE_MAX_BYTES) throw new Error('单张图片不能超过 20 MiB')
  let binary: string
  try {
    binary = atob(match[2])
  } catch (error) {
    throw new Error('图片数据格式不正确', { cause: error })
  }
  if (!binary.length) throw new Error('图片数据为空')
  return {
    image: match[2],
    format,
    bytes: Uint8Array.from(binary, (char) => char.charCodeAt(0)),
  }
}

function sameBytes(actual: Uint8Array, expected: Uint8Array): boolean {
  if (actual.length !== expected.length) return false
  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) return false
  }
  return true
}

export async function persistSTImage(
  dataUri: string,
  deps: STImagePersistenceDeps,
  options: ImageSaveOptions = {},
): Promise<string> {
  if (typeof deps.fetch !== 'function') throw new Error('当前环境不支持图片保存请求能力')
  if (typeof deps.getRequestHeaders !== 'function') {
    throw new Error('当前酒馆未提供图片保存所需的请求头能力')
  }
  const headers = deps.getRequestHeaders()
  if (!headers || typeof headers !== 'object' || Object.keys(headers).length === 0) {
    throw new Error('当前酒馆未提供图片保存所需的请求头能力')
  }
  const data = parseImageData(dataUri)
  const filename = uniqueImageName()
  const expectedPath = `/user/images/sprite_overlay/${filename}.${data.format}`
  const controller = new AbortController()
  const onAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', onAbort, { once: true })
  if (options.signal?.aborted) onAbort()
  const timer = setTimeout(() => controller.abort(new Error('图片保存超时')), ST_IMAGE_SAVE_TIMEOUT_MS)
  try {
    const response = await deps.fetch('/api/images/upload', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        image: data.image,
        format: data.format,
        ch_name: 'sprite_overlay',
        filename,
      }),
    })
    if (!response.ok) throw new Error(`图片上传失败：HTTP ${response.status}`)
    const result: unknown = await response.json()
    const path = result && typeof result === 'object' && 'path' in result
      ? (result as { path?: unknown }).path
      : undefined
    if (
      typeof path !== 'string' ||
      path !== expectedPath ||
      localUserImagePath(path) !== expectedPath
    ) {
      throw new Error('图片上传响应未返回本次保存的安全本地路径')
    }
    const readback = await deps.fetch(path, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
    if (!readback.ok) throw new Error(`图片保存后校验失败：HTTP ${readback.status}`)
    const actual = new Uint8Array(await readback.arrayBuffer())
    if (!sameBytes(actual, data.bytes)) throw new Error('图片保存后校验失败：文件内容不一致')
    return path
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}
