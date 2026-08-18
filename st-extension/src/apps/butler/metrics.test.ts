// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import type { MeasurementEnvironment } from './types'
import {
  BUTLER_PROBE_DURATION_MS,
  createMetricsSampler,
  runProbeTimeline,
  type ButlerMetricsDependencies,
  type ProbeTimelineHandlers,
} from './metrics'
import type { PerfCapabilities } from './bridge'

const environment: MeasurementEnvironment = {
  stVersion: { available: true, value: '1.18.0' },
  stageBuild: { available: true, value: '0.9.0+test' },
  mobile: { available: true, value: true },
  settingsSummary: { available: true, value: { streaming_fps: 15 } },
  disabledExtensionsHash: { available: true, value: 'hash' },
}

function baseDeps(): ButlerMetricsDependencies {
  const chat = document.createElement('div')
  chat.id = 'chat'
  Object.defineProperties(chat, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 420 },
    scrollTop: { configurable: true, writable: true, value: 35 },
  })
  chat.innerHTML = '<div class="mes"><img><video></video></div><canvas></canvas><iframe></iframe>'
  document.body.replaceChildren(chat)
  const perfCapabilities = Object.fromEntries([
    'fast_ui_mode',
    'reduced_motion',
    'noShadows',
    'smooth_streaming',
    'stream_fade_in',
    'streaming_fps',
    'chat_truncation',
  ].map((key) => [key, { available: true }])) as PerfCapabilities
  return {
    now: vi.fn(() => 1000),
    createId: vi.fn(() => 'sample-1'),
    readEnvironment: vi.fn(async () => environment),
    readPageSummary: vi.fn(() => ({
      chat: { available: true as const, value: { chatKey: 'chat-a', messageCount: 20, userMessageCount: 9, assistantMessageCount: 11 } },
      dom: { available: true as const, value: { renderedMessageCount: 10, chatNodeCount: 80 } },
    })),
    readPerfState: vi.fn(() => ({
      status: 'ready' as const,
      snapshot: { fast_ui_mode: false, reduced_motion: false, noShadows: false, smooth_streaming: true, stream_fade_in: true, streaming_fps: 30, chat_truncation: 0 },
      capabilities: perfCapabilities,
    })),
    readResourceGroups: vi.fn(() => [
      { key: 'extension:third-party/demo', count: 2, transferSize: 1200, durationMs: 40 },
      { key: 'resource:image', count: 1, transferSize: 500, durationMs: 8 },
    ]),
    estimateStorage: vi.fn<ButlerMetricsDependencies['estimateStorage']>(async () => ({ usage: 1024, quota: 4096 })),
    readHeapBytes: vi.fn<ButlerMetricsDependencies['readHeapBytes']>(() => 2048),
    getChatScroller: vi.fn(() => chat),
    getViewport: vi.fn(() => ({ width: 390, height: 800 })),
    countAnimations: vi.fn<ButlerMetricsDependencies['countAnimations']>(() => 3),
    isForeground: vi.fn(() => true),
    isGenerating: vi.fn(() => false),
    observeLongTasks: vi.fn<ButlerMetricsDependencies['observeLongTasks']>(() => ({ disconnect: vi.fn() })),
    runTimeline: vi.fn(async (_duration: number, _signal: AbortSignal, handlers: ProbeTimelineHandlers) => {
      for (const time of [0, 16, 34, 96]) handlers.onFrame(time)
      handlers.onTimer(100, 108)
      handlers.onTimer(200, 225)
    }),
  }
}

