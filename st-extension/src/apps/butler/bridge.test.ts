// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createButlerBridge,
  groupResourceTimings,
  readHealthState,
  readMobileState,
  readPerf,
  readPerfState,
  type PerfCapabilities,
  type PerfSnapshot,
} from './bridge'
import {
  BUTLER_PROBE_DURATION_MS,
  createMetricsSampler,
  runProbeTimeline,
  type ButlerMetricsDependencies,
  type ProbeTimelineHandlers,
} from './metrics'
import { createButlerAppServices } from './runtime'
import type { MeasurementEnvironment } from './types'

const completePerf: PerfSnapshot = {
  fast_ui_mode: true,
  reduced_motion: false,
  noShadows: false,
  smooth_streaming: true,
  stream_fade_in: true,
  streaming_fps: 30,
  chat_truncation: 100,
}

function installST(context: Record<string, unknown>): void {
  Object.defineProperty(window, 'SillyTavern', {
    configurable: true,
    value: { getContext: () => context },
  })
}

function extensionModule(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const manifests: Record<string, unknown> = {
    expressions: { display_name: 'Expressions', dependencies: [] },
    'third-party/st-stage': { display_name: 'ST Stage', dependencies: ['expressions'] },
    'third-party/tool': { display_name: 'Tool', dependencies: ['third-party/st-stage'] },
  }
  const disabledExtensions = ['third-party/tool']
  return {
    extensionNames: ['expressions', 'third-party/st-stage', 'third-party/tool'],
    extensionTypes: { expressions: 'system', 'third-party/st-stage': 'local', 'third-party/tool': 'global' },
    extension_settings: { disabledExtensions, apiKey: 'private-key' },
    findExtension: vi.fn((name: string) => {
      const fullName = name === 'st-stage' ? 'third-party/st-stage' : name
      return manifests[fullName] ? { name: fullName, enabled: !disabledExtensions.includes(fullName) } : null
    }),
    getExtensionManifest: vi.fn((name: string) => manifests[name] ?? null),
    enableExtension: vi.fn(async () => undefined),
    disableExtension: vi.fn(async () => undefined),
    ...overrides,
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'SillyTavern')
})

describe('Butler host bridge & Resource Timing privacy', () => {
  it('reads performance/mobile/health capabilities strictly and hashes chat identity without leaking text', () => {
    installST({ powerUserSettings: { ...completePerf } })
    expect(readPerf()).toEqual(completePerf)

    const { streaming_fps: _omit, ...partial } = completePerf
    installST({ powerUserSettings: partial, isMobile: () => 'bad', extensionSettings: { disabledExtensions: 'bad' } })
    expect(readPerfState().status).toBe('partial')
    expect(readPerf()).toBeNull()
    expect(readMobileState().available).toBe(false)
    expect(readHealthState().disabledExtensions.available).toBe(false)

    installST({
      chatId: '私密聊天名称',
      characterId: 4,
      chat: [{ mes: 'secret prompt text', is_user: true }, { mes: 'reply', is_user: false }],
      isMobile: () => true,
      extensionSettings: { disabledExtensions: ['third-party/a'], quickReply: { config: { setList: [{}] } } },
    })
    document.body.innerHTML = '<div id="chat"><div class="mes"><div class="mes_text">secret dom</div></div></div>'
    const summary = createButlerBridge().readPageSummary()
    expect(summary.chat.available && summary.chat.value.chatKey).toMatch(/^chat:[0-9a-f]{16}$/)
    expect(JSON.stringify(summary)).not.toMatch(/私密|secret/)
    expect(readMobileState()).toEqual({ available: true, value: true })
    expect(readHealthState()).toEqual({
      disabledExtensions: { available: true, value: 1 },
      quickReplySets: { available: true, value: 1 },
    })
  })

  it('groups Resource Timing entries without query/domain leaks and governs extensions safely', async () => {
    const grouped = groupResourceTimings([
      { name: 'https://host/scripts/extensions/third-party/tool/index.js?v=secret', initiatorType: 'script', transferSize: 120, duration: 8 },
      { name: 'https://cdn.example/private/avatar.png?token=private', initiatorType: 'img', transferSize: 50, duration: 5 },
      { name: 'not a valid URL', initiatorType: 'script', transferSize: -1, duration: Number.NaN },
    ])
    expect(grouped).toEqual([
      { key: 'extension:third-party/tool', count: 1, transferSize: 120, durationMs: 8 },
      { key: 'resource:image', count: 1, transferSize: 50, durationMs: 5 },
    ])
    expect(JSON.stringify(grouped)).not.toMatch(/secret|private|avatar|cdn\.example/)

    const mod = extensionModule()
    const bridge = createButlerBridge({ loadModule: async () => mod })
    const inv = await bridge.readExtensions()
    expect(inv.status).toBe('ready')
    expect(JSON.stringify(inv)).not.toContain('private-key')

    await expect(bridge.setExtensionEnabled('st-stage', false)).resolves.toMatchObject({ ok: false, code: 'protected' })
    expect(mod.disableExtension).not.toHaveBeenCalled()

    await expect(bridge.setExtensionEnabled('third-party/tool', true)).resolves.toMatchObject({ ok: true, configuredEnabled: true })
    expect(mod.enableExtension).toHaveBeenCalledWith('third-party/tool', false)

    const readOnlyBridge = createButlerBridge({ loadModule: async () => extensionModule({ enableExtension: undefined }) })
    await expect(readOnlyBridge.setExtensionEnabled('third-party/tool', false)).resolves.toMatchObject({ ok: false, code: 'read-only' })
  })
})

