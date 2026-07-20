/**
 * 角色立绘悬浮窗 — SillyTavern 扩展入口。
 * 链路：加载设置 → 注入 prompt → 监听 AI 消息 → 提取标签 → 悬浮窗切换。
 * 消息后处理：隐藏 [立绘:xxx] 标签、渲染消息内插图（message-postprocess）。
 * 手机框架：悬浮 📱 图标 → Home 屏 → 内置 App（立绘/图库/设置）；见 docs/APP-SPEC.md。
 */

import type { PluginSettings } from '../../core/types'
import { extractTags } from '../../core/tag-parser'
import { buildInjectionPrompt, buildMultiRolePrompt } from '../../core/prompt-builder'
import { getActivePack, getAvailableTags, matchSprites, preloadPack } from '../../core/sprite-store'
import { PhoneAppRegistry, type PhoneAppContext } from '../../core/phone-registry'
import { createPhoneShell } from '../../core/phone-shell'
import { STAdapter } from './st-adapter'
import { createOverlay, type OverlayController } from './overlay-dom'
import { createSpriteManager } from './sprite-manager'
import { mountSettingsPanel } from './settings-panel'
import { mountMessagePostprocess, reprocessAllMessages } from './message-postprocess'
import { createBuiltinApps } from './phone-apps'

declare global {
  interface Window {
    /** 第三方扩展注册手机 App 的公开入口（docs/APP-SPEC.md） */
    stStage?: { registerApp: PhoneAppRegistry['register'] }
  }
}

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
    const displayChanged =
      next.hideTagInMessage !== settings.hideTagInMessage ||
      next.renderInlineImages !== settings.renderInlineImages ||
      next.spriteDisplayMode !== settings.spriteDisplayMode ||
      next.imageHost !== settings.imageHost ||
      next.enabled !== settings.enabled
    const autoChanged =
      next.autoSwitch !== settings.autoSwitch ||
      next.autoSwitchSeconds !== settings.autoSwitchSeconds
    settings = next
    adapter.saveSettings(settings)
    overlay.setLayout(settings.overlay)
    phone.setVisible(settings.showPhone)
    if (autoChanged) overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds)
    refresh()
    // 显示相关设置变更：清掉幂等标记，重新处理全部气泡
    if (displayChanged) reprocessAllMessages(settings)
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
  overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds)

  /* ---- 手机框架 ---- */
  const registry = new PhoneAppRegistry()

  function createAppContext(appId: string, goHome: () => void): PhoneAppContext {
    return {
      getSettings: () => settings,
      updateSettings,
      getCharacterName: () => adapter.getCurrentCharacterName(),
      getAppData: <T,>() => settings.apps[appId] as T | undefined,
      setAppData: <T,>(data: T) => {
        updateSettings({ ...settings, apps: { ...settings.apps, [appId]: data } })
      },
      goHome,
    }
  }

  const phone = createPhoneShell(settings.phone, {
    registry,
    createAppContext,
    onStateChange: (state) => {
      settings = { ...settings, phone: state }
      adapter.saveSettings(settings)
    },
  })

  for (const app of createBuiltinApps({ overlay, manager })) {
    registry.register(app)
  }

  // 第三方注册入口：try/catch 由第三方自负，register 抛错不拖垮框架
  window.stStage = {
    registerApp: (app) => registry.register(app),
  }

  /** 根据当前角色刷新：注入 prompt + 更新悬浮窗 */
  function refresh(): void {
    if (!settings.enabled) {
      adapter.injectPrompt('')
      overlay.setVisible(false)
      return
    }

    const characterName = adapter.getCurrentCharacterName()
    const pack = getActivePack(settings, characterName)
    // 多角色模式：按分组枚举（全量/重复）；否则单角色标签列表
    const prompt =
      settings.multiRole && pack
        ? buildMultiRolePrompt(
            pack.sprites.map((s) => ({ group: s.group ?? '', tag: s.tag })),
            settings.multiRolePromptMode,
          )
        : buildInjectionPrompt(getAvailableTags(settings, characterName))
    adapter.injectPrompt(prompt)

    if (pack && pack.sprites.length > 0) {
      preloadPack(pack)
      overlay.setImage(pack.sprites[0].url, pack.sprites[0].tag)
    } else if (characterName) {
      // 未绑定：显示占位提示，保留 ⚙ 管理入口
      overlay.setPlaceholder('未绑定立绘包\n点击 ⚙ 进行绑定')
    } else {
      overlay.setPlaceholder('打开角色聊天后\n点击 ⚙ 绑定立绘包')
    }
    // inline 模式：立绘在楼层内原位显示，悬浮窗整个隐藏
    overlay.setVisible(settings.spriteDisplayMode !== 'inline')
  }

  // 收到 AI 消息：提取全部标签 → 匹配序列 → 悬浮窗排队展示（功能③）
  adapter.onMessageReceived((text) => {
    if (!settings.enabled || settings.spriteDisplayMode === 'inline') return
    const characterName = adapter.getCurrentCharacterName()
    const pack = getActivePack(settings, characterName)
    if (!pack) return
    const seq = matchSprites(pack, extractTags(text))
    if (seq.length > 0) {
      overlay.setSprites(seq)
      overlay.setVisible(true)
    }
  })

  // 消息渲染后处理：隐藏标签 / 渲染插图
  mountMessagePostprocess({ getSettings: () => settings })

  // 切换聊天/角色时：重新注入 + 刷新悬浮窗和管理弹窗（修复角色名不更新的问题）
  adapter.onCharacterChanged(() => {
    refresh()
    manager.refreshIfOpen()
  })

  // 设置面板：基础设定（开关/图床前缀）
  mountSettingsPanel({
    getSettings: () => settings,
    updateSettings,
  })

  refresh()
  phone.setState(settings.phone)
  phone.setVisible(settings.showPhone)
  console.log('[sprite-overlay] 角色立绘悬浮窗扩展已加载（含手机框架）')
}

// ST 扩展脚本在 app ready 后加载，直接初始化即可；保险起见等 DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void init())
} else {
  void init()
}
