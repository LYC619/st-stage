import type { Sprite } from '../../core/types'
import { getSpriteSource } from '../../core/types'
import {
  cleanCheckerboardImage,
  compressImage,
  type CleanCheckerboardResult,
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

export interface CleanAndLocalizeSpriteDeps {
  fetch: typeof fetch
  saveImage(file: File, fileName: string): Promise<string>
  clean?: (blob: Blob) => Promise<CleanCheckerboardResult>
  confirmSave?: (removedPixels: number) => boolean | Promise<boolean>
}

export interface CleanAndLocalizeSpriteResult {
  sprite: Sprite
  removedPixels: number
}

export async function localizeSprite(
  sprite: Sprite,
  fileName: string,
  deps: LocalizeSpriteDeps,
): Promise<Sprite> {
  if (getSpriteSource(sprite) !== 'hosted') {
    throw new Error('这张立绘已经是本地图片')
  }

  let response: Response
  try {
    response = await deps.fetch(sprite.url, requestInit())
  } catch (error) {
    throw new Error(`下载远程图片失败：${downloadFailure(error)}`, { cause: error })
  }
  if (!response.ok) {
    throw new Error(`下载远程图片失败：HTTP ${response.status}`)
  }

  const declaredBytes = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredBytes) && declaredBytes > LOCALIZE_MAX_BYTES) {
    throw new Error(`远程图片过大，不能超过 ${formatLimit()}`)
  }

  let blob: Blob
  try {
    blob = await response.blob()
  } catch (error) {
    throw new Error(`下载远程图片失败：${downloadFailure(error)}`, { cause: error })
  }
  if (blob.size > LOCALIZE_MAX_BYTES) {
    throw new Error(`远程图片过大，不能超过 ${formatLimit()}`)
  }
  if (!blob.type.startsWith('image/')) {
    throw new Error('远程地址没有返回图片')
  }

  let compressed: CompressResult
  try {
    compressed = await (deps.compress ?? compressImage)(blob)
  } catch (error) {
    throw new Error(`压缩远程图片失败：${errorMessage(error)}`, { cause: error })
  }

  let localUrl: string
  try {
    localUrl = await deps.saveImage(dataUriToFile(compressed.dataUri, fileName), fileName)
  } catch (error) {
    throw new Error(`保存本地图片失败：${errorMessage(error)}`, { cause: error })
  }
  if (!localUrl || getSpriteSource({ ...sprite, url: localUrl }) === 'hosted') {
    throw new Error('保存本地图片失败：平台未返回本地地址')
  }

  return { ...sprite, url: localUrl, remoteUrl: sprite.url }
}

/** 用户主动检测棋盘格后生成新的透明本地图片；远程和 ST 本地 URL 均可读取。 */
export async function cleanAndLocalizeSprite(
  sprite: Sprite,
  fileName: string,
  deps: CleanAndLocalizeSpriteDeps,
): Promise<CleanAndLocalizeSpriteResult> {
  let response: Response
  try {
    response = await deps.fetch(sprite.url, requestInit())
  } catch (error) {
    throw new Error(`读取图片失败：${downloadFailure(error)}`, { cause: error })
  }
  if (!response.ok) throw new Error(`读取图片失败：HTTP ${response.status}`)
  const declaredBytes = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredBytes) && declaredBytes > LOCALIZE_MAX_BYTES) {
    throw new Error(`图片过大，不能超过 ${formatLimit()}`)
  }

  let blob: Blob
  try {
    blob = await response.blob()
  } catch (error) {
    throw new Error(`读取图片失败：${downloadFailure(error)}`, { cause: error })
  }
  if (blob.size > LOCALIZE_MAX_BYTES) throw new Error(`图片过大，不能超过 ${formatLimit()}`)
  if (!blob.type.startsWith('image/')) throw new Error('图片地址没有返回图片')

  const cleaned = await (deps.clean ?? cleanCheckerboardImage)(blob)
  if (deps.confirmSave && !await deps.confirmSave(cleaned.removedPixels)) {
    throw new Error('已取消保存透明图片')
  }
  let localUrl: string
  try {
    const file = new File([cleaned.blob], fileName, { type: cleaned.blob.type || 'image/png' })
    localUrl = await deps.saveImage(file, fileName)
  } catch (error) {
    throw new Error(`保存本地图片失败：${errorMessage(error)}`, { cause: error })
  }
  if (!localUrl || getSpriteSource({ ...sprite, url: localUrl }) === 'hosted') {
    throw new Error('保存本地图片失败：平台未返回本地地址')
  }

  const localized = { ...sprite, url: localUrl }
  if (getSpriteSource(sprite) === 'hosted') localized.remoteUrl = sprite.remoteUrl ?? sprite.url
  return { sprite: localized, removedPixels: cleaned.removedPixels }
}

function dataUriToFile(dataUri: string, fileName: string): File {
  const match = /^data:(image\/[^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUri)
  if (!match) throw new Error('压缩后的图片数据格式不正确')
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new File([bytes], fileName, { type: match[1] })
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '未知错误'
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
    ? `超过 ${LOCALIZE_TIMEOUT_MS / 1000} 秒没有响应`
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
