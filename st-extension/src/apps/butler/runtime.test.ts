// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createButlerAppServices } from './runtime'

function installST() {
  const powerUserSettings = {
    fast_ui_mode: false,
    reduced_motion: false,
    noShadows: false,
    smooth_streaming: true,
    stream_fade_in: true,
    streaming_fps: 30,
    chat_truncation: 100,
  }
  Object.defineProperty(window, 'SillyTavern', {
    configurable: true,
    value: {
      getContext: () => ({
        powerUserSettings,
        isMobile: () => false,
        extensionSettings: { disabledExtensions: [], quickReply: { config: { setList: [] } } },
      }),
    },
  })
}

function bridge() {
  return {
    readPageSummary: vi.fn(() => ({
      chat: { available: true as const, value: { chatKey: 'chat-a', messageCount: 12, userMessageCount: 6, assistantMessageCount: 6 } },
      dom: { available: true as const, value: { renderedMessageCount: 12, chatNodeCount: 24 } },
    })),
    readExtensions: vi.fn(async () => ({
      status: 'ready' as const,
      governance: { writable: true },
      disabledExtensions: [],
      extensions: [],
    })),
    setExtensionEnabled: vi.fn(),
  }
}

beforeEach(() => {
  document.body.innerHTML = '<span id="version_display">SillyTavern 1.18.0</span><div id="chat"></div>'
  installST()
})

afterEach(() => {
  Reflect.deleteProperty(window, 'SillyTavern')
  vi.restoreAllMocks()
})

describe('Butler production service assembly', () => {
  it('falls back to in-memory storage when browser storage is inaccessible', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage is disabled', 'SecurityError')
      },
    })

    try {
      const services = createButlerAppServices({ bridge: bridge() as never })
      expect(() => services.backupStorage.setItem('recovery', 'value')).not.toThrow()
      expect(services.backupStorage.getItem('recovery')).toBeNull()
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor)
      else Reflect.deleteProperty(window, 'localStorage')
    }
  })

  it('contains storage method failures instead of interrupting extension recovery', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    const blockedStorage = {
      getItem: vi.fn(() => { throw new DOMException('Read blocked', 'SecurityError') }),
      setItem: vi.fn(() => { throw new DOMException('Write blocked', 'QuotaExceededError') }),
      removeItem: vi.fn(() => { throw new DOMException('Delete blocked', 'SecurityError') }),
    }
    Object.defineProperty(window, 'localStorage', { configurable: true, value: blockedStorage })

    try {
      const services = createButlerAppServices({ bridge: bridge() as never })
      expect(services.backupStorage.getItem('recovery')).toBeNull()
      expect(() => services.backupStorage.setItem('recovery', 'value')).not.toThrow()
      expect(() => services.backupStorage.removeItem('recovery')).not.toThrow()
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor)
      else Reflect.deleteProperty(window, 'localStorage')
    }
  })

  it('loads the official generation contract once before dynamic probes', async () => {
    const loadScriptModule = vi.fn(async () => ({ isGenerating: () => false }))
    const runTimeline = vi.fn(async (_duration, _signal, handlers) => {
      expect(loadScriptModule).toHaveBeenCalledOnce()
      handlers.onFrame(16)
    })
    const services = createButlerAppServices({
      bridge: bridge() as never,
      loadScriptModule,
      runTimeline,
      createId: () => 'measurement-id',
      now: () => 1_000,
    })

    const first = await services.sampleIdle()
    const second = await services.sampleIdle()

    expect(first.invalidReason).toBeUndefined()
    expect(second.invalidReason).toBeUndefined()
    expect(loadScriptModule).toHaveBeenCalledTimes(1)
    expect(loadScriptModule).toHaveBeenCalledWith('/script.js')
  })

  it('marks probes invalid when script.js does not expose isGenerating and retries on the next probe', async () => {
    const loadScriptModule = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ isGenerating: () => false })
    const runTimeline = vi.fn(async (_duration, _signal, handlers) => handlers.onFrame(16))
    const services = createButlerAppServices({
      bridge: bridge() as never,
      loadScriptModule,
      runTimeline,
      createId: () => 'measurement-id',
      now: () => 1_000,
    })

    const unavailable = await services.sampleIdle()
    const recovered = await services.sampleIdle()

    expect(unavailable.invalidReason).toContain('无法读取生成状态')
    expect(recovered.invalidReason).toBeUndefined()
    expect(loadScriptModule).toHaveBeenCalledTimes(2)
    expect(runTimeline).toHaveBeenCalledOnce()
  })

  it('flushes SillyTavern settings before an experiment reload', async () => {
    const order: string[] = []
    const saveSettings = vi.fn(async () => { order.push('save') })
    const reloadNow = vi.fn(() => { order.push('reload') })
    const services = createButlerAppServices({
      bridge: bridge() as never,
      loadScriptModule: vi.fn(async () => ({ isGenerating: () => false, saveSettings })),
      reloadNow,
    })

    await services.reloadPage()

    expect(saveSettings).toHaveBeenCalledOnce()
    expect(reloadNow).toHaveBeenCalledOnce()
    expect(order).toEqual(['save', 'reload'])
  })
})
