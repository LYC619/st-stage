import { openSpriteLightbox } from '.././sprite-lightbox'
import { isPresetPack } from '../../../core/presets'
import type { SpritePack, Sprite } from '../../../core/types'
import { upsertPack, spriteGroup, localUserImagePath, upsertSprite, moveSprite } from '../../../core/sprite-store'
import { t } from '../../../core/i18n'
import { type SpriteAction, type SpriteActionContext, createSpriteActions } from '.././sprite-actions'
import { compressImage, formatBytes } from '../../../core/image-compress'
import { uploadToImgbb, isValidImgbbResult } from '../../../core/imgbb'
import { localizeSprite } from '.././sprite-localize'
import { setPresetLocalSprite } from '../../../core/preset-overrides'
import { toast, pickFile, el, addCardNavigation, iconButton, thumbnail } from './ui'
import type { ActiveLightbox, ManagerContext } from './types'

export function createLightbox(ctx: ManagerContext) {
  const { deps } = ctx


  /** 图片放大查看由视口级控制器承载，避免受管理器滚动容器定位影响。 */
  function openLightbox(packId: string, startIndex: number): void {
    if (!ctx.state.backdrop) return
    const pack = deps.getSettings().packs.find((candidate) => candidate.id === packId)
    if (!pack || pack.sprites.length === 0) return
    ctx.state.activeLightbox?.controller?.close()
    const state: ActiveLightbox = { controller: null, packId, index: startIndex }
    const controller = openSpriteLightbox({
      pack,
      index: startIndex,
      readonly: isPresetPack(pack.id),
      actions: isPresetPack(pack.id) ? presetLightboxActions(state) : lightboxActions(state),
      onNavigate: (index) => {
        state.index = index
        refreshLightbox()
      },
      onClose: () => {
        if (ctx.state.activeLightbox === state) ctx.state.activeLightbox = null
      },
    })
    state.controller = controller
    ctx.state.activeLightbox = state
  }


  function refreshLightbox(): void {
    const state = ctx.state.activeLightbox
    if (!state?.controller) return
    const pack = deps.getSettings().packs.find((candidate) => candidate.id === state.packId)
    if (!pack || pack.sprites.length === 0) {
      state.controller.close()
      return
    }
    state.index = Math.max(0, Math.min(state.index, pack.sprites.length - 1))
    const actions = isPresetPack(pack.id) ? presetLightboxActions(state) : lightboxActions(state)
    state.controller.update(pack, state.index, actions)
  }


  function commitActionPack(pack: SpritePack): void {
    const result = upsertPack(deps.getSettings(), pack)
    if (!result.ok) throw new Error(t("sprite.manager.content.conflict.address", "操作未生效，存在地址冲突：{{p0}}", { p0: ctx.actions.conflictText(result.conflicts) }))
    deps.updateSettings(result.settings)
  }


  function currentManagerBody(): HTMLElement | null {
    return ctx.state.backdrop?.querySelector('.so-manager-body') as HTMLElement | null
  }


  function runSpriteAction(action: SpriteAction): void {
    const report = (error: unknown) => {
      toast(currentManagerBody(), error instanceof Error ? error.message : t("sprite.manager.content.action.failed", "立绘操作失败"))
      refreshLightbox()
    }
    try {
      const result = action.run()
      if (result instanceof Promise) void result.catch(report)
    } catch (error) {
      report(error)
    }
  }


  function pickReplacement(
    packId: string,
    getCurrentSprite: () => Sprite | null,
  ): void {
    const selected = getCurrentSprite()
    if (!selected) return
    const identity = {
      tag: selected.tag,
      group: spriteGroup(selected),
      outfit: selected.outfit ?? '',
    }
    const latestTarget = (): { pack: SpritePack; sprite: Sprite } | null => {
      const pack = deps.getSettings().packs.find((candidate) => candidate.id === packId)
      const sprite = pack?.sprites.find((candidate) =>
        candidate.tag === identity.tag &&
        spriteGroup(candidate) === identity.group &&
        (candidate.outfit ?? '') === identity.outfit,
      )
      return pack && sprite ? { pack, sprite } : null
    }

    pickFile('image/*', false, async (files) => {
      try {
        const result = await compressImage(files[0])
        const beforeSave = latestTarget()
        if (!beforeSave) return
        const beforeUrl = beforeSave.sprite.url
        const url = await deps.adapter.saveImage(
          `${beforeSave.sprite.tag}.webp`,
          result.dataUri,
          deps.adapter.getCurrentCharacterName() || beforeSave.pack.name,
        )
        if (!localUserImagePath(url)) throw new Error(t("sprite.manager.content.error.unsafe_local", "保存失败：平台未返回安全的本地用户图片地址"))
        const target = latestTarget()
        if (!target || target.sprite.url !== beforeUrl) {
          throw new Error(t("sprite.manager.content.error.target_changed", "目标已更改，本次结果未应用"))
        }
        const base: Sprite = {
          tag: target.sprite.tag,
          url,
          ...(identity.group ? { group: identity.group } : {}),
          ...(identity.outfit ? { outfit: identity.outfit } : {}),
          ...(target.sprite.labels?.length ? { labels: target.sprite.labels } : {}),
        }
        ctx.actions.commitPack(upsertSprite(target.pack, base))

        const { autoUpload, imgbbApiKey } = deps.getSettings()
        if (autoUpload && imgbbApiKey.trim()) {
          try {
            const uploaded = await uploadToImgbb(imgbbApiKey, result.dataUri)
            if (isValidImgbbResult(uploaded)) {
              const latest = latestTarget()
              if (latest && latest.sprite.url === url) {
                ctx.actions.commitPack(upsertSprite(latest.pack, {
                  ...latest.sprite,
                  code: uploaded.code,
                  remoteUrl: uploaded.url,
                }))
                toast(currentManagerBody(), t("sprite.manager.content.replace.hosted", "已替换「{{p0}}」并重传图床（{{p1}}）", { p0: identity.tag, p1: formatBytes(result.bytes) }))
                return
              } else {
                toast(currentManagerBody(), t("sprite.manager.content.replace.target_changed", "目标已更改，本次图床结果未应用；已保留本地文件"))
                return
              }
            }
            toast(currentManagerBody(), t("sprite.manager.content.replace.invalid_response", "已替换「{{p0}}」，但图床响应无效，标记为待上传", { p0: identity.tag }))
          } catch {
            toast(currentManagerBody(), t("sprite.manager.content.replace.upload_failed", "已替换「{{p0}}」，图床上传失败，标记为待上传", { p0: identity.tag }))
          }
        } else {
          toast(currentManagerBody(), t("sprite.manager.content.replace.local", "已替换「{{p0}}」（{{p1}}），远程地址待上传", { p0: identity.tag, p1: formatBytes(result.bytes) }))
        }
      } catch (error) {
        toast(currentManagerBody(), error instanceof Error ? error.message : t("sprite.manager.content.replace.failed", "替换失败"))
      } finally {
        refreshLightbox()
      }
    })
  }


  function actionContext(
    packId: string,
    getSprite: (pack: SpritePack) => Sprite | null,
    closeAction: () => void,
  ): SpriteActionContext {
    const getPack = () => deps.getSettings().packs.find((candidate) => candidate.id === packId) ?? null
    const context: SpriteActionContext = {
      getPack,
      getSprite: () => {
        const pack = getPack()
        return pack ? getSprite(pack) : null
      },
      commit: commitActionPack,
      pickReplacement: () => pickReplacement(packId, () => context.getSprite()),
      localize: async (source) => {
        const identity = {
          tag: source.tag,
          group: spriteGroup(source),
          outfit: source.outfit ?? '',
        }
        const localized = await localizeSprite(source, `${source.tag}.webp`, {
          fetch: window.fetch.bind(window),
          compress: compressImage,
          saveImage: (file, fileName) => deps.adapter.saveImageFile(
            file,
            fileName,
            deps.adapter.getCurrentCharacterName() || getPack()?.name || 'shared',
          ),
        })
        const pack = getPack()
        const latest = pack?.sprites.find((candidate) =>
          candidate.tag === identity.tag &&
          spriteGroup(candidate) === identity.group &&
          (candidate.outfit ?? '') === identity.outfit,
        )
        if (!pack || !latest || latest.url !== source.url) {
          throw new Error(t("sprite.manager.content.localize.changed", "立绘在保存期间已发生变化，请重试"))
        }
        // 预设包是只读的，改不了 sprites 本身，只能记一条同 ID 覆盖：
        // 这是「本地化预设立绘」唯一的落地方式，去掉棋盘格功能时必须保住这条路。
        if (isPresetPack(packId)) {
          deps.updateSettings(setPresetLocalSprite(
            deps.getSettings(),
            packId,
            latest,
            localized.url,
          ))
        } else {
          commitActionPack(upsertSprite(pack, {
            ...latest,
            url: localized.url,
            remoteUrl: localized.remoteUrl,
          }))
        }
        context.refresh()
        toast(currentManagerBody(), t("sprite.manager.content.localize.saved", "已将「{{p0}}」保存到本地", { p0: source.tag }))
      },
      refresh: () => {
        ctx.actions.render()
        refreshLightbox()
      },
      close: closeAction,
    }
    return context
  }


  function lightboxActions(state: ActiveLightbox): SpriteAction[] {
    const context = actionContext(
      state.packId,
      (pack) => pack.sprites[state.index] ?? null,
      () => {
        ctx.actions.render()
        state.controller?.close()
      },
    )
    return createSpriteActions(context).map((action) => ({
      ...action,
      run: () => runSpriteAction(action),
    }))
  }


  /**
   * 预设包（只读）图片详情里可用的操作。
   *
   * 只放 allowedInReadonly 的那些：预设的 sprites 不可改写，能做的是记一条同 ID 本地覆盖。
   */
  function presetLightboxActions(state: ActiveLightbox): SpriteAction[] {
    const context = actionContext(
      state.packId,
      (pack) => pack.sprites[state.index] ?? null,
      () => state.controller?.close(),
    )
    return createSpriteActions(context)
      .filter((action) => action.allowedInReadonly)
      .map((action) => ({ ...action, run: () => runSpriteAction(action) }))
  }


  function renderSpriteCell(
    body: HTMLElement,
    pack: SpritePack,
    sprite: Sprite,
    index: number,
    readonly: boolean,
  ): HTMLElement {
    const cell = el('div', 'so-sprite-cell')
    cell.tabIndex = 0
    cell.setAttribute('role', 'button')
    cell.setAttribute('aria-label', t('sprite.manager.content.pack.open_image', '查看立绘「{{name}}」', { name: sprite.tag }))
    cell.dataset.managerFocus = `sprite:${pack.id}:${spriteGroup(sprite)}:${sprite.outfit ?? ''}:${sprite.tag}`
    addCardNavigation(cell, '.so-sprite-cell')
    if (pack.coverTag === sprite.tag) cell.classList.add('so-cover')

    const img = thumbnail(sprite.url, sprite.tag)
    img.title = sprite.tag

    const tagEl = el('div', 'so-sprite-tag')
    tagEl.textContent = sprite.tag
    tagEl.title = sprite.tag

    cell.append(img, tagEl)
    // 点击放大查看（操作按钮自带 stopPropagation，互不干扰）
    cell.addEventListener('click', () => openLightbox(pack.id, index))
    cell.addEventListener('keydown', event => {
      if (event.target !== cell || event.isComposing || !['Enter', ' '].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      openLightbox(pack.id, index)
    })
    if (readonly) return cell

    const bar = el('div', 'so-sprite-actions')
    const identity = {
      tag: sprite.tag,
      group: spriteGroup(sprite),
      outfit: sprite.outfit ?? '',
    }
    const context = actionContext(
      pack.id,
      (latest) => latest.sprites.find((candidate) =>
        candidate.tag === identity.tag &&
        spriteGroup(candidate) === identity.group &&
        (candidate.outfit ?? '') === identity.outfit,
      ) ?? null,
      () => {
        ctx.actions.render()
        refreshLightbox()
      },
    )
    const sharedActions = createSpriteActions(context)
    for (const action of sharedActions) {
      const actionButton = iconButton(
        action.icon ?? action.label,
        action.label,
        () => runSpriteAction(action),
        'so-icon-btn',
        Boolean(action.disabled),
      )
      actionButton.title = action.hint ?? action.label
      bar.append(actionButton)
    }
    bar.append(
      iconButton('◀', t("sprite.manager.content.move_earlier", "前移"), () => {
        const target = context.getPack()
        if (!target) return
        ctx.actions.commitPack(moveSprite(target, index, index - 1))
      }),
      iconButton('▶', t("sprite.manager.content.move_later", "后移"), () => {
        const target = context.getPack()
        if (!target) return
        ctx.actions.commitPack(moveSprite(target, index, index + 1))
      }),
    )
    cell.append(bar)
    return cell
  }

  return { openLightbox, refreshLightbox, commitActionPack, currentManagerBody, runSpriteAction, pickReplacement, actionContext, lightboxActions, presetLightboxActions, renderSpriteCell }
}
