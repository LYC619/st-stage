import type { Sprite } from '../../core/types'
import { getSpriteSource } from '../../core/types'
import { localUserImagePath } from '../../core/sprite-store'
import { t } from '../../core/i18n'
import {
  compressImage,
  type CompressResult,
} from '../../core/image-compress'

export const LOCALIZE_MAX_BYTES = 20 * 1024 * 1024
/** 下载超时：图床卡死时按钮会一直停在「保存中…」，只能刷页面，所以必须自己收口 */
export const LOCALIZE_TIMEOUT_MS = 30_000

export interface LocalizeSpriteDeps {
  fetch: typeof fetch
  saveImage(file: File, fileName: string): Promise<string>
  compress?: (file: Blob) => Promise<CompressResult>
}


export async function localizeSprite(
  sprite: Sprite,
  fileName: string,
  deps: LocalizeSpriteDeps,
): Promise<Sprite> {
  if (getSpriteSource(sprite) !== 'hosted') {
    throw new Error(t('galleryErrors.already_local', '这张立绘已经是本地图片'))
  }

  let response: Response
  try {
    response = await deps.fetch(sprite.url, requestInit())
  } catch (error) {
    throw new Error(t('galleryErrors.download', '下载远程图片失败：{{error}}', { error: downloadFailure(error) }), { cause: error })
  }
  if (!response.ok) {
    throw new Error(t('galleryErrors.download_http', '下载远程图片失败：HTTP {{status}}', { status: response.status }))
  }

  const declaredBytes = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredBytes) && declaredBytes > LOCALIZE_MAX_BYTES) {
    throw new Error(t('galleryErrors.size_limit', '远程图片过大，不能超过 {{limit}}', { limit: formatLimit() }))
  }

  let blob: Blob
  try {
    blob = await response.blob()
  } catch (error) {
    throw new Error(t('galleryErrors.download', '下载远程图片失败：{{error}}', { error: downloadFailure(error) }), { cause: error })
  }
  if (blob.size > LOCALIZE_MAX_BYTES) {
    throw new Error(t('galleryErrors.size_limit', '远程图片过大，不能超过 {{limit}}', { limit: formatLimit() }))
  }
  const normalizedMime = blob.type.split(';', 1)[0].trim().toLowerCase()
  if (!normalizedMime.startsWith('image/')) {
    throw new Error(t('galleryErrors.not_image', '远程地址没有返回图片'))
  }
  if (normalizedMime === 'image/svg+xml' || normalizedMime.startsWith('image/svg')) {
    throw new Error(t('storage.errors.image_format', '不支持的图片格式，请转换为 PNG、WebP 或 GIF 后重试'))
  }

  let compressed: CompressResult
  try {
    compressed = await (deps.compress ?? compressImage)(blob)
  } catch (error) {
    throw new Error(t('galleryErrors.compress', '压缩远程图片失败：{{error}}', { error: errorMessage(error) }), { cause: error })
  }

  let localUrl: string
  try {
    localUrl = await deps.saveImage(dataUriToFile(compressed.dataUri, fileName), fileName)
  } catch (error) {
    throw new Error(t('galleryErrors.save', '保存本地图片失败：{{error}}', { error: errorMessage(error) }), { cause: error })
  }
  const safeLocalUrl = localUserImagePath(localUrl)
  if (!safeLocalUrl) {
    throw new Error(t('galleryErrors.unsafe_local', '保存本地图片失败：平台未返回安全的本地用户图片地址'))
  }

  return { ...sprite, url: localUrl, remoteUrl: sprite.url }
}

function dataUriToFile(dataUri: string, fileName: string): File {
  const match = /^data:(image\/[^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUri)
  if (!match) throw new Error(t('galleryErrors.compressed_data', '压缩后的图片数据格式不正确'))
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new File([bytes], fileName, { type: match[1] })
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : t('storage.unknown_error', '未知错误')
}

/**
 * 超时中止和普通网络错误分开报，前者提示等待时长而不是内核的英文原文。
 * 不用 `instanceof Error` 取 name：中止原因是 DOMException，各内核（含 jsdom）
 * 是否让它继承 Error 并不一致，只按属性读最稳。
 */
function downloadFailure(error: unknown): string {
  const name = typeof (error as { name?: unknown } | null)?.name === 'string'
    ? (error as { name: string }).name
    : ''
  return name === 'TimeoutError' || name === 'AbortError'
    ? t('galleryErrors.download_timeout', '超过 {{seconds}} 秒没有响应', { seconds: LOCALIZE_TIMEOUT_MS / 1000 })
    : errorMessage(error)
}

/** 老内核缺 AbortSignal.timeout 时退回无超时下载，不能因此整个功能不可用。 */
function requestInit(): RequestInit | undefined {
  return typeof AbortSignal?.timeout === 'function'
    ? { signal: AbortSignal.timeout(LOCALIZE_TIMEOUT_MS) }
    : undefined
}

function formatLimit(): string {
  return `${LOCALIZE_MAX_BYTES / 1024 / 1024} MB`
}
