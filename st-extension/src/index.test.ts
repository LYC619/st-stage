// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildActiveSpritePrompt } from '../../core/active-prompt'
import { createDefaultSettings } from '../../core/types'
import { NEWVAR_CHANNEL } from './apps/newvar/config'

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  injectPrompt: vi.fn(),
  injectChannel: vi.fn(),
  messageOff: vi.fn(),
  chatCreatedOff: vi.fn(),
  streamOff: vi.fn(),
  generationEndedOff: vi.fn(),
  characterOff: vi.fn(),
  messageHandler: undefined as ((text: string) => void) | undefined,
  chatCreatedHandler: undefined as (() => void) | undefined,
  streamHandler: undefined as ((text: string) => void) | undefined,
  generationEndedHandler: undefined as (() => void) | undefined,
  characterHandler: undefined as (() => void) | undefined,
  overlaySetVisible: vi.fn(),
  overlaySetSprites: vi.fn(),
  overlayDestroy: vi.fn(),
  managerDestroy: vi.fn(),
  phoneDestroy: vi.fn(),
  newvarRuntimeDispose: vi.fn(),
  rendererRuntimeDispose: vi.fn(),
  rendererProcessMessage: vi.fn(),
  rendererCreateDeps: undefined as Record<string, unknown> | undefined,
  postprocessDeps: undefined as Record<string, unknown> | undefined,
  builtinDeps: undefined as Record<string, unknown> | undefined,
  builtinApps: [] as Array<Record<string, unknown>>,
  probeHost: undefined as { setAppData: (data: unknown) => void } | undefined,
  designerClose: vi.fn(),
  apiClose: vi.fn(),
  panelCleanup: vi.fn(),
  postprocessCleanup: vi.fn(),
  reprocess: vi.fn(),
  overlayCreates: 0,
  currentCharacterName: '',
}))

vi.mock('./st-adapter', () => ({
  STAdapter: class {
    loadSettings = mocks.loadSettings
    saveSettings = vi.fn()
    injectPrompt = mocks.injectPrompt
    injectChannel = mocks.injectChannel
    getCurrentCharacterName = () => mocks.currentCharacterName
    onMessageReceived = (handler: (text: string) => void) => {
      mocks.messageHandler = handler
      return mocks.messageOff
    }
    onChatCreated = (handler: () => void) => {
      mocks.chatCreatedHandler = handler
      return mocks.chatCreatedOff
    }
    onStreamText = (handler: (text: string) => void) => {
      mocks.streamHandler = handler
      return mocks.streamOff
    }
    onGenerationEnded = (handler: () => void) => {
      mocks.generationEndedHandler = handler
      return mocks.generationEndedOff
    }
    onCharacterChanged = (handler: () => void) => {
      mocks.characterHandler = handler
      return mocks.characterOff
    }
  },
}))
vi.mock('./overlay-dom', () => ({
  createOverlay: () => {
    mocks.overlayCreates++
    return {
      setAutoSwitch: vi.fn(), setLayout: vi.fn(), setVisible: mocks.overlaySetVisible,
      setImage: vi.fn(), setSprites: mocks.overlaySetSprites, setPlaceholder: vi.fn(),
      setOpacity: vi.fn(),
      destroy: mocks.overlayDestroy,
    }
  },
}))
vi.mock('./sprite-manager', () => ({
  createSpriteManager: () => ({
    open: vi.fn(), close: vi.fn(), refreshIfOpen: vi.fn(), destroy: mocks.managerDestroy,
  }),
}))
vi.mock('../../core/phone-shell', () => ({
  createPhoneShell: () => ({
    setState: vi.fn(), openApp: vi.fn(), setVisible: vi.fn(), destroy: mocks.phoneDestroy,
  }),
}))
vi.mock('./apps', () => ({
  createBuiltinApps: (deps: Record<string, unknown>) => {
    mocks.builtinDeps = deps
    return mocks.builtinApps
  },
}))
vi.mock('./apps/newvar/runtime', () => ({
  createNewvarRuntime: () => ({
    start: vi.fn(), dispose: mocks.newvarRuntimeDispose, getData: vi.fn(),
    buildPreview: vi.fn(), getLastParse: vi.fn(), onConfigChanged: vi.fn(),
  }),
}))
vi.mock('./apps/renderer/runtime', () => ({
  createRendererRuntime: (deps: Record<string, unknown>) => {
    mocks.rendererCreateDeps = deps
    return {
      processMessage: mocks.rendererProcessMessage,
      reprocessAll: vi.fn(),
      dispose: mocks.rendererRuntimeDispose,
    }
  },
}))
vi.mock('./apps/newvar/designer', () => ({
  createNewvarDesigner: () => ({ open: vi.fn(), close: mocks.designerClose, isOpen: () => false }),
}))
vi.mock('./apps/api/manager', () => ({
  createApiManager: () => ({ open: vi.fn(), close: mocks.apiClose, isOpen: () => false }),
}))
vi.mock('./settings-panel', () => ({ mountSettingsPanel: () => mocks.panelCleanup }))
vi.mock('./message-postprocess', () => ({
  mountMessagePostprocess: (deps: Record<string, unknown>) => {
    mocks.postprocessDeps = deps
    return mocks.postprocessCleanup
  },
  reprocessAllMessages: mocks.reprocess,
}))

