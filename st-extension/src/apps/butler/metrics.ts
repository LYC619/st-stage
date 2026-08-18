import type {
  ButlerCapability,
  JsonValue,
  MeasurementEnvironment,
  MeasurementSnapshot,
} from './types'
import type {
  PageSummary,
  PerfReadState,
  ResourceTimingGroup,
} from './bridge'

export const BUTLER_PROBE_DURATION_MS = 6000
const TIMER_INTERVAL_MS = 100

export interface ProbeTimelineHandlers {
  onFrame(timeMs: number): void
  onTimer(scheduledMs: number, actualMs: number): void
}

export interface ProbeTimelineDependencies {
  now(): number
  requestFrame(callback: FrameRequestCallback): number
  cancelFrame(id: number): void
  setTimer(callback: () => void, ms: number): number
  clearTimer(id: number): void
}

export interface LongTaskSubscription {
  disconnect(): void
}

export interface ButlerMetricsDependencies {
  now(): number
  createId(): string
  readEnvironment(): MeasurementEnvironment | Promise<MeasurementEnvironment>
  readPageSummary(): PageSummary
  readPerfState(): PerfReadState
  readResourceGroups(): ResourceTimingGroup[] | null
  estimateStorage(): Promise<{ usage: number; quota: number } | null>
  readHeapBytes(): number | null
  getChatScroller(): HTMLElement | null
  getViewport(): { width: number; height: number }
  countAnimations(): number | null
  isForeground(): boolean
  isGenerating(): boolean | null
  observeLongTasks(record: (durationMs: number) => void): LongTaskSubscription | null
  runTimeline(
    durationMs: number,
    signal: AbortSignal,
    handlers: ProbeTimelineHandlers,
  ): Promise<void>
}

function abortError(): Error {
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

/** Fixed-duration rAF/timer driver. Every handle is released on success, failure, or abort. */
export function runProbeTimeline(
  durationMs: number,
  signal: AbortSignal,
  handlers: ProbeTimelineHandlers,
  deps: ProbeTimelineDependencies = {
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (id) => cancelAnimationFrame(id),
    setTimer: (callback, ms) => window.setTimeout(callback, ms),
    clearTimer: (id) => window.clearTimeout(id),
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }

    const startedAt = deps.now()
    let frameId: number | null = null
    let timerId: number | null = null
    let finishId: number | null = null
    let settled = false
    let nextTimerAt = TIMER_INTERVAL_MS

    const cleanup = () => {
      if (frameId !== null) deps.cancelFrame(frameId)
      if (timerId !== null) deps.clearTimer(timerId)
      if (finishId !== null) deps.clearTimer(finishId)
      signal.removeEventListener('abort', onAbort)
      frameId = timerId = finishId = null
    }
    const settle = (error?: Error) => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve()
    }
    const onAbort = () => settle(abortError())
    const frame = (time: number) => {
      if (settled || signal.aborted) return
      handlers.onFrame(time - startedAt)
      frameId = deps.requestFrame(frame)
    }
    const timer = () => {
      if (settled || signal.aborted) return
      const elapsed = deps.now() - startedAt
      handlers.onTimer(nextTimerAt, elapsed)
      nextTimerAt += TIMER_INTERVAL_MS
      timerId = deps.setTimer(timer, Math.max(0, nextTimerAt - elapsed))
    }

    signal.addEventListener('abort', onAbort, { once: true })
    frameId = deps.requestFrame(frame)
    timerId = deps.setTimer(timer, TIMER_INTERVAL_MS)
    finishId = deps.setTimer(() => settle(), durationMs)
  })
}

function available(id: string): ButlerCapability {
  return { id, available: true }
}

function unavailable(id: string, reason: string): ButlerCapability {
  return { id, available: false, reason }
}

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function percentile95(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]
}

function summarizeMedia(root: ParentNode, viewport: { width: number; height: number }): Record<string, JsonValue> {
  const kinds = {
    images: 'img',
    videos: 'video',
    audio: 'audio',
    canvas: 'canvas',
    iframes: 'iframe',
  } as const
  const result: Record<string, JsonValue> = {}
  let visible = 0
  let offscreen = 0
  for (const [key, selector] of Object.entries(kinds)) {
    const nodes = [...root.querySelectorAll<HTMLElement>(selector)]
    result[key] = nodes.length
    for (const node of nodes) {
      const rect = node.getBoundingClientRect()
      const intersects = rect.width > 0 && rect.height > 0
        && rect.bottom > 0 && rect.right > 0
        && rect.top < viewport.height && rect.left < viewport.width
      if (intersects) visible += 1
      else offscreen += 1
    }
  }
  return { ...result, visible, offscreen }
}

