/**
 * 角色立绘悬浮窗 — SillyTavern 扩展入口。
 * 链路：加载设置 → 注入 prompt → 监听 AI 消息 → 提取标签 → 悬浮窗切换。
 */

import type { PluginSettings } from '../../core/types'
import { extractLastTag } from '../../core/tag-parser'
import { buildInjectionPrompt } from '../../core/prompt-builder'
import { getActivePack, getAvailableTags, matchSprite, preloadPack } from '../../core/sprite-store'
import { STAdapter } from './st-adapter'
import { createOverlay, type OverlayController } from './overlay-dom'
import { mountSettingsPanel } from './settings-panel'

async function init(): Promise<void> {
  const adapter = new STAdapter()
  let settings: PluginSettings
  try {
    settings = await adapter.loadSettings()
  } catch (err) {
    console.error('[sprite-overlay] 初始化失败', err)
    return
  }

  let overlay: OverlayController = createOverlay(settings.overlay, (layout) => {
    settings = { ...settings, overlay: layout }
    adapter.saveSettings(settings)
  })

  /** 根据当前角色刷新：注入 prompt + 重置悬浮窗 */
  function refresh(): void {
    const characterName = adapter.getCurrentCharacterName()
    const tags = getAvailableTags(settings, characterName)
    adapter.injectPrompt(settings.enabled ? buildInjectionPrompt(tags) : '')

    const pack = settings.enabled ? getActivePack(settings, characterName) : null
    if (pack && pack.sprites.length > 0) {
      preloadPack(pack)
      overlay.setImage(pack.sprites[0].url, pack.sprites[0].tag)
      overlay.setVisible(true)
    } else {
      overlay.setVisible(false)
    }
  }

  // 收到 AI 消息：提取标签 → 匹配 → 切换立绘
  adapter.onMessageReceived((text) => {
    if (!settings.enabled) return
    const characterName = adapter.getCurrentCharacterName()
    const pack = getActivePack(settings, characterName)
    if (!pack) return
    const tag = extractLastTag(text)
    if (!tag) return
    const sprite = matchSprite(pack, tag)
    if (sprite) {
      overlay.setImage(sprite.url, sprite.tag)
      overlay.setVisible(true)
    }
  })

  // 切换聊天/角色时刷新
  adapter.onCharacterChanged(() => refresh())

  // 设置面板
  mountSettingsPanel({
    adapter,
    getSettings: () => settings,
    updateSettings: (next) => {
      settings = next
      adapter.saveSettings(settings)
      overlay.setLayout(settings.overlay)
      refresh()
    },
  })

  refresh()
  console.log('[sprite-overlay] 角色立绘悬浮窗扩展已加载')
}

// ST 扩展脚本在 app ready 后加载，直接初始化即可；保险起见等 DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void init())
} else {
  void init()
}
