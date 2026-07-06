/**
 * 角色立绘悬浮窗 — SillyTavern 扩展入口。
 * 链路：加载设置 → 注入 prompt → 监听 AI 消息 → 提取标签 → 悬浮窗切换。
 * 立绘包管理与角色绑定：悬浮窗齿轮按钮打开的管理弹窗。
 */

import type { PluginSettings } from '../../core/types'
import { extractLastTag } from '../../core/tag-parser'
import { buildInjectionPrompt } from '../../core/prompt-builder'
import { getActivePack, getAvailableTags, matchSprite, preloadPack } from '../../core/sprite-store'
import { STAdapter } from './st-adapter'
import { createOverlay, type OverlayController } from './overlay-dom'
import { createSpriteManager } from './sprite-manager'
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

  function updateSettings(next: PluginSettings): void {
    settings = next
    adapter.saveSettings(settings)
    overlay.setLayout(settings.overlay)
    refresh()
  }

  const manager = createSpriteManager({
    adapter,
    getSettings: () => settings,
    updateSettings,
  })

  const overlay: OverlayController = createOverlay(
    settings.overlay,
    (layout) => {
      settings = { ...settings, overlay: layout }
      adapter.saveSettings(settings)
    },
    () => manager.open(),
  )

  /** 根据当前角色刷新：注入 prompt + 更新悬浮窗 */
  function refresh(): void {
    if (!settings.enabled) {
      adapter.injectPrompt('')
      overlay.setVisible(false)
      return
    }

    const characterName = adapter.getCurrentCharacterName()
    const tags = getAvailableTags(settings, characterName)
    adapter.injectPrompt(buildInjectionPrompt(tags))

    const pack = getActivePack(settings, characterName)
    if (pack && pack.sprites.length > 0) {
      preloadPack(pack)
      overlay.setImage(pack.sprites[0].url, pack.sprites[0].tag)
    } else if (characterName) {
      // 未绑定：显示占位提示，保留 ⚙ 管理入口
      overlay.setPlaceholder('未绑定立绘包\n点击 ⚙ 进行绑定')
    } else {
      overlay.setPlaceholder('打开角色聊天后\n点击 ⚙ 绑定立绘包')
    }
    overlay.setVisible(true)
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

  // 切换聊天/角色时：重新注入 + 刷新悬浮窗和管理弹窗（修复角色名不更新的问题）
  adapter.onCharacterChanged(() => {
    refresh()
    manager.refreshIfOpen()
  })

  // 设置面板：只保留基础设定
  mountSettingsPanel({
    getSettings: () => settings,
    updateSettings,
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