/** Keep extension identity or resource kind; never persist a normal resource path. */
function sanitizeResourceGroups(groups: ResourceTimingGroup[]): Array<Record<string, JsonValue>> {
  const aggregated = new Map<string, { key: string; count: number; transferSize: number; durationMs: number }>()
  for (const group of groups) {
    const key = group.key.startsWith('extension:')
      ? group.key
      : `resource:${group.key.startsWith('resource:') ? group.key.slice('resource:'.length) || 'other' : 'other'}`
    const current = aggregated.get(key) ?? { key, count: 0, transferSize: 0, durationMs: 0 }
    current.count += finiteNonNegative(group.count)
    current.transferSize += finiteNonNegative(group.transferSize)
    current.durationMs += finiteNonNegative(group.durationMs)
    aggregated.set(key, current)
  }
  return [...aggregated.values()]
}

function combineSignals(external: AbortSignal | undefined): {
  controller: AbortController
  cleanup(): void
} {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (external?.aborted) controller.abort()
  else external?.addEventListener('abort', onAbort, { once: true })
  return {
    controller,
    cleanup: () => external?.removeEventListener('abort', onAbort),
  }
}

function invalidReasonFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.name === 'AbortError' ? fallback : '采样失败，请重试'
}

export function createMetricsSampler(deps: ButlerMetricsDependencies) {
  const collectStatic = async (probe: MeasurementSnapshot['probe'] = 'static'): Promise<MeasurementSnapshot> => {
    const page = deps.readPageSummary()
    const perf = deps.readPerfState()
    const capabilities: ButlerCapability[] = []
    const metrics: Record<string, JsonValue> = {}

    if (page.chat.available && page.dom.available) {
      capabilities.push(available('pageSummary'))
      metrics.page = {
        messageCount: page.chat.value.messageCount,
        userMessageCount: page.chat.value.userMessageCount,
        assistantMessageCount: page.chat.value.assistantMessageCount,
        renderedMessageCount: page.dom.value.renderedMessageCount,
        chatNodeCount: page.dom.value.chatNodeCount,
      }
    } else {
      capabilities.push(unavailable(
        'pageSummary',
        [page.chat, page.dom].filter((entry) => !entry.available).map((entry) => entry.reason).join('；'),
      ))
    }

    if (perf.status !== 'unavailable') {
      capabilities.push(available('performanceSettings'))
      metrics.performanceSettings = { ...perf.snapshot }
    } else {
      capabilities.push(unavailable('performanceSettings', perf.reason ?? '性能设置不可用'))
    }

    const root = deps.getChatScroller() ?? document
    metrics.media = summarizeMedia(root, deps.getViewport())
    capabilities.push(available('mediaDom'))

    const resourceEvidence = deps.readResourceGroups()
    if (resourceEvidence === null) {
      capabilities.push(unavailable('resourceTiming', '当前浏览器不支持资源加载记录'))
    } else {
      metrics.resources = { groups: sanitizeResourceGroups(resourceEvidence) }
      capabilities.push(available('resourceTiming'))
    }

    const storage = await deps.estimateStorage()
    if (storage) {
      metrics.storage = {
        usageBytes: finiteNonNegative(storage.usage),
        quotaBytes: finiteNonNegative(storage.quota),
      }
      capabilities.push(available('storageEstimate'))
    } else {
      capabilities.push(unavailable('storageEstimate', '当前浏览器不支持站点存储检查'))
    }

    const heap = deps.readHeapBytes()
    if (heap === null) capabilities.push(unavailable('jsHeap', '当前浏览器不支持网页内存信息'))
    else {
      metrics.heap = { usedBytes: finiteNonNegative(heap) }
      capabilities.push(available('jsHeap'))
    }

    const animationCount = deps.countAnimations()
    if (animationCount === null) capabilities.push(unavailable('cssAnimations', '当前浏览器不支持动画数量统计'))
    else {
      metrics.animations = { running: finiteNonNegative(animationCount) }
      capabilities.push(available('cssAnimations'))
    }

    return {
      id: deps.createId(),
      createdAt: deps.now(),
      durationMs: probe === 'static' ? 0 : BUTLER_PROBE_DURATION_MS,
      probe,
      foreground: deps.isForeground(),
      ...(page.chat.available ? { chatKey: page.chat.value.chatKey } : {}),
      environment: await deps.readEnvironment(),
      capabilities,
      metrics,
    }
  }

  const sampleDynamic = async (
    probe: 'idle' | 'controlledScroll',
    signal?: AbortSignal,
    onFrameEffect?: (timeMs: number) => string | null,
  ): Promise<MeasurementSnapshot> => {
    const snapshot = await collectStatic(probe)
    const combined = combineSignals(signal)
    const controller = combined.controller
    const initialGenerating = deps.isGenerating()
    if (initialGenerating === null) {
      combined.cleanup()
      snapshot.invalidReason = '无法读取生成状态，采样未开始'
      return snapshot
    }
    if (initialGenerating) {
      combined.cleanup()
      snapshot.invalidReason = '当前正在生成，采样未开始'
      return snapshot
    }
    const initialPage = snapshot.metrics.page
    const initialPageRecord = initialPage && typeof initialPage === 'object' && !Array.isArray(initialPage)
      ? initialPage as Record<string, JsonValue>
      : null
    const frameIntervals: number[] = []
    const timerDelays: number[] = []
    const longTasks: number[] = []
    let previousFrame: number | null = null
    let cancellationReason = ''
    let longTaskSubscription: LongTaskSubscription | null = null
    let userInterfered = false
    const userEvents: Array<keyof DocumentEventMap> = ['wheel', 'pointerdown', 'touchstart', 'keydown', 'input']
    const onUserInterference = () => { userInterfered = true }

    const cancel = (reason: string) => {
      if (!cancellationReason) cancellationReason = reason
      controller.abort()
    }
    const onVisibility = () => {
      if (!deps.isForeground()) cancel('页面进入后台，采样已取消，请重试')
    }
    document.addEventListener('visibilitychange', onVisibility)
    for (const event of userEvents) document.addEventListener(event, onUserInterference, true)

    try {
      if (!deps.isForeground()) cancel('页面进入后台，采样已取消，请重试')
      longTaskSubscription = deps.observeLongTasks((duration) => {
        if (Number.isFinite(duration) && duration >= 0) longTasks.push(duration)
      })
      snapshot.capabilities.push(longTaskSubscription
        ? available('longTasks')
        : unavailable('longTasks', '当前浏览器不支持页面卡顿记录'))

      await deps.runTimeline(BUTLER_PROBE_DURATION_MS, controller.signal, {
        onFrame(time) {
          if (!deps.isForeground()) {
            cancel('页面进入后台，采样已取消，请重试')
            return
          }
          if (userInterfered) cancel('检测到用户干预，采样已取消')
          const generating = deps.isGenerating()
          if (generating === null) cancel('无法读取生成状态，采样已取消')
          else if (generating !== initialGenerating) cancel('生成状态发生变化，采样已取消')
          const currentPage = deps.readPageSummary()
          if (snapshot.chatKey && currentPage.chat.available && currentPage.chat.value.chatKey !== snapshot.chatKey) {
            cancel('聊天已切换，采样已取消')
          }
          if (initialPageRecord && currentPage.dom.available) {
            const initialRendered = initialPageRecord.renderedMessageCount
            const initialNodes = initialPageRecord.chatNodeCount
            if (currentPage.dom.value.renderedMessageCount !== initialRendered
              || currentPage.dom.value.chatNodeCount !== initialNodes) {
              cancel('聊天布局变化，采样已取消')
            }
          }
          const reason = onFrameEffect?.(time)
          if (reason) cancel(reason)
          if (previousFrame !== null) frameIntervals.push(Math.max(0, time - previousFrame))
          previousFrame = time
        },
        onTimer(scheduled, actual) {
          timerDelays.push(Math.max(0, actual - scheduled))
        },
      })
    } catch (error) {
      cancellationReason ||= invalidReasonFromError(error, signal?.aborted ? '用户取消了采样' : '采样已取消，请重试')
    } finally {
      document.removeEventListener('visibilitychange', onVisibility)
      for (const event of userEvents) document.removeEventListener(event, onUserInterference, true)
      longTaskSubscription?.disconnect()
      combined.cleanup()
    }

    const animationCount = deps.countAnimations()
    snapshot.metrics.dynamic = {
      frameSamples: frameIntervals.length,
      frameIntervalP95Ms: percentile95(frameIntervals),
      frameIntervalsOver50Ms: frameIntervals.filter((value) => value > 50).length,
      timerDelayP95Ms: percentile95(timerDelays),
      longTaskCount: longTasks.length,
      longTaskTotalMs: longTasks.reduce((sum, value) => sum + value, 0),
      longestTaskMs: longTasks.length > 0 ? Math.max(...longTasks) : 0,
      ...(animationCount === null ? {} : { cssAnimationCount: animationCount }),
    }
    if (cancellationReason) snapshot.invalidReason = cancellationReason
    return snapshot
  }

  return {
    collectStatic: () => collectStatic('static'),
    sampleIdle: (signal?: AbortSignal) => sampleDynamic('idle', signal),
    async sampleControlledScroll(signal?: AbortSignal): Promise<MeasurementSnapshot> {
      const chat = deps.getChatScroller()
      const originalTop = chat?.scrollTop ?? 0
      const initialHeight = chat?.scrollHeight ?? 0
      const initialClientHeight = chat?.clientHeight ?? 0
      const initialGenerating = deps.isGenerating()
      let userInterfered = false
      let localReason = ''
      const userEvents: Array<keyof HTMLElementEventMap> = ['wheel', 'pointerdown', 'touchstart', 'keydown', 'input']
      const onUserInterference = () => { userInterfered = true }

      if (!chat) {
        const snapshot = await collectStatic('controlledScroll')
        snapshot.invalidReason = '未找到聊天滚动区域'
        return snapshot
      }
      if (initialHeight < initialClientHeight * 3) {
        const snapshot = await collectStatic('controlledScroll')
        snapshot.invalidReason = '聊天区域不足三个视口高度，无法安全运行受控滚动'
        return snapshot
      }
      if (initialGenerating === null) {
        const snapshot = await collectStatic('controlledScroll')
        snapshot.invalidReason = '无法读取生成状态，采样未开始'
        return snapshot
      }
      if (initialGenerating) {
        const snapshot = await collectStatic('controlledScroll')
        snapshot.invalidReason = '生成状态发生变化或当前正在生成，采样已取消'
        return snapshot
      }

      const baseline = deps.readPageSummary()
      const baselineChatKey = baseline.chat.available ? baseline.chat.value.chatKey : null
      const maxScroll = Math.max(0, initialHeight - initialClientHeight)
      const distance = Math.min(initialClientHeight * 1.5, Math.max(0, maxScroll - initialClientHeight))
      for (const event of userEvents) chat.addEventListener(event, onUserInterference, { passive: true })

      chat.scrollTop = maxScroll
      try {
        const snapshot = await sampleDynamic('controlledScroll', signal, (time) => {
          if (userInterfered) localReason ||= '检测到用户干预，采样已取消'
          if (chat.scrollHeight !== initialHeight || chat.clientHeight !== initialClientHeight) {
            localReason ||= '聊天布局变化，采样已取消'
          }
          const generating = deps.isGenerating()
          if (generating === null) localReason ||= '无法读取生成状态，采样已取消'
          else if (generating !== initialGenerating) localReason ||= '生成状态发生变化，采样已取消'
          const progress = Math.min(1, Math.max(0, time / BUTLER_PROBE_DURATION_MS))
          chat.scrollTop = progress <= 0.5
            ? maxScroll - distance * progress * 2
            : maxScroll - distance + distance * (progress - 0.5) * 2
          return localReason || null
        })
        const after = deps.readPageSummary()
        if (baselineChatKey && after.chat.available && after.chat.value.chatKey !== baselineChatKey) {
          localReason ||= '聊天已切换，采样已取消'
        }
        if (chat.scrollHeight !== initialHeight || chat.clientHeight !== initialClientHeight) {
          localReason ||= '聊天布局变化，采样已取消'
        }
        if (userInterfered) localReason ||= '检测到用户干预，采样已取消'
        const generating = deps.isGenerating()
        if (generating === null) localReason ||= '无法读取生成状态，采样已取消'
        else if (generating !== initialGenerating) localReason ||= '生成状态发生变化，采样已取消'
        snapshot.metrics.controlledScroll = {
          valid: !snapshot.invalidReason && !localReason,
          originalTop,
          distance,
        }
        if (localReason) snapshot.invalidReason = localReason
        return snapshot
      } finally {
        for (const event of userEvents) chat.removeEventListener(event, onUserInterference)
        chat.scrollTop = originalTop
      }
    },
  }
}
