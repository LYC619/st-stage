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
  runtimeDispose: vi.fn(),
  designerClose: vi.fn(),
  apiClose: vi.fn(),
  panelCleanup: vi.fn(),
  postprocessCleanup: vi.fn(),
  reprocess: vi.fn(),
  overlayCreates: 0,
}))

vi.mock('./st-adapter', () => ({
  STAdapter: class {
    loadSettings = mocks.loadSettings
    saveSettings = vi.fn()
    injectPrompt = mocks.injectPrompt
    injectChannel = mocks.injectChannel
    getCurrentCharacterName = () => ''
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
vi.mock('./apps', () => ({ createBuiltinApps: () => [] }))
vi.mock('./apps/newvar/runtime', () => ({
  createNewvarRuntime: () => ({
    start: vi.fn(), dispose: mocks.runtimeDispose, getData: vi.fn(),
    buildPreview: vi.fn(), getLastParse: vi.fn(), onConfigChanged: vi.fn(),
  }),
}))
vi.mock('./apps/newvar/designer', () => ({
  createNewvarDesigner: () => ({ open: vi.fn(), close: mocks.designerClose, isOpen: () => false }),
}))
vi.mock('./apps/api/manager', () => ({
  createApiManager: () => ({ open: vi.fn(), close: mocks.apiClose, isOpen: () => false }),
}))
vi.mock('./settings-panel', () => ({ mountSettingsPanel: () => mocks.panelCleanup }))
vi.mock('./message-postprocess', () => ({
  mountMessagePostprocess: () => mocks.postprocessCleanup,
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
  Object.assign(mocks, { characterHandler: undefined, overlayCreates: 0 })
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
    expect(mocks.runtimeDispose).toHaveBeenCalledTimes(1)
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
