/**
 * 立绘悬浮窗展示、Prompt 注入与流式标签解析运行时（解耦自 index.ts）。
 */

import { t } from '../../core/i18n'
import type { PluginSettings } from '../../core/types'
import { buildActiveSpritePrompt } from '../../core/active-prompt'
import { extractTags } from '../../core/tag-parser'
import { getActivePacks, resolveSprite, resolveSprites } from '../../core/sprite-store'
import { buildApproxCandidates, resolveWithApprox } from '../../core/approx-match'
import { preloadMatchedSprites, preloadOnActivate } from '../../core/sprite-preload'
import type { STAdapter } from './st-adapter'
import type { OverlayController } from './overlay-dom'

export interface SpriteRuntimeDeps {
  adapter: STAdapter
  overlay: OverlayController
  getSettings: () => PluginSettings
}

export function createSpriteRuntime(deps: SpriteRuntimeDeps) {
  let lastOverlayContentKey = ''
  let streamedText = ''
  let streamedTagCount = 0

  function overlayAllowed(): boolean {
    const settings = deps.getSettings()
    return settings.enabled && settings.spriteDisplayMode !== 'inline' && !settings.overlayHidden
  }

  function refresh(): void {
    const settings = deps.getSettings()
    if (!settings.enabled) {
      deps.adapter.injectPrompt('')
      deps.overlay.setVisible(false)
      lastOverlayContentKey = ''
      return
    }

    const characterName = deps.adapter.getCurrentCharacterName()
    const packs = getActivePacks(settings, characterName)
    const pack = packs[0] ?? null
    const prompt = buildActiveSpritePrompt(settings, characterName)
    deps.adapter.injectPrompt(prompt, settings.injectionDepth)

    const contentKey = `${characterName}|${packs.map((p) => p.id).join(',')}|${pack ? pack.sprites.length > 0 : false}`
    if (contentKey !== lastOverlayContentKey) {
      lastOverlayContentKey = contentKey
      if (pack && pack.sprites.length > 0) {
        preloadOnActivate(packs)
        deps.overlay.setImage(pack.sprites[0].url, pack.sprites[0].tag)
      } else if (characterName) {
        deps.overlay.setPlaceholder(t('sprite.overlay.placeholder_no_pack', '未绑定立绘包\n点击 ⚙ 进行绑定'))
      } else {
        deps.overlay.setPlaceholder(t('sprite.overlay.placeholder_no_character', '打开角色聊天后\n点击 ⚙ 绑定立绘包'))
      }
    }
    deps.overlay.setVisible(overlayAllowed())
  }

  function resolveSequenceWithApprox(
    packs: ReturnType<typeof getActivePacks>,
    addresses: string[],
  ): ReturnType<typeof resolveSprites> {
    const cache = { current: null as ReturnType<typeof buildApproxCandidates> | null }
    const out: ReturnType<typeof resolveSprites> = []
    for (const address of addresses) {
      const sprite = resolveWithApprox(packs, address, resolveSprite, true, cache)
      if (sprite && out[out.length - 1] !== sprite) out.push(sprite)
    }
    return out
  }

  function displaySprites(addresses: ReturnType<typeof extractTags>): void {
    const settings = deps.getSettings()
    if (!settings.enabled || addresses.length === 0) return
    const characterName = deps.adapter.getCurrentCharacterName()
    const packs = getActivePacks(settings, characterName)
    if (packs.length === 0) return
    const seq = settings.approxMatch
      ? resolveSequenceWithApprox(packs, addresses)
      : resolveSprites(packs, addresses)
    preloadMatchedSprites(seq)
    if (seq.length > 0 && overlayAllowed()) {
      deps.overlay.setSprites(seq)
      deps.overlay.setVisible(true)
    }
  }

  function resetStreamState(): void {
    streamedText = ''
    streamedTagCount = 0
  }

  function handleStreamText(text: string): void {
    if (!text.startsWith(streamedText)) streamedTagCount = 0
    streamedText = text
    const addresses = extractTags(text)
    const added = addresses.slice(streamedTagCount)
    streamedTagCount = addresses.length
    displaySprites(added)
  }

  function handleFinalMessage(text: string): void {
    displaySprites(extractTags(text))
    resetStreamState()
  }

  function previewSprite(url: string, tag: string): void {
    const settings = deps.getSettings()
    if (!settings.enabled) return
    deps.overlay.setImage(url, tag)
    if (overlayAllowed()) deps.overlay.setVisible(true)
  }

  return {
    refresh,
    resetStreamState,
    handleStreamText,
    handleFinalMessage,
    previewSprite,
  }
}
