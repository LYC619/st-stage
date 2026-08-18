// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PhoneAppContext } from '../../../core/phone-registry'
import { butlerApp, type ButlerAppServices } from './butler-app'
import { createEmptyButlerData } from './butler/migrations'
import type {
  ButlerDataV2,
  ButlerExperiment,
  MeasurementSnapshot,
  PerformanceSettingsSnapshot,
} from './butler/types'

function perf(overrides: Partial<PerformanceSettingsSnapshot> = {}): PerformanceSettingsSnapshot {
  return {
    fast_ui_mode: false,
    reduced_motion: false,
    noShadows: false,
    smooth_streaming: true,
    stream_fade_in: true,
    streaming_fps: 30,
    chat_truncation: 100,
    ...overrides,
  }
}

function snapshot(overrides: Partial<MeasurementSnapshot> = {}): MeasurementSnapshot {
  return {
    id: 'measurement-1',
    createdAt: 100,
    durationMs: 6_000,
    probe: 'idle',
    foreground: true,
    chatKey: 'chat-key',
    environment: {
      stVersion: { available: true, value: '1.18.0' },
      stageBuild: { available: true, value: '0.9.0+test' },
      mobile: { available: true, value: false },
      settingsSummary: { available: true, value: { streaming_fps: 30 } },
      disabledExtensionsHash: { available: true, value: 'hash' },
    },
    capabilities: [
      { id: 'pageSummary', available: true },
      { id: 'performanceSettings', available: true },
      { id: 'longTasks', available: false, reason: '浏览器不支持' },
    ],
    metrics: {
      page: { messageCount: 80, renderedMessageCount: 50, chatNodeCount: 900 },
      dynamic: { frameIntervalP95Ms: 22, longTaskCount: 0, longestTaskMs: 0 },
    },
    ...overrides,
  }
}

function inventory() {
  return {
    status: 'ready' as const,
    governance: { writable: true },
    disabledExtensions: ['third-party/disabled'],
    extensions: [
      {
        name: 'vectors',
        type: 'system',
        configuredEnabled: true,
        isSelf: false,
        manifest: {
          displayName: 'Vector Storage',
          dependencies: { status: 'absent' as const, names: [] },
          requiredModules: { status: 'absent' as const, names: [] },
        },
      },
      {
        name: 'memory',
        type: 'system',
        configuredEnabled: false,
        isSelf: false,
        manifest: {
          displayName: 'Chat Summarization',
          dependencies: { status: 'absent' as const, names: [] },
          requiredModules: { status: 'absent' as const, names: [] },
        },
      },
      {
        name: 'regex',
        type: 'system',
        configuredEnabled: true,
        isSelf: false,
        manifest: null,
      },
      {
        name: 'third-party/example',
        type: 'local',
        configuredEnabled: true,
        isSelf: false,
        manifest: {
          displayName: 'Example',
          dependencies: { status: 'absent' as const, names: [] },
          requiredModules: { status: 'absent' as const, names: [] },
        },
      },
      {
        name: 'third-party/st-stage',
        type: 'local',
        configuredEnabled: true,
        isSelf: true,
        manifest: null,
      },
    ],
  }
}

function services(overrides: Partial<ButlerAppServices> = {}): ButlerAppServices {
  let currentPerf = perf()
  return {
    collectStatic: vi.fn().mockResolvedValue(snapshot({ probe: 'static', durationMs: 0 })),
    sampleIdle: vi.fn().mockResolvedValue(snapshot()),
    sampleControlledScroll: vi.fn().mockResolvedValue(snapshot({ probe: 'controlledScroll' })),
    readPerformance: vi.fn(() => currentPerf),
    writePerformance: vi.fn(async (fields) => { currentPerf = { ...currentPerf, ...fields } }),
    readMobile: vi.fn(() => ({ available: true as const, value: false })),
    readHealth: vi.fn(() => ({
      disabledExtensions: { available: true as const, value: 1 },
      quickReplySets: { available: true as const, value: 3 },
    })),
    readExtensions: vi.fn().mockResolvedValue(inventory()),
    setExtensionEnabled: vi.fn().mockResolvedValue({
      ok: true as const,
      name: 'third-party/example',
      configuredEnabled: false,
      reloadRequired: true as const,
    }),
    reloadPage: vi.fn().mockResolvedValue(undefined),
    backupStorage: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    warnRecovery: vi.fn(),
    now: vi.fn(() => 1_000),
    createId: vi.fn(() => 'generated-id'),
    confirm: vi.fn(() => true),
    ...overrides,
  }
}

