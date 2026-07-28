/**
 * 掌柜的（原「角色立绘悬浮窗」）— SillyTavern 扩展入口。酒馆里的事，掌柜的都管。
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
  resolveSprites,
} from '../../core/sprite-store'
import { preloadMatchedSprites, preloadOnActivate } from '../../core/sprite-preload'
import { PhoneAppRegistry, createPhoneAppContext, installRegisterQueue, type PhoneApp, type PhoneAppContext } from '../../core/phone-registry'
import { createPhoneShell } from '../../core/phone-shell'
import { STAdapter } from './st-adapter'
import { createOverlay, type OverlayController } from './overlay-dom'
import { createSpriteManager } from './sprite-manager'
import { mountSettingsPanel } from './settings-panel'
import { mountMessagePostprocess, reprocessAllMessages } from './message-postprocess'
import { createBuiltinApps } from './apps'
import { createNewvarRuntime } from './apps/newvar/runtime'
import { createNewvarDesigner } from './apps/newvar/designer'
import { NEWVAR_CHANNEL, NEWVAR_APP_ID } from './apps/newvar/config'
import { createApiManager } from './apps/api/manager'
import { API_APP_ID, sanitizeAppData } from './apps/api/core'

declare global {
  interface Window {
    /** 独立 App 注册入口（docs/APP-SPEC.md）：不抛错，注册失败打控制台 */
    stStage?: { registerApp: (app: PhoneApp) => void }
    /** 独立 App 注册队列：st-stage 就绪前是普通数组（第三方 `||= []` 后 push），就绪后换成即时注册的 shim */
    stStageQueue?: { push(app: PhoneApp): void }
    /** 内部：上一次 bundle 执行留下的常驻清理（防同页重复执行时事件双重处理/双手机壳） */
    __stStageDispose?: () => void
  }
}

async function init(): Promise<void> {
  // bundle 若在同页被执行两次（stub 版本参数失败回退重 import 等），先清上一实例的常驻部分：
  // 新变量运行时的事件订阅 + 手机壳（独立 App 会经注册队列 shim 在新实例重放，不会丢）。
  // overlay/楼层后处理等其余监听的全量卸载仍留待有实际症状时按需补
  window.__stStageDispose?.()
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

  // 「新变量」运行时：注入走独立命名通道（与立绘 injectPrompt 互不覆盖），解析/存储常驻
  const newvarRuntime = createNewvarRuntime({
    getSettings: () => settings,
    inject: (prompt, depth) => adapter.injectChannel(NEWVAR_CHANNEL, prompt, depth),
  })
  // dispose 接线：正常页面生命周期里 ST 不卸载扩展（启停需刷新），
  // 只在 bundle 同页重复执行时由下一次 init 调用：防事件订阅翻倍、防双手机壳
  window.__stStageDispose = () => {
    newvarRuntime.dispose()
    phone.destroy()
  }

  // 「变量设计」弹窗：配置写 App 私有存储（saveSettingsOnly，不触发立绘刷新）后通知运行时重注入
  const newvarDesigner = createNewvarDesigner({
    getData: () => newvarRuntime.getData(),
    setData: (next) => {
      saveSettingsOnly({ ...settings, apps: { ...settings.apps, [NEWVAR_APP_ID]: next } })
      newvarRuntime.onConfigChanged()
    },
    buildPreview: () => newvarRuntime.buildPreview(),
    getLastParse: () => newvarRuntime.getLastParse(),
    onClosed: () => phone.openApp('newvar'),
  })

  // 「API 站点管理」弹窗：站点档案存 App 私有存储（saveSettingsOnly，不触发立绘刷新）
  const apiManager = createApiManager({
    getData: () => sanitizeAppData(settings.apps[API_APP_ID]),
    setData: (next) => {
      saveSettingsOnly({ ...settings, apps: { ...settings.apps, [API_APP_ID]: next } })
    },
    onClosed: () => phone.openApp('api'),
  })

  for (const app of createBuiltinApps({
    // 从手机开图库弹窗：先收起手机（避免挡在弹窗上），来源标记=手机（关闭后回图库页）
    openGalleryManager: () => {
      collapsePhone()
      manager.open('phone')
    },
    newvarRuntime,
    openNewvarDesigner: () => {
      collapsePhone()
      newvarDesigner.open()
    },
    openApiManager: () => {
      collapsePhone()
      apiManager.open()
    },
  })) {
    registry.register(app)
  }

  // 独立 App 注册（docs/APP-SPEC.md）：先吃掉 st-stage 就绪前排队的积压，再接管后续 push 即时注册。
  // registerApp 走同一 shim——注册失败（形状非法/id 重复）只打控制台，不拖垮第三方扩展也不拖垮框架
  const registerQueue = installRegisterQueue(window.stStageQueue, (app) => registry.register(app))
  window.stStageQueue = registerQueue
  window.stStage = {
    registerApp: (app) => registerQueue.push(app),
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
      settings.promptTemplate,
    )
    adapter.injectPrompt(prompt, settings.injectionDepth)

    const contentKey = `${characterName}|${packs.map((p) => p.id).join(',')}|${pack ? pack.sprites.length > 0 : false}`
    if (contentKey !== lastOverlayContentKey) {
      lastOverlayContentKey = contentKey
      if (pack && pack.sprites.length > 0) {
        preloadOnActivate(packs)
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
    preloadMatchedSprites(seq)
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
  newvarRuntime.start()
  phone.setState(settings.phone)
  phone.setVisible(settings.showPhone)
  const version =
    typeof __EXT_VERSION__ === 'undefined' ? 'dev' : `v${__EXT_VERSION__} · ${__BUILD_TIME__}`
  console.log(`[sprite-overlay] 掌柜的（st-stage）已加载（含手机框架）${version}`)
}

// ST 扩展脚本在 app ready 后加载，直接初始化即可；保险起见等 DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void init())
} else {
  void init()
}
