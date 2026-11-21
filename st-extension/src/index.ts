/**
 * 百工（st-stage）— SillyTavern 扩展入口。酒馆里的事，百工都做。
 * 职责：生命周期编排、宿主能力桥接、内置/独立 App 注册、立绘/HUD/渲染器接线。
 */

import { getPackCover, type PluginSettings } from '../../core/types'
import { getActivePacks, resolveSprite } from '../../core/sprite-store'
import { getLastMessageId, readVariables, subscribeVarEvents } from './apps/mvu/bridge'
import {
  PhoneAppRegistry,
  createPhoneAppContext,
  installRegisterQueue,
  runAppSetup,
  type AppHostDeps,
  type PhoneApp,
  type ToastKind,
} from '../../core/phone-registry'
import { createCapabilityTracker, createEventHub, type CapabilityTracker } from '../../core/capabilities'
import { openTrackedAppModal } from '../../core/app-modal'
import { createPhoneShell } from '../../core/phone-shell'
import { STAdapter, initI18n } from './st-adapter'
import { createOverlay, type OverlayController } from './overlay-dom'
import { createSpriteManager } from './sprite-manager'
import { mountSettingsPanel } from './settings-panel'
import { mountMessagePostprocess, reprocessAllMessages } from './message-postprocess'
import { createStoryImageCapture } from './story-image-capture'
import { localizeSprite } from './sprite-localize'
import { compressImage } from '../../core/image-compress'
import { createBuiltinApps } from './apps'
import { readAppearance } from './apps/appearance/pack'
import { createNewvarRuntime } from './apps/newvar/runtime'
import { createNewvarDesigner } from './apps/newvar/designer'
import { NEWVAR_CHANNEL, NEWVAR_APP_ID, normalizeNewvarData } from './apps/newvar/config'
import { createRendererRuntime } from './apps/renderer/runtime'
import { normalizeRendererSettings, RENDERER_APP_ID } from './apps/renderer/config'
import { mountGalMode } from './apps/renderer/modes/gal'
import { mountCardsMode } from './apps/renderer/modes/cards'
import { mountBattleMode } from './apps/renderer/modes/battle'
import { createComposerBridge } from './apps/renderer/composer'
import { createApiManager } from './apps/api/manager'
import { API_APP_ID, sanitizeAppData } from './apps/api/core'
import { CARD_CHOICES_APP_ID, createChoicePersistence } from './apps/renderer/choices'
import { beginExtensionLifecycle, runWhenDomReady } from './lifecycle'
import { buildRoleSummary, type ExternalVariableStatus } from './role-summary'
import { registerPhoneCommand } from './slash-commands'
import { createHudController } from './hud-controller'
import { createSpriteRuntime } from './sprite-runtime'
import { onOpenAppRequest, onStoryEvent } from './apps/shared/story-events'

declare global {
  interface Window {
    /** 独立 App 注册入口（docs/APP-SPEC.md）：不抛错，注册失败打控制台 */
    stStage?: { registerApp: (app: PhoneApp) => void }
    /** 独立 App 注册队列：st-stage 就绪前是普通数组，就绪后换成即时注册的 shim */
    stStageQueue?: { push(app: PhoneApp): void }
    /** 内部：上一次 bundle 执行留下的常驻清理（防同页重复执行时事件双重处理/双手机壳） */
    __stStageDispose?: () => void
  }
}