function mountButler(
  serviceOverrides: Partial<ButlerAppServices> = {},
  initialData: unknown = undefined,
) {
  let appData = initialData
  const openedModals: HTMLElement[] = []
  const ctx = {
    getAppData: () => appData,
    setAppData: (next: unknown) => { appData = next },
    openModal: (build: (body: HTMLElement, close: () => void) => void) => {
      const body = document.createElement('div')
      openedModals.push(body)
      build(body, vi.fn())
    },
    toast: vi.fn(),
  } as unknown as PhoneAppContext
  const service = services(serviceOverrides)
  const app = butlerApp(service)
  const container = document.createElement('div')
  document.body.append(container)
  app.mount(container, ctx)
  return {
    app,
    container,
    ctx,
    service,
    openedModals,
    getData: () => appData as ButlerDataV2,
  }
}

function button(container: ParentNode, label: string): HTMLElement {
  const aliases: Record<string, string> = {
    '应用安全优化': '立即应用',
    '完整报告': '查看详细结果',
    '扩展排障': '临时关闭扩展找卡顿',
    '玩法与服务端顾问': '记忆与服务器设置建议',
    '用相同探针复测': '再测一次，比较优化前后',
    '正在复测': '正在再次检查',
    '开始选定扩展 A/B': '开始对比所选扩展',
  }
  const target = aliases[label] ?? label
  const found = [...container.querySelectorAll<HTMLElement>('[role="button"], button')]
    .find((node) => node.textContent?.trim() === target || node.textContent?.includes(target))
  expect(found, `找不到按钮：${label}`).toBeDefined()
  return found!
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('管家 2.0 主屏', () => {
  it('发现旧版空事务时清理它，并仍显示明确的应用建议入口', async () => {
    const mounted = mountButler({}, {
      version: 2,
      performanceModeOn: true,
      activeTransaction: {
        id: 'empty',
        group: 'performanceSettings',
        createdAt: 1,
        status: 'applied',
        restoreStatus: 'available',
        before: { streaming_fps: 30 },
        requested: { streaming_fps: 15 },
        actual: { streaming_fps: 15 },
        actions: [],
      },
      pendingExperiment: null,
      history: [],
    })

    await vi.waitFor(() => expect(mounted.container.textContent).toContain('立即应用'))
    expect(mounted.getData().activeTransaction).toBeNull()
    expect(mounted.container.textContent).toContain('1. 开始检查')
    expect(mounted.container.textContent).toContain('4. 再测一次或恢复')
  })

  it('首次进入运行静态体检并显示可解释发现，不显示综合分', async () => {
    const mounted = mountButler()

    expect(mounted.container.textContent).toContain('环境体检')
    expect(mounted.container.textContent).toContain('正在读取当前环境')
    await vi.waitFor(() => expect(mounted.service.collectStatic).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('背景模糊当前开启'))

    expect(mounted.container.textContent).toContain('检测到什么')
    expect(mounted.container.textContent).toContain('建议修改')
    expect(mounted.container.textContent).toContain('如何恢复')
    expect(mounted.container.textContent).not.toMatch(/No Blur|A\/B|性能设置事务|待复测/)
    expect(mounted.container.textContent).not.toMatch(/综合分|性能分数/)
  })

  it('6 秒采样期间提供取消，并把无效原因原样告诉用户', async () => {
    let resolveSample!: (value: MeasurementSnapshot) => void
    let seenSignal: AbortSignal | undefined
    const sampleIdle = vi.fn((signal?: AbortSignal) => {
      seenSignal = signal
      return new Promise<MeasurementSnapshot>((resolve) => { resolveSample = resolve })
    })
    const mounted = mountButler({ sampleIdle })
    await vi.waitFor(() => expect(mounted.service.collectStatic).toHaveBeenCalledOnce())

    button(mounted.container, '开始 6 秒体检').click()
    expect(mounted.container.textContent).toContain('正在检查')
    button(mounted.container, '取消本次检查').click()
    expect(seenSignal?.aborted).toBe(true)

    resolveSample(snapshot({ invalidReason: '用户取消了采样' }))
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('用户取消了采样'))
  })

  it('采样抛错后退出忙碌态并允许重试', async () => {
    const sampleIdle = vi.fn()
      .mockRejectedValueOnce(new Error('探针异常'))
      .mockResolvedValueOnce(snapshot())
    const mounted = mountButler({ sampleIdle })
    await vi.waitFor(() => expect(mounted.service.collectStatic).toHaveBeenCalledOnce())

    button(mounted.container, '开始 6 秒体检').click()
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('探针异常'))
    expect(mounted.container.textContent).toContain('开始 6 秒体检')

    button(mounted.container, '开始 6 秒体检').click()
    await vi.waitFor(() => expect(sampleIdle).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('6 秒体检完成'))
  })

  it('迟到的静态体检不会覆盖已经完成的动态样本', async () => {
    let resolveStatic!: (value: MeasurementSnapshot) => void
    const collectStatic = vi.fn(() => new Promise<MeasurementSnapshot>((resolve) => { resolveStatic = resolve }))
    const mounted = mountButler({ collectStatic, sampleIdle: vi.fn().mockResolvedValue(snapshot({ id: 'dynamic' })) })

    button(mounted.container, '开始 6 秒体检').click()
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('最近检查：6 秒检查'))
    resolveStatic(snapshot({ id: 'late-static', probe: 'static', durationMs: 0 }))
    await vi.waitFor(() => expect(collectStatic).toHaveBeenCalledOnce())

    expect(mounted.container.textContent).toContain('最近检查：6 秒检查')
    expect(mounted.container.textContent).not.toContain('最近检查：基础检查')
  })

  it('预览将修改与保持不变，应用时持久化可恢复事务且不调高更低 FPS', async () => {
    const current = perf({ streaming_fps: 10, reduced_motion: true })
    const mounted = mountButler({ readPerformance: vi.fn(() => current) })
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('建议调整'))

    expect(mounted.container.textContent).toContain('保持不变')
    expect(mounted.container.textContent).toContain('10 → 10')
    button(mounted.container, '应用安全优化').click()

    await vi.waitFor(() => expect(mounted.service.writePerformance).toHaveBeenCalled())
    expect(mounted.service.writePerformance).not.toHaveBeenCalledWith({ streaming_fps: 15 })
    expect(mounted.getData().activeTransaction).toMatchObject({
      group: 'performanceSettings',
      restoreStatus: 'available',
    })
    expect(mounted.container.textContent).toContain('本次实际修改')
    expect(mounted.container.textContent).toContain('再测一次，比较优化前后')
  })

  it('没有动态样本时先自动采样并固定事务前基线，再应用安全优化', async () => {
    const baseline = snapshot({ id: 'auto-baseline' })
    const mounted = mountButler({ sampleIdle: vi.fn().mockResolvedValue(baseline) })
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('立即应用'))

    button(mounted.container, '应用安全优化').click()

    await vi.waitFor(() => expect(mounted.service.sampleIdle).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(mounted.getData().activeTransaction).not.toBeNull())
    expect(mounted.getData().activeTransaction?.baselineMeasurementId).toBe('auto-baseline')
    expect(mounted.getData().history.some((record) => (
      record.kind === 'measurement' && record.measurement.id === 'auto-baseline'
    ))).toBe(true)
  })

  it('不会把上次打开管家留下的历史样本复用为新事务基线', async () => {
    const stale = snapshot({ id: 'stale-baseline', createdAt: 100 })
    const fresh = snapshot({ id: 'fresh-baseline', createdAt: 2_000 })
    const initial = createEmptyButlerData()
    initial.history.push({
      id: 'history-stale-baseline',
      kind: 'measurement',
      createdAt: stale.createdAt,
      completedAt: stale.createdAt + stale.durationMs,
      outcome: 'completed',
      summary: { label: '上次体检' },
      measurement: stale,
    })
    const mounted = mountButler({ sampleIdle: vi.fn().mockResolvedValue(fresh) }, initial)
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('立即应用'))

    button(mounted.container, '应用安全优化').click()

    await vi.waitFor(() => expect(mounted.service.sampleIdle).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(mounted.getData().activeTransaction).not.toBeNull())
    expect(mounted.getData().activeTransaction?.baselineMeasurementId).toBe('fresh-baseline')
  })

  it('自动基线无效时不应用任何设置', async () => {
    const invalid = snapshot({ id: 'invalid-baseline', invalidReason: '页面进入后台' })
    const mounted = mountButler({ sampleIdle: vi.fn().mockResolvedValue(invalid) })
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('立即应用'))

    button(mounted.container, '应用安全优化').click()

    await vi.waitFor(() => expect(mounted.container.textContent).toContain('优化前检查未完成'))
    expect(mounted.service.writePerformance).not.toHaveBeenCalled()
    expect(mounted.getData().activeTransaction).toBeNull()
  })

  it('性能设置应用在事务建立前抛错后退出忙碌态并允许重试', async () => {
    let failRead = false
    let readsAfterClick = 0
    const readPerformance = vi.fn(() => {
      if (failRead && ++readsAfterClick === 2) return null
      return perf()
    })
    const mounted = mountButler({ readPerformance })
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('立即应用'))
    button(mounted.container, '开始 6 秒体检').click()
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('6 秒体检完成'))

    failRead = true
    readsAfterClick = 0
    button(mounted.container, '应用安全优化').click()

    await vi.waitFor(() => expect(mounted.container.textContent).toContain('当前 SillyTavern 性能设置不完整'))
    expect(mounted.getData().activeTransaction).toBeNull()
    expect(mounted.container.textContent).toContain('立即应用')
  })

  it('复测后只在条件可比时显示差值，并可恢复原设置', async () => {
    const baseline = snapshot({ id: 'baseline' })
    const after = snapshot({
      id: 'after',
      metrics: { dynamic: { frameIntervalP95Ms: 16, longTaskCount: 0, longestTaskMs: 0 } },
    })
    const mounted = mountButler({
      sampleIdle: vi.fn()
        .mockResolvedValueOnce(baseline)
        .mockResolvedValueOnce(after),
    })
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('立即应用'))
    button(mounted.container, '应用安全优化').click()
    await vi.waitFor(() => expect(mounted.getData().activeTransaction).not.toBeNull())
    expect(mounted.getData().activeTransaction?.baselineMeasurementId).toBe('baseline')

    button(mounted.container, '用相同探针复测').click()
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('两次检查条件一致'))
    expect(mounted.container.textContent).toContain('差值')

    button(mounted.container, '恢复本次性能设置').click()
    await vi.waitFor(() => expect(mounted.getData().activeTransaction).toBeNull())
    expect(mounted.container.textContent).toContain('已恢复到优化前设置')
  })

  it('重复复测始终使用事务前基线，不把上一次复测误当新基线', async () => {
    const baseline = snapshot({
      id: 'baseline',
      metrics: { dynamic: { frameIntervalP95Ms: 30 } },
    })
    const first = snapshot({
      id: 'after-1',
      metrics: { dynamic: { frameIntervalP95Ms: 20 } },
    })
    const second = snapshot({
      id: 'after-2',
      metrics: { dynamic: { frameIntervalP95Ms: 18 } },
    })
    const sampleIdle = vi.fn()
      .mockResolvedValueOnce(baseline)
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
    const mounted = mountButler({ sampleIdle })
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('立即应用'))
    button(mounted.container, '应用安全优化').click()
    await vi.waitFor(() => expect(mounted.getData().activeTransaction).not.toBeNull())

    button(mounted.container, '用相同探针复测').click()
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('-10'))
    button(mounted.container, '用相同探针复测').click()
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('-12'))

    expect(mounted.container.textContent).not.toContain('-2')
  })

  it('复测进行中忽略重复触发，避免并发采样', async () => {
    let resolveRemeasure!: (value: MeasurementSnapshot) => void
    const sampleIdle = vi.fn()
      .mockResolvedValueOnce(snapshot({ id: 'baseline' }))
      .mockImplementationOnce(() => new Promise<MeasurementSnapshot>((resolve) => { resolveRemeasure = resolve }))
    const mounted = mountButler({ sampleIdle })
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('立即应用'))
    button(mounted.container, '开始 6 秒体检').click()
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('6 秒体检完成'))
    button(mounted.container, '应用安全优化').click()
    await vi.waitFor(() => expect(mounted.getData().activeTransaction).not.toBeNull())

    button(mounted.container, '用相同探针复测').click()
    button(mounted.container, '正在复测').click()
    expect(sampleIdle).toHaveBeenCalledTimes(2)

    resolveRemeasure(snapshot({ id: 'after' }))
    await vi.waitFor(() => expect(mounted.container.textContent).toContain('两次检查条件一致'))
  })

  it('打开完整报告、扩展排障和玩法顾问三个全屏弹窗', async () => {
    const mounted = mountButler()
    await vi.waitFor(() => expect(mounted.service.collectStatic).toHaveBeenCalledOnce())

    for (const label of ['查看详细结果', '临时关闭扩展找卡顿', '记忆与服务器设置建议']) {
      button(mounted.container, label).click()
    }
    expect(mounted.openedModals).toHaveLength(3)
    expect(mounted.openedModals[0].textContent).toContain('详细检查结果')
    await vi.waitFor(() => expect(mounted.openedModals[1].textContent).toContain('第三方扩展'))
    expect(mounted.openedModals[2].textContent).toContain('World Info')
    expect(mounted.openedModals[2].textContent).toContain('只读查看')
    await vi.waitFor(() => expect(mounted.openedModals[2].textContent).toContain('Vector Storage：当前启用'))
    expect(mounted.openedModals[2].textContent).toContain('Summarize：当前禁用')
    expect(mounted.openedModals[2].textContent).toContain('Regex：当前启用')
  })
})

