import type { SpritePack, Sprite } from '../../../core/types'
import { spriteGroup, upsertPack, upsertSprite } from '../../../core/sprite-store'
import { t } from '../../../core/i18n'
import { getSpriteSource } from '../../../core/types'
import { urlToDataUri } from '../../../core/pack-io'
import { uploadToImgbb, isValidImgbbResult } from '../../../core/imgbb'
import { isPresetPack } from '../../../core/presets'
import { localizeSprite } from '.././sprite-localize'
import { compressImage } from '../../../core/image-compress'
import { setPresetLocalSprite } from '../../../core/preset-overrides'
import { encodeShareStringV2 } from '../../../core/share-code'
import { toast, copyText } from './ui'
import type { ManagerContext } from './types'

export function createResources(ctx: ManagerContext) {
  const { deps } = ctx


  function sameSprite(pack: SpritePack, source: Sprite): Sprite | null {
    return pack.sprites.find((candidate) =>
      candidate.tag === source.tag &&
      spriteGroup(candidate) === spriteGroup(source) &&
      (candidate.outfit ?? '') === (source.outfit ?? ''),
    ) ?? null
  }


  async function uploadSelectedPacks(): Promise<void> {
    if (ctx.state.batchResourceBusy) return
    const packs = ctx.actions.selectedPacks()
    if (packs.length === 0) {
      toast(ctx.actions.currentManagerBody(), t("sprite.manager.content.upload.select_first", "先勾选要上传云端的图包"))
      return
    }
    const apiKey = deps.getSettings().imgbbApiKey.trim()
    if (!apiKey) {
      toast(ctx.actions.currentManagerBody(), t("sprite.manager.content.upload.api_key", "请先在「图库」App 配置 imgbb API Key"))
      return
    }
    ctx.state.batchResourceBusy = true
    let uploaded = 0
    let failed = 0
    try {
      for (const pack of packs) {
        const pending = pack.sprites.filter(
          (sprite) => getSpriteSource(sprite) !== 'hosted' &&
            !(sprite.remoteUrl && /^https?:\/\//.test(sprite.remoteUrl)),
        )
        for (const sprite of pending) {
          const beforeUrl = sprite.url
          try {
            const dataUri = beforeUrl.startsWith('data:') ? beforeUrl : await urlToDataUri(beforeUrl)
            const result = await uploadToImgbb(apiKey, dataUri)
            if (!isValidImgbbResult(result)) throw new Error(t("sprite.manager.content.upload.invalid_response", "图床响应无效"))
            const latestPack = deps.getSettings().packs.find((candidate) => candidate.id === pack.id)
            const latestSprite = latestPack ? sameSprite(latestPack, sprite) : null
            if (!latestPack || !latestSprite || latestSprite.url !== beforeUrl) {
              throw new Error(t("sprite.manager.content.error.target_changed", "目标已更改，本次结果未应用"))
            }
            if (!ctx.actions.updateChecked(upsertPack(
              deps.getSettings(),
              upsertSprite(latestPack, { ...latestSprite, code: result.code, remoteUrl: result.url }),
            ))) throw new Error(t("sprite.manager.content.error.pack_update", "更新图包失败"))
            uploaded++
          } catch (error) {
            console.warn('[sprite-overlay] 批量上传云端失败', { packId: pack.id, tag: sprite.tag, error })
            failed++
          }
        }
      }
    } finally {
      ctx.state.batchResourceBusy = false
      ctx.actions.render()
      toast(ctx.actions.currentManagerBody(), t("sprite.manager.content.upload.complete", "上传云端完成：成功 {{p0}} 张，失败 {{p1}} 张{{p2}}", { p0: uploaded, p1: failed, p2: failed > 0 ? t("sprite.manager.content.retry_hint", "（可再次点击重试）") : '' }))
    }
  }


  async function localizeSelectedPacks(): Promise<void> {
    if (ctx.state.batchResourceBusy) return
    const packs = ctx.actions.selectedPacks()
    if (packs.length === 0) {
      toast(ctx.actions.currentManagerBody(), t("sprite.manager.content.localize.select_first", "先勾选要保存到本地的图包"))
      return
    }
    ctx.state.batchResourceBusy = true
    let localizedCount = 0
    let failed = 0
    try {
      for (const pack of packs) {
        const remoteSprites = pack.sprites.filter((sprite) => getSpriteSource(sprite) === 'hosted')
        const preset = isPresetPack(pack.id)
        for (const sprite of remoteSprites) {
          try {
            const parts = [pack.name, spriteGroup(sprite), sprite.outfit ?? '', sprite.tag].filter(Boolean)
            const fileName = `${parts.join('-')}.webp`
            const localized = await localizeSprite(sprite, fileName, {
              fetch: window.fetch.bind(window),
              compress: compressImage,
              saveImage: (file, name) => deps.adapter.saveImageFile(
                file,
                name,
                deps.adapter.getCurrentCharacterName() || pack.name || 'shared',
              ),
            })
            const latestSettings = deps.getSettings()
            const latestPack = latestSettings.packs.find((candidate) => candidate.id === pack.id)
            const latestSprite = latestPack ? sameSprite(latestPack, sprite) : null
            if (!latestPack || !latestSprite || latestSprite.url !== sprite.url) {
              throw new Error(t("sprite.manager.content.error.sprite_changed", "立绘在保存期间已变化"))
            }
            if (preset) {
              const next = setPresetLocalSprite(latestSettings, pack.id, latestSprite, localized.url)
              if (next === latestSettings) throw new Error(t("sprite.manager.content.error.preset_update", "更新预设覆盖失败"))
              deps.updateSettings(next)
            } else if (!ctx.actions.updateChecked(upsertPack(
              latestSettings,
              upsertSprite(latestPack, { ...latestSprite, url: localized.url, remoteUrl: localized.remoteUrl }),
            ))) {
              throw new Error(t("sprite.manager.content.error.pack_update", "更新图包失败"))
            }
            localizedCount++
          } catch (error) {
            console.warn('[sprite-overlay] 批量保存本地失败', { packId: pack.id, tag: sprite.tag, error })
            failed++
          }
        }
      }
    } finally {
      ctx.state.batchResourceBusy = false
      ctx.actions.render()
      toast(ctx.actions.currentManagerBody(), t("sprite.manager.content.localize.complete", "保存本地完成：成功 {{p0}} 张，失败 {{p1}} 张{{p2}}", { p0: localizedCount, p1: failed, p2: failed > 0 ? t("sprite.manager.content.retry_hint", "（可再次点击重试）") : '' }))
    }
  }


  async function copySelectedPackShares(): Promise<void> {
    if (ctx.state.batchResourceBusy) return
    const packs = ctx.actions.selectedPacks()
    if (packs.length === 0) {
      toast(ctx.actions.currentManagerBody(), t("sprite.manager.content.share.select_first", "先勾选要复制分享串的图包"))
      return
    }
    const encoded = packs
      .map((pack) => ({ pack, result: encodeShareStringV2(pack) }))
      .filter((entry): entry is { pack: SpritePack; result: NonNullable<ReturnType<typeof encodeShareStringV2>> } => entry.result !== null)
    if (encoded.length === 0) {
      toast(ctx.actions.currentManagerBody(), t("sprite.manager.content.share.no_remote", "所选图包都没有可分享的远程图片"))
      return
    }
    const missingCount = encoded.reduce((count, entry) => count + entry.result.missing.length, 0)
    if (missingCount > 0 && !window.confirm(
      t("sprite.manager.content.share.confirm_missing", "所选图包中还有 {{p0}} 张图片没有远程地址，不会进入分享串。仍要复制吗？", { p0: missingCount }),
    )) return
    const text = encoded.map((entry) => entry.result.text).join('\n\n')
    const ok = await copyText(text)
    toast(
      ctx.actions.currentManagerBody(),
      ok
        ? t("sprite.manager.content.share.copied_packs", "已复制 {{p0}} 个图包的分享串{{p1}}", { p0: encoded.length, p1: missingCount > 0 ? t("sprite.manager.content.share.missing_suffix", "，缺少 {{p0}} 张", { p0: missingCount }) : '' })
        : t("sprite.manager.content.share.copy_failed", "复制失败，请手动复制弹出的文本"),
    )
    if (!ok) window.prompt(t("sprite.manager.content.share.copy_prompt", "手动复制分享串："), text)
  }

  return { sameSprite, uploadSelectedPacks, localizeSelectedPacks, copySelectedPackShares }
}