describe('Butler metrics static evidence', () => {
  it('collects DOM/media/resource/storage summaries without persisting raw URL details', async () => {
    const deps = baseDeps()
    const snapshot = await createMetricsSampler(deps).collectStatic()

    expect(snapshot.probe).toBe('static')
    expect(snapshot.metrics).toMatchObject({
      page: { messageCount: 20, renderedMessageCount: 10, chatNodeCount: 80 },
      media: { images: 1, videos: 1, audio: 0, canvas: 1, iframes: 1 },
      resources: {
        groups: expect.arrayContaining([
          { key: 'resource:image', count: 1, transferSize: 500, durationMs: 8 },
        ]),
      },
      storage: { usageBytes: 1024, quotaBytes: 4096 },
      heap: { usedBytes: 2048 },
    })
    expect(JSON.stringify(snapshot)).toContain('extension:third-party/demo')
    expect(JSON.stringify(snapshot)).not.toContain('portrait.webp')
    expect(JSON.stringify(snapshot)).not.toContain('token=secret')
  })

  it('records unsupported capabilities with reasons instead of invented values', async () => {
    const deps = baseDeps()
    deps.readResourceGroups = vi.fn(() => null)
    deps.estimateStorage = vi.fn<ButlerMetricsDependencies['estimateStorage']>(async () => null)
    deps.readHeapBytes = vi.fn<ButlerMetricsDependencies['readHeapBytes']>(() => null)
    deps.countAnimations = vi.fn<ButlerMetricsDependencies['countAnimations']>(() => null)

    const snapshot = await createMetricsSampler(deps).collectStatic()

    expect(snapshot.metrics.storage).toBeUndefined()
    expect(snapshot.metrics.heap).toBeUndefined()
    expect(snapshot.metrics.resources).toBeUndefined()
    expect(snapshot.capabilities).toEqual(expect.arrayContaining([
      { id: 'resourceTiming', available: false, reason: expect.any(String) },
      { id: 'storageEstimate', available: false, reason: expect.any(String) },
      { id: 'jsHeap', available: false, reason: expect.any(String) },
      { id: 'cssAnimations', available: false, reason: expect.any(String) },
    ]))
  })
})