describe('扩展治理与跨刷新实验', () => {
  it('默认只勾选启用的第三方扩展，保护 st-stage，并在依赖确认后开始 A/B', async () => {
    const mounted = mountButler()
    await vi.waitFor(() => expect(mounted.service.collectStatic).toHaveBeenCalledOnce())
    button(mounted.container, '临时关闭扩展找卡顿').click()
    const modal = mounted.openedModals[0]
    await vi.waitFor(() => expect(modal.textContent).toContain('third-party/example'))

    const candidate = modal.querySelector<HTMLInputElement>('input[value="third-party/example"]')
    const self = modal.querySelector<HTMLInputElement>('input[value="third-party/st-stage"]')
    expect(candidate?.checked).toBe(true)
    expect(self?.disabled).toBe(true)
    button(modal, '开始选定扩展 A/B').click()

    await vi.waitFor(() => expect(mounted.service.setExtensionEnabled).toHaveBeenCalledWith('third-party/example', false))
    expect(mounted.getData().pendingExperiment).toMatchObject({
      kind: 'selectedExtensions',
      status: 'awaitingReload',
    })
    expect(mounted.service.reloadPage).toHaveBeenCalledOnce()
  })

  it('刷新后恢复实验状态，允许复测并保留或完整恢复原禁用清单', async () => {
    const pending: ButlerExperiment = {
      id: 'experiment-1',
      kind: 'selectedExtensions',
      status: 'awaitingReload',
      startedAt: 100,
      originalDisabledExtensions: ['third-party/disabled'],
      candidateExtensions: ['third-party/example'],
      trialDisabledExtensions: ['third-party/example'],
      currentRound: 1,
      baselineMeasurementId: 'baseline',
    }
    const data = createEmptyButlerData()
    data.pendingExperiment = pending
    data.history.push({
      id: 'history-baseline',
      kind: 'measurement',
      createdAt: 10,
      completedAt: 20,
      outcome: 'completed',
      summary: { label: '扩展实验基线' },
      measurement: snapshot({ id: 'baseline' }),
    })
    const mounted = mountButler({}, data)
    await vi.waitFor(() => expect(mounted.getData().pendingExperiment?.status).toBe('sampling'))
    button(mounted.container, '临时关闭扩展找卡顿').click()
    const modal = mounted.openedModals[0]
    await vi.waitFor(() => expect(modal.textContent).toContain('等待关闭后检查'))
    button(modal, '检查关闭后的表现').click()
    await vi.waitFor(() => expect(mounted.getData().pendingExperiment?.status).toBe('awaitingDecision'))
    expect(modal.textContent).toContain('保持这些扩展关闭')
    expect(modal.textContent).toContain('恢复原来的扩展状态')
  })

  it('部分变更失败时不允许把未生效的一轮用于二分判断', async () => {
    const pending: ButlerExperiment = {
      id: 'experiment-partial',
      kind: 'binaryIsolation',
      status: 'awaitingDecision',
      startedAt: 100,
      originalDisabledExtensions: [],
      candidateExtensions: ['third-party/a', 'third-party/b'],
      trialDisabledExtensions: ['third-party/a'],
      currentRound: 1,
      baselineMeasurementId: 'baseline',
      reloadRequiredAfterDecision: true,
      notes: '扩展变更未全部成功',
    }
    const data = createEmptyButlerData()
    data.pendingExperiment = pending
    const mounted = mountButler({}, data)

    button(mounted.container, '临时关闭扩展找卡顿').click()
    const modal = mounted.openedModals[0]

    expect(modal.textContent).not.toContain('变流畅了')
    expect(modal.textContent).not.toContain('没有变流畅')
    expect(modal.textContent).toContain('保持这些扩展关闭')
    expect(modal.textContent).toContain('恢复原来的扩展状态')
  })

  it('appData 丢失时在扩展页显示 localStorage 紧急恢复入口', async () => {
    const store = new Map<string, string>([[
      'st-stage:butler:extension-recovery:v1',
      JSON.stringify({ version: 1, createdAt: 123, disabledExtensions: [] }),
    ]])
    const mounted = mountButler({
      backupStorage: {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => { store.set(key, value) }),
        removeItem: vi.fn((key: string) => { store.delete(key) }),
      },
    })

    button(mounted.container, '临时关闭扩展找卡顿').click()
    const modal = mounted.openedModals[0]
    await vi.waitFor(() => expect(modal.textContent).toContain('检测到紧急恢复备份'))

    button(modal, '恢复备份中的禁用清单').click()
    await vi.waitFor(() => expect(store.size).toBe(0))
    expect(modal.textContent).toContain('紧急备份已恢复')
  })
})
