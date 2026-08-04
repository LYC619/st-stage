import { normalizeTag } from '../../core/naming'
import { type StoryContext, upsertStorySprite } from '../../core/story-archive'
import type { PluginSettings, Sprite } from '../../core/types'
import { getSpriteSource } from '../../core/types'

export interface StoryImageCaptureDeps {
  getSettings(): PluginSettings
  updateSettings(settings: PluginSettings): void
  getStoryContext(): StoryContext
  localize(sprite: Sprite, fileName: string, story: StoryContext): Promise<Sprite>
}

export interface StoryImageCaptureController {
  decorate(root: ParentNode): void
  cleanup(): void
}

const ACTION_CLASS = 'so-story-save-action'

export function createStoryImageCapture(deps: StoryImageCaptureDeps): StoryImageCaptureController {
  const decorations = new Map<HTMLButtonElement, { image: HTMLImageElement; handler: () => void }>()

  /** 释放一项装饰及其强引用，避免 ST 重渲染后的离线节点常驻。 */
  const release = (
    action: HTMLButtonElement,
    image: HTMLImageElement,
    handler: () => void,
  ): void => {
    action.removeEventListener('click', handler)
    action.remove()
    delete image.dataset.soStorySave
    decorations.delete(action)
  }

  /** 每次扫描前回收已被宿主替换的旧消息节点。 */
  const pruneDetached = (): void => {
    for (const [action, { image, handler }] of decorations) {
      if (!action.isConnected || !image.isConnected) release(action, image, handler)
    }
  }

  const decorate = (root: ParentNode): void => {
    pruneDetached()
    for (const image of Array.from(root.querySelectorAll<HTMLImageElement>('img'))) {
      if (!isEligible(image) || image.dataset.soStorySave === 'true') continue
      const action = document.createElement('button')
      action.type = 'button'
      action.className = ACTION_CLASS
      action.textContent = '保存到图库'
      const handler = () => { void archive(image, action, deps) }
      action.addEventListener('click', handler)
      image.dataset.soStorySave = 'true'
      image.after(action)
      decorations.set(action, { image, handler })
    }
  }

  const cleanup = (): void => {
    for (const [action, { image, handler }] of decorations) {
      release(action, image, handler)
    }
  }

  return { decorate, cleanup }
}

async function archive(
  image: HTMLImageElement,
  action: HTMLButtonElement,
  deps: StoryImageCaptureDeps,
): Promise<void> {
  if (action.disabled) return
  const url = image.currentSrc || image.src
  const tag = normalizeTag(image.alt || image.title)
  const source: Sprite = { tag, url }
  const story = deps.getStoryContext()
  action.disabled = true
  action.textContent = '保存中…'
  try {
    let stored = source
    let remoteOnly = false
    if (getSpriteSource(source) === 'hosted') {
      try {
        stored = await deps.localize(source, `${tag || 'generated-image'}.webp`, story)
      } catch (error) {
        const detail = error instanceof Error ? error.message : '未知错误'
        const keepRemote = window.confirm(
          `图片无法保存到本地：${detail}\n\n是否仅保留远程引用？对方网站失效后图片也会失效。`,
        )
        if (!keepRemote) {
          action.disabled = false
          action.textContent = '保存到图库'
          return
        }
        stored = { ...source, remoteUrl: source.url }
        remoteOnly = true
      }
    }
    const next = upsertStorySprite(deps.getSettings(), story, stored)
    deps.updateSettings(next)
    action.textContent = remoteOnly ? '已保存远程引用' : '已保存'
  } catch (error) {
    action.disabled = false
    action.textContent = error instanceof Error ? '保存失败，重试' : '保存失败'
  }
}

function isEligible(image: HTMLImageElement): boolean {
  const messageBody = image.closest('.mes_text')
  const message = messageBody?.closest('.mes')
  if (!message || message.getAttribute('is_user') === 'true' || message.getAttribute('is_system') === 'true') {
    return false
  }
  if (image.closest('.avatar, .mesAvatar, .emoji, .so-inline-sprite, .st-stage-renderer, [class*="so-renderer-"]')) {
    return false
  }
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  return !(width > 0 && height > 0 && (width < 64 || height < 64))
}