describe('Butler six-second probes', () => {
  it('samples idle rAF, timer delay and Long Tasks, then disconnects the observer', async () => {
    const deps = baseDeps()
    const disconnect = vi.fn()
    deps.observeLongTasks = vi.fn<ButlerMetricsDependencies['observeLongTasks']>((record) => {
      record(60)
      record(90)
      return { disconnect }
    })

    const snapshot = await createMetricsSampler(deps).sampleIdle()

    expect(deps.runTimeline).toHaveBeenCalledWith(BUTLER_PROBE_DURATION_MS, expect.any(AbortSignal), expect.any(Object))
    expect(snapshot.metrics.dynamic).toMatchObject({
      frameSamples: 3,
      frameIntervalP95Ms: 62,
      frameIntervalsOver50Ms: 1,
      timerDelayP95Ms: 25,
      longTaskCount: 2,
      longTaskTotalMs: 150,
      longestTaskMs: 90,
      cssAnimationCount: 3,
    })
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['already generating', true, '当前正在生成'],
    ['generation state unavailable', null, '无法读取生成状态'],
  ])('rejects idle sampling when %s before starting the timeline', async (_name, state, reason) => {
    const deps = baseDeps()
    deps.isGenerating = vi.fn(() => state)

    const snapshot = await createMetricsSampler(deps).sampleIdle()

    expect(snapshot.invalidReason).toContain(reason)
    expect(deps.runTimeline).not.toHaveBeenCalled()
  })

  it.each([
    ['generation', (deps: ReturnType<typeof baseDeps>) => {
      let calls = 0
      deps.isGenerating = vi.fn(() => ++calls > 1)
    }, '生成状态发生变化'],
    ['chat', (deps: ReturnType<typeof baseDeps>) => {
      let calls = 0
      deps.readPageSummary = vi.fn(() => ({
        chat: { available: true as const, value: { chatKey: ++calls > 1 ? 'chat-b' : 'chat-a', messageCount: 20, userMessageCount: 9, assistantMessageCount: 11 } },
        dom: { available: true as const, value: { renderedMessageCount: 10, chatNodeCount: 80 } },
      }))
    }, '聊天已切换'],
    ['layout', (deps: ReturnType<typeof baseDeps>) => {
      let calls = 0
      deps.readPageSummary = vi.fn(() => ({
        chat: { available: true as const, value: { chatKey: 'chat-a', messageCount: 20, userMessageCount: 9, assistantMessageCount: 11 } },
        dom: { available: true as const, value: { renderedMessageCount: 10, chatNodeCount: ++calls > 1 ? 81 : 80 } },
      }))
    }, '聊天布局变化'],
  ])('invalidates idle sampling when %s changes', async (_name, arrange, reason) => {
    const deps = baseDeps()
    arrange(deps)
    deps.runTimeline = vi.fn(async (_duration, _signal, handlers) => handlers.onFrame(16))

    const result = await createMetricsSampler(deps).sampleIdle()

    expect(result.invalidReason).toContain(reason)
  })

  it('invalidates idle sampling on global user input and removes the listener', async () => {
    const deps = baseDeps()
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    deps.runTimeline = vi.fn(async (_duration, _signal, handlers) => {
      document.dispatchEvent(new Event('pointerdown'))
      handlers.onFrame(16)
    })

    const result = await createMetricsSampler(deps).sampleIdle()

    expect(result.invalidReason).toContain('用户干预')
    expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function), true)
  })

  it('restores controlled scroll position after a valid round trip', async () => {
    const deps = baseDeps()
    const chat = deps.getChatScroller()!

    const snapshot = await createMetricsSampler(deps).sampleControlledScroll()

    expect(snapshot.invalidReason).toBeUndefined()
    expect(chat.scrollTop).toBe(35)
    expect(snapshot.metrics.controlledScroll).toMatchObject({ valid: true, originalTop: 35 })
  })

  it.each([
    ['background', (deps: ReturnType<typeof baseDeps>) => { deps.isForeground = vi.fn(() => false) }, '页面进入后台'],
    ['generation', (deps: ReturnType<typeof baseDeps>) => { deps.isGenerating = vi.fn(() => true) }, '生成状态发生变化'],
    ['chat switch', (deps: ReturnType<typeof baseDeps>) => {
      vi.mocked(deps.readPageSummary)
        .mockReturnValueOnce({ chat: { available: true, value: { chatKey: 'chat-a', messageCount: 1, userMessageCount: 0, assistantMessageCount: 1 } }, dom: { available: true, value: { renderedMessageCount: 1, chatNodeCount: 2 } } })
        .mockReturnValue({ chat: { available: true, value: { chatKey: 'chat-b', messageCount: 1, userMessageCount: 0, assistantMessageCount: 1 } }, dom: { available: true, value: { renderedMessageCount: 1, chatNodeCount: 2 } } })
    }, '聊天已切换'],
  ])('cancels %s samples with an explicit retry reason', async (_name, mutate, reason) => {
    const deps = baseDeps()
    mutate(deps)

    const snapshot = await createMetricsSampler(deps).sampleControlledScroll()

    expect(snapshot.invalidReason).toContain(reason)
    expect(deps.getChatScroller()!.scrollTop).toBe(35)
  })

  it('cancels on layout change or user interference and removes listeners', async () => {
    const deps = baseDeps()
    const chat = deps.getChatScroller()!
    const removeSpy = vi.spyOn(chat, 'removeEventListener')
    deps.runTimeline = vi.fn(async (_duration, _signal, handlers) => {
      chat.dispatchEvent(new Event('wheel'))
      Object.defineProperty(chat, 'scrollHeight', { configurable: true, value: 500 })
      handlers.onFrame(16)
    })

    const snapshot = await createMetricsSampler(deps).sampleControlledScroll()

    expect(snapshot.invalidReason).toMatch(/用户干预|布局变化/)
    expect(removeSpy).toHaveBeenCalled()
    expect(chat.scrollTop).toBe(35)
  })

  it('rejects short chats without moving them', async () => {
    const deps = baseDeps()
    const chat = deps.getChatScroller()!
    Object.defineProperty(chat, 'scrollHeight', { configurable: true, value: 250 })

    const snapshot = await createMetricsSampler(deps).sampleControlledScroll()

    expect(snapshot.invalidReason).toContain('三个视口高度')
    expect(deps.runTimeline).not.toHaveBeenCalled()
    expect(chat.scrollTop).toBe(35)
  })
})

describe('probe timeline cleanup', () => {
  it('cancels rAF and timers when aborted', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const cancelFrame = vi.fn()
    let nextFrame = 0
    const promise = runProbeTimeline(6000, controller.signal, { onFrame: vi.fn(), onTimer: vi.fn() }, {
      now: () => Date.now(),
      requestFrame: () => ++nextFrame,
      cancelFrame,
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (id) => window.clearTimeout(id),
    })

    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(cancelFrame).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })
})