async function flushInit(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

async function importEntry(suffix: string): Promise<void> {
  await import(/* @vite-ignore */ `./index?${suffix}`)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' })
  document.body.innerHTML = '<div id="extensions_settings"></div>'
  delete window.__stStageDispose
  delete window.stStage
  delete window.stStageQueue
  Object.assign(mocks, {
    characterHandler: undefined,
    messageHandler: undefined,
    chatCreatedHandler: undefined,
    streamHandler: undefined,
    generationEndedHandler: undefined,
    overlayCreates: 0,
    currentCharacterName: '',
    postprocessDeps: undefined,
    builtinDeps: undefined,
    builtinApps: [],
    probeHost: undefined,
    rendererCreateDeps: undefined,
  })
  Object.values(mocks).forEach((value) => {
    if (typeof value === 'function' && 'mockClear' in value) value.mockClear()
  })
  mocks.loadSettings.mockResolvedValue(createDefaultSettings())
})

afterEach(() => {
  window.__stStageDispose?.()
  vi.useRealTimers()
})

describe('extension entry lifecycle', () => {
  it('新变量显示开关变化时立即重处理已有楼层', async () => {
    mocks.builtinApps = [{
      id: NEWVAR_CHANNEL,
      name: '测试新变量',
      icon: 'V',
      mount: vi.fn(),
      setup: (host: { setAppData: (data: unknown) => void }) => { mocks.probeHost = host },
    }]
    await importEntry('newvar-display-setting')
    await flushInit()
    mocks.reprocess.mockClear()

    mocks.probeHost?.setAppData({ enabled: true, hideUpdateBlocks: true })
    expect(mocks.reprocess).toHaveBeenCalledTimes(1)

    mocks.probeHost?.setAppData({ enabled: true, hideUpdateBlocks: false })
    expect(mocks.reprocess).toHaveBeenCalledTimes(2)
  })

  it('切换聊天和新建聊天都会立即刷新，并在 DOM 稳定后再次自愈', async () => {
    await importEntry('navigation-self-heal')
    await flushInit()
    mocks.injectPrompt.mockClear()
    mocks.reprocess.mockClear()

    mocks.characterHandler?.()
    expect(mocks.injectPrompt).toHaveBeenCalledTimes(1)
    expect(mocks.reprocess).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(mocks.injectPrompt).toHaveBeenCalledTimes(2)
    expect(mocks.reprocess).toHaveBeenCalledTimes(1)

    mocks.injectPrompt.mockClear()
    mocks.reprocess.mockClear()
    mocks.chatCreatedHandler?.()
    expect(mocks.injectPrompt).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(200)
    expect(mocks.injectPrompt).toHaveBeenCalledTimes(2)
    expect(mocks.reprocess).toHaveBeenCalledTimes(1)
  })

  it('流式阶段只消费新增的完整立绘标签，最终消息作为权威结果', async () => {
    const settings = createDefaultSettings()
    settings.packs = [{
      id: 'p1', name: '测试包', sprites: [
        { tag: '微笑', url: '/smile.png' },
        { tag: '哭泣', url: '/cry.png' },
      ],
    }]
    settings.bindings = [{ characterName: '小雪', packIds: ['p1'], enabled: true }]
    mocks.currentCharacterName = '小雪'
    mocks.loadSettings.mockResolvedValueOnce(settings)
    await importEntry('streaming-sprites')
    await flushInit()
    mocks.overlaySetSprites.mockClear()

    mocks.streamHandler?.('第一段 [立绘:微笑')
    expect(mocks.overlaySetSprites).not.toHaveBeenCalled()
    mocks.streamHandler?.('第一段 [立绘:微笑]')
    expect(mocks.overlaySetSprites).toHaveBeenCalledTimes(1)
    expect(mocks.overlaySetSprites.mock.calls[0][0]).toEqual([
      expect.objectContaining({ tag: '微笑', url: '/smile.png' }),
    ])
    mocks.streamHandler?.('第一段 [立绘:微笑]')
    expect(mocks.overlaySetSprites).toHaveBeenCalledTimes(1)
    mocks.streamHandler?.('第一段 [立绘:微笑]\n第二段 [立绘:哭泣]')
    expect(mocks.overlaySetSprites).toHaveBeenCalledTimes(2)
    expect(mocks.overlaySetSprites.mock.calls[1][0]).toEqual([
      expect.objectContaining({ tag: '哭泣', url: '/cry.png' }),
    ])

    mocks.messageHandler?.('最终正文 [立绘:哭泣]')
    expect(mocks.overlaySetSprites).toHaveBeenCalledTimes(3)
    expect(mocks.overlaySetSprites.mock.calls[2][0]).toEqual([
      expect.objectContaining({ tag: '哭泣', url: '/cry.png' }),
    ])
    mocks.generationEndedHandler?.()
    mocks.streamHandler?.('新回复 [立绘:微笑]')
    expect(mocks.overlaySetSprites).toHaveBeenCalledTimes(4)
  })

  it('把 Renderer runtime 接到消息后处理入口', async () => {
    await importEntry('renderer-postprocess')
    await flushInit()

    expect(mocks.postprocessDeps?.processMessage).toBe(mocks.rendererProcessMessage)
    expect(mocks.postprocessDeps?.cleanupMessages).toBe(mocks.rendererRuntimeDispose)
    expect(mocks.builtinDeps?.rendererRuntime).toEqual(expect.objectContaining({
      processMessage: mocks.rendererProcessMessage,
      dispose: mocks.rendererRuntimeDispose,
    }))
    expect((mocks.rendererCreateDeps?.factories as Record<string, unknown>)?.gal).toEqual(expect.any(Function))
    expect((mocks.rendererCreateDeps?.factories as Record<string, unknown>)?.cards).toEqual(expect.any(Function))
    expect((mocks.rendererCreateDeps?.factories as Record<string, unknown>)?.battle).toEqual(expect.any(Function))
    expect((mocks.rendererCreateDeps?.modeDeps as Record<string, unknown>)?.resolvePortrait).toEqual(expect.any(Function))
    expect((mocks.rendererCreateDeps?.modeDeps as Record<string, unknown>)?.insertDraft).toEqual(expect.any(Function))
  })

  it('injects effective-scene notes from active packs in binding order only', async () => {
    const settings = createDefaultSettings()
    settings.packs = [
      {
        id: 'a',
        name: 'A 包',
        roleName: '角色A',
        promptNote: 'A包后置备注',
        outfitNotes: { 礼服: 'A礼服备注' },
        sprites: [{ tag: '微笑', url: '/a.png', outfit: '礼服' }],
      },
      {
        id: 'b',
        name: 'B 包',
        roleName: '角色B',
        promptNote: 'B包前置备注',
        promptNotePlacement: 'before-list',
        sprites: [{ tag: '冷漠', url: '/b.png', group: '角色B覆盖' }],
      },
      {
        id: 'inactive',
        name: '未启用包',
        promptNote: '绝不能出现的未启用备注',
        sprites: [{ tag: '隐藏', url: '/inactive.png' }],
      },
    ]
    settings.bindings = [{ characterName: '当前角色', packIds: ['b', 'a'], enabled: true }]
    mocks.currentCharacterName = '当前角色'
    mocks.loadSettings.mockResolvedValueOnce(settings)

    await importEntry('active-pack-notes')
    await flushInit()

    const prompt = mocks.injectPrompt.mock.calls.at(-1)?.[0] as string
    expect(prompt).toBe(buildActiveSpritePrompt(settings, '当前角色'))
    const bScene = prompt.indexOf('- 角色B覆盖：冷漠')
    const aScene = prompt.indexOf('- 角色A/礼服：微笑')
    const bPackNote = prompt.indexOf('B包前置备注')
    const aPackNote = prompt.indexOf('A包后置备注')
    const aOutfitNote = prompt.indexOf('A礼服备注')
    expect(bScene).toBeGreaterThan(-1)
    expect(aScene).toBeGreaterThan(bScene)
    expect(bPackNote).toBeGreaterThan(-1)
    expect(bPackNote).toBeLessThan(bScene)
    expect(prompt.match(/B包前置备注/g)).toHaveLength(1)
    expect(aPackNote).toBeGreaterThan(-1)
    expect(aPackNote).toBeGreaterThan(aScene)
    expect(prompt.match(/A包后置备注/g)).toHaveLength(1)
    expect(aOutfitNote).toBeGreaterThan(-1)
    expect(aOutfitNote).toBeLessThan(aPackNote)
    expect(prompt.match(/A礼服备注/g)).toHaveLength(1)
    expect(prompt).not.toContain('绝不能出现的未启用备注')
  })

  it('disposes all first-instance resources at second bundle evaluation even before DOM ready', async () => {
    await importEntry('first')
    await flushInit()
    mocks.characterHandler?.()

    Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' })
    await importEntry('second')

    expect(mocks.messageOff).toHaveBeenCalledTimes(1)
    expect(mocks.chatCreatedOff).toHaveBeenCalledTimes(1)
    expect(mocks.streamOff).toHaveBeenCalledTimes(1)
    expect(mocks.generationEndedOff).toHaveBeenCalledTimes(1)
    expect(mocks.characterOff).toHaveBeenCalledTimes(1)
    expect(mocks.postprocessCleanup).toHaveBeenCalledTimes(1)
    expect(mocks.overlayDestroy).toHaveBeenCalledTimes(1)
    expect(mocks.managerDestroy).toHaveBeenCalledTimes(1)
    expect(mocks.phoneDestroy).toHaveBeenCalledTimes(1)
    expect(mocks.newvarRuntimeDispose).toHaveBeenCalledTimes(1)
    expect(mocks.rendererRuntimeDispose).toHaveBeenCalledTimes(1)
    expect(mocks.designerClose).toHaveBeenCalledTimes(1)
    expect(mocks.apiClose).toHaveBeenCalledTimes(1)
    expect(mocks.panelCleanup).toHaveBeenCalledTimes(1)
    expect(mocks.injectPrompt).toHaveBeenCalledWith('')
    expect(mocks.injectChannel).toHaveBeenCalledWith(NEWVAR_CHANNEL, '')
    expect(window.stStage).toBeUndefined()

    vi.advanceTimersByTime(200)
    expect(mocks.reprocess).not.toHaveBeenCalled()
  })

  it('does not install resources when async settings finish after lifecycle disposal', async () => {
    let release!: (settings: ReturnType<typeof createDefaultSettings>) => void
    mocks.loadSettings.mockReturnValueOnce(new Promise((resolve) => { release = resolve }))

    await importEntry('stale')
    window.__stStageDispose?.()
    release(createDefaultSettings())
    await flushInit()

    expect(mocks.overlayCreates).toBe(0)
  })
})
