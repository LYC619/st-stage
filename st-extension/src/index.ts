/**
 * 角色立绘悬浮窗 — SillyTavern 扩展入口。
 * 链路：加载设置 → 注入 prompt → 监听 AI 消息 → 提取标签 → 悬浮窗切换。
 * 消息后处理：隐藏 [立绘:xxx] 标签、渲染消息内插图（message-postprocess）。
 * 手机框架：悬浮 📱 图标 → Home 屏 → 内置 App（立绘/图库/设置）；见 docs/APP-SPEC.md。
 */

import type { PluginSettings } from '../../core/types'
import { extractTags } from '../../core/tag-parser'
import { buildPrompt } from '../../core/prompt-builder'
import {
  getActiveAddresses,
  getActivePacks,
  preloadPack,
  resolveSprites,
} from '../../core/sprite-store'
import { PhoneAppRegistry, createPhoneAppContext, type PhoneAppContext } from '../../core/phone-registry'
import { createPhoneShell } from '../../core/phone-shell'
import { STAdapter } from './st-adapter'
import { createOverlay, type OverlayController } from './overlay-dom'
import { createSpriteManager } from './sprite-manager'
import { mountSettingsPanel } from './settings-panel'
import { mountMessagePostprocess, reprocessAllMessages } from './message-postprocess'
import { createBuiltinApps } from './apps'

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
      next.enabled !== settings.enabled ||
      next.recentFloors !== settings.recentFloors
    const autoChanged =
      next.autoSwitch !== settings.autoSwitch ||
      next.autoSwitchSeconds !== settings.autoSwitchSeconds
    settings = next
    adapter.saveSettings(settings)
    overlay.setLayout(settings.overlay)
    phone.setVisible(settings.showPhone)
    if (autoChanged) overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds)
    refresh()
    // 显示相关设置变更：先恢复原始 DOM 再按新规则补渲染（总开关关闭时只恢复）
    if (displayChanged) reprocessAllMessages(settings)
  }

  /**
   * 仅持久化设置（阶段7）：不触发立绘 refresh / Prompt 重注入 / 楼层重渲染 / 悬浮窗布局刷新。
   * 供 App 私有数据（setAppData）与手机壳状态保存使用——这些变更与立绘渲染无关，
   * 不应连累立绘。改核心设置仍走 updateSettings 触发正常 refresh。
   */
  function saveSettingsOnly(next: PluginSettings): void {
    settings = next
    adapter.saveSettings(settings)
  }

  const manager = createSpriteManager({
    adapter,
    getSettings: () => settings,
    updateSettings,
    // 从手机打开的弹窗关闭后：重新展开手机并回到「图库」页；悬浮窗齿轮来源则正常关闭
    onClosed: (source) => {
      if (source === 'phone') phone.openApp('gallery')
    },
  })

  const overlay: OverlayController = createOverlay(
    settings.overlay,
    (layout) => {
      settings = { ...settings, overlay: layout }
      adapter.saveSettings(settings)
    },
    () => manager.open(),
    // 悬浮窗 ✕：只隐藏窗体并记住状态，立绘功能（含楼层立绘）不受影响
    () => updateSettings({ ...settings, overlayHidden: true }),
  )
  overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds)

  /* ---- 手机框架 ---- */
  const registry = new PhoneAppRegistry()

  function createAppContext(appId: string, goHome: () => void): PhoneAppContext {
    return createPhoneAppContext({
      appId,
      getSettings: () => settings,
      updateSettings,
      saveSettingsOnly,
      getCharacterName: () => adapter.getCurrentCharacterName(),
      goHome,
    })
  }

  const phone = createPhoneShell(settings.phone, {
    registry,
    createAppContext,
    onStateChange: (state) => {
      // 手机壳位置/展开态与立绘无关，走仅保存路径
      saveSettingsOnly({ ...settings, phone: state })
    },
  })

  /** 收起手机壳并持久化（打开全屏弹窗前用，避免手机挡在弹窗上） */
  function collapsePhone(): void {
    settings = { ...settings, phone: { ...settings.phone, open: false } }
    adapter.saveSettings(settings)
    phone.setState(settings.phone)
  }

  for (const app of createBuiltinApps({
    // 从手机开图库弹窗：先收起手机（避免挡在弹窗上），来源标记=手机（关闭后回图库页）
    openGalleryManager: () => {
      collapsePhone()
      manager.open('phone')
    },
  })) {
    registry.register(app)
  }

  // 第三方注册入口：try/catch 由第三方自负，register 抛错不拖垮框架
  window.stStage = {
    registerApp: (app) => registry.register(app),
  }

  /** 悬浮窗是否允许显示：总开关开 + 非仅楼层模式 + 未被用户手动关闭 */
  function overlayAllowed(): boolean {
    return settings.enabled && settings.spriteDisplayMode !== 'inline' && !settings.overlayHidden
  }

  /** 上次悬浮窗内容 key：角色+包不变时不重置当前立绘（无关设置变更不打断展示） */
  let lastOverlayContentKey = ''

  /** 根据当前角色刷新：注入 prompt + 更新悬浮窗 */
  function refresh(): void {
    if (!settings.enabled) {
      // 总开关关闭：清空注入、隐藏悬浮窗；手机与其他内置工具不受影响
      adapter.injectPrompt('')
      overlay.setVisible(false)
      lastOverlayContentKey = ''
      return
    }

    const characterName = adapter.getCurrentCharacterName()
    const packs = getActivePacks(settings, characterName)
    const pack = packs[0] ?? null
    // 三级地址列表 → prompt（纯图名场景自然退化为旧的图名清单）
    const prompt = buildPrompt(
      getActiveAddresses(settings, characterName),
      settings.multiRolePromptMode,
      settings.spriteCount,
    )
    adapter.injectPrompt(prompt)

    const contentKey = `${characterName}|${packs.map((p) => p.id).join(',')}|${pack ? pack.sprites.length > 0 : false}`
    if (contentKey !== lastOverlayContentKey) {
      lastOverlayContentKey = contentKey
      if (pack && pack.sprites.length > 0) {
        for (const p of packs) preloadPack(p)
        overlay.setImage(pack.sprites[0].url, pack.sprites[0].tag)
      } else if (characterName) {
        // 未绑定：显示占位提示，保留 ⚙ 管理入口
        overlay.setPlaceholder('未绑定立绘包\n点击 ⚙ 进行绑定')
      } else {
        overlay.setPlaceholder('打开角色聊天后\n点击 ⚙ 绑定立绘包')
      }
    }
    // 仅楼层模式 / 用户手动关闭：悬浮窗一律不显示
    overlay.setVisible(overlayAllowed())
  }

  // 收到 AI 消息：提取全部标签 → 多包严格匹配序列 → 悬浮窗排队展示（功能③）
  adapter.onMessageReceived((text) => {
    if (!settings.enabled) return
    const characterName = adapter.getCurrentCharacterName()
    const packs = getActivePacks(settings, characterName)
    if (packs.length === 0) return
    const seq = resolveSprites(packs, extractTags(text))
    // 仅楼层模式/手动关闭时不弹悬浮窗（楼层立绘由消息后处理负责）
    if (seq.length > 0 && overlayAllowed()) {
      overlay.setSprites(seq)
      overlay.setVisible(true)
    }
  })

  // 消息渲染后处理：隐藏标签 / 渲染插图
  mountMessagePostprocess({ getSettings: () => settings })

  // 切换聊天/角色时：重新注入 + 刷新悬浮窗和管理弹窗；延迟补渲染窗口内历史楼层
  // （渲染事件逐条触发时窗口守卫已限流，这里兜底渲染事件缺失的旧版 ST / 迟到的 DOM）
  adapter.onCharacterChanged(() => {
    refresh()
    manager.refreshIfOpen()
    setTimeout(() => reprocessAllMessages(settings), 200)
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
