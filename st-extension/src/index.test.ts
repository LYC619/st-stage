// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultSettings } from '../../core/types'
import { NEWVAR_CHANNEL } from './apps/newvar/config'

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  injectPrompt: vi.fn(),
  injectChannel: vi.fn(),
  messageOff: vi.fn(),
  characterOff: vi.fn(),
  characterHandler: undefined as (() => void) | undefined,
  overlayDestroy: vi.fn(),
  managerDestroy: vi.fn(),
  phoneDestroy: vi.fn(),
  newvarRuntimeDispose: vi.fn(),
  rendererRuntimeDispose: vi.fn(),
  rendererProcessMessage: vi.fn(),
  rendererCreateDeps: undefined as Record<string, unknown> | undefined,
  postprocessDeps: undefined as Record<string, unknown> | undefined,
  builtinDeps: undefined as Record<string, unknown> | undefined,
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
    onMessageReceived = () => mocks.messageOff
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
      setAutoSwitch: vi.fn(), setLayout: vi.fn(), setVisible: vi.fn(),
      setImage: vi.fn(), setSprites: vi.fn(), setPlaceholder: vi.fn(),
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
    return []
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
    overlayCreates: 0,
    currentCharacterName: '',
    postprocessDeps: undefined,
    builtinDeps: undefined,
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
