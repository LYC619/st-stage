import { t } from '../../core/i18n'
import { isPresetPack } from '../../core/presets'
import { applyImageChanges, scanEmbeddedImages, type EmbeddedImageCandidate, type ImageChange } from '../../core/image-storage'
import { localUserImagePath } from '../../core/sprite-store'
import { createDefaultSettings, type PluginSettings, type SpritePack } from '../../core/types'
import type { ImageSaveOptions } from './image-persistence'

export interface ImageStorageDeps {
  save(dataUri: string, options: ImageSaveOptions): Promise<string>
}

export interface ImageStageResult {
  ready: ImageChange[]
  failed: Array<{ candidate: EmbeddedImageCandidate; message: string }>
  unprocessed: EmbeddedImageCandidate[]
  cancelled: boolean
}

export interface ImageStageOptions extends ImageSaveOptions {
  onProgress?: (completed: number, total: number) => void
}

export async function stageEmbeddedImages(
  candidates: EmbeddedImageCandidate[],
  deps: ImageStorageDeps,
  options: ImageStageOptions = {},
): Promise<ImageStageResult> {
  const savedByUri = new Map<string, Promise<string>>()
  const result: ImageStageResult = { ready: [], failed: [], unprocessed: [], cancelled: false }
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    if (options.signal?.aborted) {
      result.cancelled = true
      result.unprocessed = candidates.slice(index)
      break
    }
    try {
      let saved = savedByUri.get(candidate.sourceUrl)
      if (!saved) {
        saved = deps.save(candidate.sourceUrl, { signal: options.signal }).then((url) => {
          if (!localUserImagePath(url)) throw new Error(t('storage.errors.local_path_missing', '保存失败：平台未返回本地图片路径'))
          return url
        })
        savedByUri.set(candidate.sourceUrl, saved)
      }
      const nextUrl = await saved
      if (options.signal?.aborted) {
        result.cancelled = true
        result.unprocessed = candidates.slice(index)
        result.ready = []
        break
      }
      result.ready.push({ ref: candidate.ref, expectedUrl: candidate.sourceUrl, nextUrl })
    } catch (error) {
      if (options.signal?.aborted) {
        result.cancelled = true
        result.unprocessed = candidates.slice(index)
        result.ready = []
        break
      }
      result.failed.push({
        candidate,
        message: error instanceof Error ? error.message : t('storage.errors.save_failed', '保存失败'),
      })
    }
    options.onProgress?.(index + 1, candidates.length)
    if (options.signal?.aborted) {
      result.cancelled = true
      result.unprocessed = candidates.slice(index + 1)
      result.ready = []
      break
    }
  }
  return result
}

export async function prepareImportedPack(
  pack: SpritePack,
  deps: ImageStorageDeps,
  options: ImageStageOptions = {},
): Promise<SpritePack> {
  if (isPresetPack(pack.id)) throw new Error(t('storage.errors.preset_target', '内置预设不能作为导入目标'))
  if (options.signal?.aborted) throw new Error(t('storage.errors.import_cancelled', '内嵌图片准备未完成，图包未安装（已取消）'))
  const staging: PluginSettings = {
    ...createDefaultSettings(),
    packs: [pack],
  }
  const scan = scanEmbeddedImages(staging)
  if (scan.ambiguous.length > 0) throw new Error(t('storage.errors.pack_duplicates', '图包包含重复图片身份，未安装'))
  if (scan.candidates.length === 0) return pack
  const staged = await stageEmbeddedImages(scan.candidates, deps, options)
  if (staged.cancelled || staged.failed.length > 0 || staged.unprocessed.length > 0) {
    throw new Error(t('storage.errors.prepare_failed', '内嵌图片准备未完成，图包未安装（失败 {{count}}）', { count: staged.failed.length }))
  }
  const applied = applyImageChanges(staging, staged.ready)
  const prepared = applied.settings.packs[0]
  if (!prepared || applied.conflicts.length > 0 || prepared.sprites.some((sprite) => /^data:/i.test(sprite.url))) {
    throw new Error(t('storage.errors.pack_unsaved', '图包仍有未落盘图片，未安装'))
  }
  return prepared
}
