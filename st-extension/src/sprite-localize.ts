import type { Sprite } from '../../core/types'
import { getSpriteSource } from '../../core/types'
import { compressImage, type CompressResult } from '../../core/image-compress'

export const LOCALIZE_MAX_BYTES = 20 * 1024 * 1024

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
    throw new Error('这张立绘已经是本地图片')
  }

  let response: Response
  try {
    response = await deps.fetch(sprite.url)
  } catch (error) {
    throw new Error(`下载远程图片失败：${errorMessage(error)}`, { cause: error })
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
    throw new Error(`下载远程图片失败：${errorMessage(error)}`, { cause: error })
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

function formatLimit(): string {
  return `${LOCALIZE_MAX_BYTES / 1024 / 1024} MB`
}