describe('Butler metrics probes & production runtime assembly', () => {
  const env: MeasurementEnvironment = {
    stVersion: { available: true, value: '1.18.0' },
    stageBuild: { available: true, value: '0.9.0+test' },
    mobile: { available: true, value: true },
    settingsSummary: { available: true, value: { streaming_fps: 15 } },
    disabledExtensionsHash: { available: true, value: 'hash' },
  }

  function metricsDeps(): ButlerMetricsDependencies {
    const chat = document.createElement('div')
    chat.id = 'chat'
    Object.defineProperties(chat, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 420 },
      scrollTop: { configurable: true, writable: true, value: 35 },
    })
    chat.innerHTML = '<div class="mes"><img><video></video></div><canvas></canvas><iframe></iframe>'
    document.body.replaceChildren(chat)
    const caps = Object.fromEntries(Object.keys(completePerf).map((k) => [k, { available: true }])) as PerfCapabilities
    return {
      now: vi.fn(() => 1000),
      createId: vi.fn(() => 'sample-1'),
      readEnvironment: vi.fn(async () => env),
      readPageSummary: vi.fn(() => ({
        chat: { available: true as const, value: { chatKey: 'chat-a', messageCount: 20, userMessageCount: 9, assistantMessageCount: 11 } },
        dom: { available: true as const, value: { renderedMessageCount: 10, chatNodeCount: 80 } },
      })),
      readPerfState: vi.fn(() => ({ status: 'ready' as const, snapshot: completePerf, capabilities: caps })),
      readResourceGroups: vi.fn(() => [{ key: 'resource:image', count: 1, transferSize: 500, durationMs: 8 }]),
      estimateStorage: vi.fn<ButlerMetricsDependencies['estimateStorage']>(async () => ({ usage: 1024, quota: 4096 })),
      readHeapBytes: vi.fn<ButlerMetricsDependencies['readHeapBytes']>(() => 2048),
      getChatScroller: vi.fn(() => chat),
      getViewport: vi.fn(() => ({ width: 390, height: 800 })),
      countAnimations: vi.fn<ButlerMetricsDependencies['countAnimations']>(() => 3),
      isForeground: vi.fn(() => true),
      isGenerating: vi.fn(() => false),
      observeLongTasks: vi.fn<ButlerMetricsDependencies['observeLongTasks']>(() => ({ disconnect: vi.fn() })),
      runTimeline: vi.fn(async (_dur: number, _sig: AbortSignal, h: ProbeTimelineHandlers) => {
        for (const t of [0, 16, 34, 96]) h.onFrame(t)
        h.onTimer(100, 108)
        h.onTimer(200, 225)
      }),
    }
  }

  it('samples static/idle/scroll probes, restores scrollTop, invalidates on interference, and cleans up aborted rAF/timers', async () => {
    const deps = metricsDeps()
    const disconnect = vi.fn()
    deps.observeLongTasks = vi.fn((rec) => { rec(60); rec(90); return { disconnect } })
    const sampler = createMetricsSampler(deps)

    const stat = await sampler.collectStatic()
    expect(stat.metrics).toMatchObject({ page: { chatNodeCount: 80 }, storage: { usageBytes: 1024 } })

    const idle = await sampler.sampleIdle()
    expect(deps.runTimeline).toHaveBeenCalledWith(BUTLER_PROBE_DURATION_MS, expect.any(AbortSignal), expect.any(Object))
    expect(idle.metrics.dynamic).toMatchObject({ longTaskCount: 2, longestTaskMs: 90, frameIntervalP95Ms: 62 })
    expect(disconnect).toHaveBeenCalledOnce()

    const scroll = await sampler.sampleControlledScroll()
    expect(scroll.invalidReason).toBeUndefined()
    expect(deps.getChatScroller()!.scrollTop).toBe(35)

    deps.isGenerating = vi.fn(() => true)
    expect((await createMetricsSampler(deps).sampleIdle()).invalidReason).toContain('当前正在生成')
    expect((await createMetricsSampler(deps).sampleControlledScroll()).invalidReason).toContain('生成状态发生变化')
    expect(deps.getChatScroller()!.scrollTop).toBe(35)

    const inputDeps = metricsDeps()
    inputDeps.runTimeline = vi.fn(async (_d, _s, h) => { document.dispatchEvent(new Event('pointerdown')); h.onFrame(16) })
    expect((await createMetricsSampler(inputDeps).sampleIdle()).invalidReason).toContain('用户干预')

    vi.useFakeTimers()
    const controller = new AbortController()
    const cancelFrame = vi.fn()
    const p = runProbeTimeline(6000, controller.signal, { onFrame: vi.fn(), onTimer: vi.fn() }, {
      now: () => Date.now(), requestFrame: () => 1, cancelFrame,
      setTimer: (fn, ms) => window.setTimeout(fn, ms), clearTimer: (id) => window.clearTimeout(id),
    })
    controller.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    expect(cancelFrame).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('contains blocked localStorage, caches /script.js generation checks once recovered, and flushes settings before reload', async () => {
    installST({
      powerUserSettings: { ...completePerf },
      isMobile: () => false,
      extensionSettings: { disabledExtensions: [], quickReply: { config: { setList: [] } } },
    })
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Disabled', 'SecurityError') },
    })
    try {
      const order: string[] = []
      const loadScriptModule = vi.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValue({ isGenerating: () => false, saveSettings: async () => { order.push('save') } })
      const services = createButlerAppServices({
        bridge: createButlerBridge(),
        loadScriptModule,
        runTimeline: async (_d, _s, h) => h.onFrame(16),
        reloadNow: () => { order.push('reload') },
      })

      expect(() => services.backupStorage.setItem('k', 'v')).not.toThrow()
      expect((await services.sampleIdle()).invalidReason).toContain('无法读取生成状态')
      expect((await services.sampleIdle()).invalidReason).toBeUndefined()
      expect((await services.sampleIdle()).invalidReason).toBeUndefined()
      expect(loadScriptModule).toHaveBeenCalledTimes(2)

      await services.reloadPage()
      expect(order).toEqual(['save', 'reload'])
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor)
      else Reflect.deleteProperty(window, 'localStorage')
    }
  })
})