async function init(lifecycle: CapabilityTracker): Promise<void> {
  await initI18n().catch((err) => {
    console.warn('[sprite-overlay] i18n 初始化失败', err)
  })

  const adapter = new STAdapter()
  let settings: PluginSettings
  let phoneVisible = false
  let transientPhoneOpen = false
  try {
    settings = await adapter.loadSettings()
  } catch (err) {
    console.error('[sprite-overlay] 初始化失败', err)
    return
  }
  if (lifecycle.disposed) return

  const settingsListeners = new Set<() => void>()
  const notifySettingsListeners = () => {
    for (const fn of settingsListeners) fn()
  }

  let onSettingsApplied: (() => void) | null = null

  function updateSettings(next: PluginSettings): void {
    const displayChanged =
      next.hideTagInMessage !== settings.hideTagInMessage ||
      next.renderInlineImages !== settings.renderInlineImages ||
      next.spriteDisplayMode !== settings.spriteDisplayMode ||
      next.imageHost !== settings.imageHost ||
      next.enabled !== settings.enabled ||
      next.recentFloors !== settings.recentFloors ||
      next.spriteOpacity !== settings.spriteOpacity
    const autoChanged =
      next.autoSwitch !== settings.autoSwitch ||
      next.autoSwitchSeconds !== settings.autoSwitchSeconds
    if (next.showPhone !== settings.showPhone) {
      transientPhoneOpen = false
    }
    settings = next
    adapter.saveSettings(settings)
    overlay.setLayout(settings.overlay)
    overlay.setOpacity(settings.spriteOpacity)
    phoneVisible = settings.showPhone || transientPhoneOpen
    phone.setVisible(phoneVisible)
    if (autoChanged) overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds)
    spriteRuntime.refresh()
    if (displayChanged) reprocessAllMessages(settings)
    onSettingsApplied?.()
    notifySettingsListeners()
  }

  function saveSettingsOnly(next: PluginSettings): void {
    const previousNewvar = normalizeNewvarData(settings.apps[NEWVAR_APP_ID])
    const nextNewvar = normalizeNewvarData(next.apps[NEWVAR_APP_ID])
    const previousHidesUpdates = previousNewvar.enabled && previousNewvar.hideUpdateBlocks
    const nextHidesUpdates = nextNewvar.enabled && nextNewvar.hideUpdateBlocks
    settings = next
    adapter.saveSettings(settings)
    phone.refreshHome()
    if (previousHidesUpdates !== nextHidesUpdates) {
      reprocessAllMessages(settings)
    }
    notifySettingsListeners()
  }

  const appMessageHub = createEventHub<string>()
  const appCharacterHub = createEventHub<null>()
  const hostTracker = createCapabilityTracker()
  lifecycle.track(() => hostTracker.dispose())
  lifecycle.track(() => adapter.injectPrompt(''))
  const usedAppChannels = new Set<string>()

  const platformCaps = {
    onMessageReceived: (handler: (text: string) => void) => appMessageHub.subscribe(handler),
    onCharacterChanged: (handler: () => void) => appCharacterHub.subscribe(() => handler()),
    injectPrompt: (appId: string, text: string, depth?: number) => {
      const channel = `app:${appId}`
      if (!usedAppChannels.has(channel)) {
        usedAppChannels.add(channel)
        hostTracker.track(() => adapter.injectChannel(channel, ''))
      }
      adapter.injectChannel(channel, text, depth)
    },
    toast: (kind: ToastKind, message: string) => {
      const toastr = (window as { toastr?: Record<string, (msg: string) => void> }).toastr
      if (toastr?.[kind]) toastr[kind](message)
      else console.info(`[sprite-overlay][${kind}] ${message}`)
    },
  }

  function createHostDeps(appId: string): AppHostDeps {
    return {
      appId,
      getSettings: () => settings,
      saveSettingsOnly,
      getCharacterName: () => adapter.getCurrentCharacterName(),
      getCharacterCard: () => {
        try {
          const ctx = window.SillyTavern?.getContext()
          const id = ctx?.characterId
          if (id !== undefined && id !== null && String(id) !== '') {
            return ctx?.characters?.[Number(id)]
          }
        } catch (err) {
          console.warn('[st-stage] 读取当前角色卡信息失败', err)
        }
        return undefined
      },
      getChatContext: () => {
        try {
          const ctx = window.SillyTavern?.getContext()
          return {
            characterId: ctx?.characterId,
            chatId: ctx?.chatId ?? ctx?.chatMetadata?.file_name,
            characterName: adapter.getCurrentCharacterName(),
            chat: ctx?.chat,
          }
        } catch (err) {
          console.warn('[st-stage] 读取聊天上下文失败', err)
        }
        return undefined
      },
      getVariables: async () => {
        try {
          const res = await readVariables({ type: 'message', message_id: 'latest' }, getLastMessageId())
          if (res.status === 'ready') return res.data
        } catch (err) {
          console.warn('[st-stage] 读取外部状态变量失败', err)
        }
        return undefined
      },
      ...platformCaps,
    }
  }

  let openPhoneApp = (_appId: string) => {}

  const manager = createSpriteManager({
    adapter,
    getSettings: () => settings,
    updateSettings,
    onClosed: (source) => {
      if (source === 'phone') openPhoneApp('gallery')
    },
  })
  lifecycle.track(() => manager.destroy())

  const overlay: OverlayController = createOverlay(
    settings.overlay,
    (layout) => {
      settings = { ...settings, overlay: layout }
      adapter.saveSettings(settings)
    },
    () => manager.open(),
    () => updateSettings({ ...settings, overlayHidden: true }),
    () => openPhoneApp('sprites'),
  )
  lifecycle.track(() => overlay.destroy())
  overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds)
  overlay.setOpacity(settings.spriteOpacity)

  const spriteRuntime = createSpriteRuntime({
    adapter,
    overlay,
    getSettings: () => settings,
  })

  const registry = new PhoneAppRegistry()

  function createAppContext(appId: string, goHome: () => void) {
    return createPhoneAppContext({
      ...createHostDeps(appId),
      updateSettings: (next) => {
        updateSettings(next)
        phone.refreshApp?.(appId)
      },
      goHome,
      openModal: (id, build) => {
        const restoreTransient = transientPhoneOpen
        openTrackedAppModal(build, {
          onOpen: collapsePhone,
          onClose: () => {
            if (restoreTransient) transientPhoneOpen = true
            openPhoneApp(id)
          },
        }, (cleanup) => hostTracker.track(cleanup))
      },
    })
  }

  function homeSummary(external: ExternalVariableStatus = 'checking') {
    const ctx = window.SillyTavern?.getContext()
    const hasCharacter = ctx?.characterId !== undefined && ctx.characterId !== null && String(ctx.characterId) !== ''
    return buildRoleSummary(settings, hasCharacter ? adapter.getCurrentCharacterName() : '', hasCharacter ? adapter.getStoryContext().title : '', external)
  }

  const phone = createPhoneShell(settings.phone, {
    registry,
    createAppContext,
    getHomeSummary: () => homeSummary(),
    readHomeSummary: async () => {
      const result = await readVariables({ type: 'message', message_id: 'latest' }, getLastMessageId())
      const status: ExternalVariableStatus = result.status === 'ready'
        ? result.meta.source === 'mvu' ? 'mvu' : 'helper' : result.status
      return homeSummary(status)
    },
    onStateChange: (state) => {
      if (!state.open && transientPhoneOpen) {
        transientPhoneOpen = false
        phoneVisible = settings.showPhone
        phone.setVisible(phoneVisible)
      }
      saveSettingsOnly({ ...settings, phone: state })
    },
  })
  lifecycle.track(() => phone.destroy())
  phone.setAppearance(readAppearance(settings.apps.appearance))
  lifecycle.track(subscribeVarEvents(() => phone.refreshHome()))

  openPhoneApp = (appId: string) => {
    if (!settings.showPhone) {
      transientPhoneOpen = true
      phoneVisible = true
      phone.setVisible(true)
    }
    phone.openApp(appId)
  }

  lifecycle.track(onOpenAppRequest((link) => {
    if (link.appId === 'gallery-manager') {
      collapsePhone()
      manager.open('phone')
      return
    }
    if (registry.get(link.appId)) {
      openPhoneApp(link.appId)
    }
  }))

  lifecycle.track(onStoryEvent((event) => {
    if (event.type === 'story-date-changed' || event.type === 'story-state-updated' || event.type === 'calendar-updated' || event.type === 'chronicle-updated') {
      phone.refreshHome()
    }
  }))

  function collapsePhone(): void {
    transientPhoneOpen = false
    settings = { ...settings, phone: { ...settings.phone, open: false } }
    adapter.saveSettings(settings)
    phoneVisible = settings.showPhone
    phone.setVisible(phoneVisible)
    phone.setState(settings.phone)
  }

  function expandPhone(): void {
    if (!settings.showPhone) transientPhoneOpen = true
    settings = { ...settings, phone: { ...settings.phone, open: true } }
    adapter.saveSettings(settings)
    phoneVisible = true
    phone.setVisible(true)
    phone.setState(settings.phone)
  }

  registerPhoneCommand(window.SillyTavern?.getContext(), {
    isOpen: () => phoneVisible && settings.phone.open,
    expand: expandPhone,
    collapse: collapsePhone,
    hasApp: id => !!registry.get(id),
    openApp: id => openPhoneApp(id),
  })

  const newvarRuntime = createNewvarRuntime({
    getSettings: () => settings,
    inject: (prompt, depth) => adapter.injectChannel(NEWVAR_CHANNEL, prompt, depth),
  })
  lifecycle.track(() => newvarRuntime.dispose())
  lifecycle.track(() => adapter.injectChannel(NEWVAR_CHANNEL, ''))

  const getRendererSettings = () => normalizeRendererSettings(settings.apps[RENDERER_APP_ID])
  const composerBridge = createComposerBridge()
  lifecycle.track(() => composerBridge.dispose())
  const choicePersistence = createChoicePersistence({
    getData: () => settings.apps[CARD_CHOICES_APP_ID],
    setData: data => saveSettingsOnly({ ...settings, apps: { ...settings.apps, [CARD_CHOICES_APP_ID]: data } }),
  })
  const rendererRuntime = createRendererRuntime({
    getSettings: getRendererSettings,
    factories: { gal: mountGalMode, cards: mountCardsMode, battle: mountBattleMode },
    getBlockDeps: (root, parsed, index) => ({ choiceMemory: choicePersistence.forBlock(root, parsed, index) }),
    modeDeps: {
      getSettings: getRendererSettings,
      resolvePortrait: (address) => {
        const packs = getActivePacks(settings, adapter.getCurrentCharacterName())
        return resolveSprite(packs, address)?.url ?? null
      },
      resolveSpeakerPortrait: (speaker) => {
        const normalizedSpeaker = speaker.trim()
        if (!normalizedSpeaker) return null
        const packs = getActivePacks(settings, adapter.getCurrentCharacterName())
        const pack = packs.find((candidate) => candidate.roleName?.trim() === normalizedSpeaker)
        return pack ? getPackCover(pack)?.url ?? null : null
      },
      insertDraft: composerBridge.insertDraft,
    },
  })
  lifecycle.track(() => rendererRuntime.dispose())

  const hudController = createHudController({
    getSettings: () => settings,
    saveSettingsOnly,
    newvarRuntime,
  })
  hudController.sync()
  onSettingsApplied = () => hudController.sync()
  lifecycle.track(() => {
    onSettingsApplied = null
    hudController.dispose()
  })

  const newvarDesigner = createNewvarDesigner({
    getData: () => newvarRuntime.getData(),
    setData: (next) => {
      saveSettingsOnly({ ...settings, apps: { ...settings.apps, [NEWVAR_APP_ID]: next } })
      newvarRuntime.onConfigChanged()
    },
    buildPreview: () => newvarRuntime.buildPreview(),
    getLastParse: () => newvarRuntime.getLastParse(),
    onClosed: () => openPhoneApp('newvar'),
  })
  lifecycle.track(() => newvarDesigner.close())

  const apiManager = createApiManager({
    getData: () => sanitizeAppData(settings.apps[API_APP_ID]),
    setData: (next) => {
      saveSettingsOnly({ ...settings, apps: { ...settings.apps, [API_APP_ID]: next } })
    },
    onClosed: () => openPhoneApp('api'),
  })
  lifecycle.track(() => apiManager.close())

  for (const app of createBuiltinApps({
    applyAppearance: data => phone.setAppearance(data),
    saveImage: dataUri => adapter.saveDataUri(dataUri),
    listApps: () => registry.list(),
    previewSpriteOpacity: (percent) => overlay.setOpacity(percent),
    openGalleryManager: () => {
      const restoreTransient = transientPhoneOpen
      collapsePhone()
      if (restoreTransient) transientPhoneOpen = true
      manager.open('phone')
    },
    newvarRuntime,
    openNewvarDesigner: () => {
      const restoreTransient = transientPhoneOpen
      collapsePhone()
      if (restoreTransient) transientPhoneOpen = true
      newvarDesigner.open()
    },
    openApiManager: () => {
      const restoreTransient = transientPhoneOpen
      collapsePhone()
      if (restoreTransient) transientPhoneOpen = true
      apiManager.open()
    },
    rendererRuntime,
  })) {
    registry.register(app)
    runAppSetup(app, createHostDeps(app.id), hostTracker)
  }

  const registerQueue = installRegisterQueue(window.stStageQueue, (app) => {
    registry.register(app)
    runAppSetup(app, createHostDeps(app.id), hostTracker)
  })
  window.stStageQueue = registerQueue
  window.stStage = {
    registerApp: (app) => registerQueue.push(app),
  }
  lifecycle.track(() => {
    delete window.stStage
    delete window.stStageQueue
  })

  lifecycle.track(adapter.onStreamText((text) => spriteRuntime.handleStreamText(text)))
  lifecycle.track(adapter.onGenerationEnded(() => spriteRuntime.resetStreamState()))

  lifecycle.track(adapter.onMessageReceived((text) => {
    appMessageHub.emit(text)
    spriteRuntime.handleFinalMessage(text)
  }))

  const storyCapture = createStoryImageCapture({
    getSettings: () => settings,
    updateSettings,
    getStoryContext: () => adapter.getStoryContext(),
    localize: (sprite, fileName, story) => localizeSprite(sprite, fileName, {
      fetch: window.fetch.bind(window),
      compress: compressImage,
      saveImage: (file, name) => adapter.saveImageFile(file, name, story.characterName),
    }),
  })

  lifecycle.track(mountMessagePostprocess({
    getSettings: () => settings,
    getRawMessage: (messageId) => adapter.getRawMessage(messageId),
    decorateImages: storyCapture.decorate,
    cleanupImages: storyCapture.cleanup,
    processMessage: rendererRuntime.processMessage,
    reprocessMessages: rendererRuntime.reprocessAll,
    cleanupMessages: rendererRuntime.dispose,
  }))

  let cancelPendingNavigation = () => {}
  const handleChatNavigation = () => {
    composerBridge.dispose()
    phone.refreshHome()
    appCharacterHub.emit(null)
    spriteRuntime.refresh()
    manager.refreshIfOpen()
    spriteRuntime.resetStreamState()
    cancelPendingNavigation()
    const timer = setTimeout(() => {
      cancelPendingNavigation()
      spriteRuntime.refresh()
      reprocessAllMessages(settings)
    }, 200)
    cancelPendingNavigation = lifecycle.track(() => clearTimeout(timer))
  }
  const unsubscribeCharacter = adapter.onCharacterChanged(handleChatNavigation)
  const unsubscribeChatCreated = adapter.onChatCreated(handleChatNavigation)
  lifecycle.track(() => {
    cancelPendingNavigation()
    unsubscribeCharacter()
    unsubscribeChatCreated()
  })

  lifecycle.track(mountSettingsPanel({
    getSettings: () => settings,
    updateSettings,
    subscribe: (fn) => {
      settingsListeners.add(fn)
      return () => settingsListeners.delete(fn)
    },
    openGalleryManager: () => manager.open('overlay'),
    expandPhoneTemporarily: expandPhone,
  }))

  spriteRuntime.refresh()
  newvarRuntime.start()
  phone.setState(settings.phone)
  phone.setVisible(settings.showPhone)
  phoneVisible = settings.showPhone
  const version =
    typeof __EXT_VERSION__ === 'undefined' ? 'dev' : `v${__EXT_VERSION__} · ${__BUILD_TIME__}`
  console.log(`[sprite-overlay] 百工（st-stage）已加载（含手机框架）${version}`)
}

const extensionLifecycle = beginExtensionLifecycle(window, document)
runWhenDomReady(document, extensionLifecycle, () => init(extensionLifecycle))
