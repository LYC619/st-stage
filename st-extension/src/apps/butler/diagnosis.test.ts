import { describe, expect, it } from 'vitest'
import type { MeasurementSnapshot, PerformanceSettingsSnapshot } from './types'
import { buildSafePlan, diagnose } from './diagnosis'

function perf(overrides: Partial<PerformanceSettingsSnapshot> = {}): PerformanceSettingsSnapshot {
  return {
    fast_ui_mode: false,
    reduced_motion: false,
    noShadows: false,
    smooth_streaming: true,
    stream_fade_in: true,
    streaming_fps: 30,
    chat_truncation: 0,
    ...overrides,
  }
}

function snapshot(metrics: MeasurementSnapshot['metrics'] = {}): MeasurementSnapshot {
  return {
    id: 'm1',
    createdAt: 1,
    durationMs: 6000,
    probe: 'idle',
    foreground: true,
    chatKey: 'hashed-chat',
    environment: {
      stVersion: { available: true, value: '1.18.0' },
      stageBuild: { available: true, value: '0.9.0+test' },
      mobile: { available: true, value: false },
      settingsSummary: { available: true, value: {} },
      disabledExtensionsHash: { available: true, value: 'hash' },
    },
    capabilities: [
      { id: 'longTasks', available: true },
      { id: 'resourceTiming', available: true },
      { id: 'pageSummary', available: true },
      { id: 'mediaDom', available: true },
    ],
    metrics,
  }
}

describe('buildSafePlan', () => {
  it.each([
    ['fast_ui_mode', false, true],
    ['reduced_motion', false, true],
    ['noShadows', false, true],
    ['smooth_streaming', true, false],
    ['stream_fade_in', true, false],
  ] as const)('%s only moves toward lower rendering cost', (field, before, requested) => {
    const current = perf({ [field]: before })
    const plan = buildSafePlan(current, 'desktop')
    expect(plan.actions).toContainEqual(expect.objectContaining({ field, before, requested, status: 'planned' }))

    const alreadyOptimized = perf({ [field]: requested })
    const unchanged = buildSafePlan(alreadyOptimized, 'desktop')
    expect(unchanged.actions).not.toContainEqual(expect.objectContaining({ field }))
    expect(unchanged.unchanged).toContainEqual(expect.objectContaining({ field, before: requested, requested }))
  })

  it.each([
    ['desktop', 30, 15],
    ['desktop', 10, 10],
    ['mobile', 8, 8],
  ] as const)('never raises streaming FPS on %s (%s -> %s)', (device, before, requested) => {
    const plan = buildSafePlan(perf({ streaming_fps: before }), device)
    const action = [...plan.actions, ...plan.unchanged].find((item) => item.field === 'streaming_fps')!
    expect(action.requested).toBe(requested)
    expect(action.requested as number).toBeLessThanOrEqual(before)
  })

  it.each([
    ['desktop', 0, 50],
    ['desktop', 100, 50],
    ['desktop', 25, 25],
    ['mobile', 0, 20],
    ['mobile', 100, 20],
    ['mobile', 15, 15],
  ] as const)('uses bounded message limits on %s (%s -> %s)', (device, before, requested) => {
    const plan = buildSafePlan(perf({ chat_truncation: before }), device)
    const action = [...plan.actions, ...plan.unchanged].find((item) => item.field === 'chat_truncation')!
    expect(action.requested).toBe(requested)
    if (before > 0) expect(action.requested as number).toBeLessThanOrEqual(before)
  })

  it('contains performance settings only and marks chat reload requirements', () => {
    const plan = buildSafePlan(perf(), 'mobile')
    expect(plan.actions.every((action) => action.group === 'performanceSettings')).toBe(true)
    expect(plan.actions.some((action) => /extension|world|vector|summar/i.test(action.field))).toBe(false)
    expect(plan.actions.find((action) => action.field === 'chat_truncation')?.reloadRequired).toBe(true)
  })
})

describe('diagnose', () => {
  it('emits explainable setting findings with all seven text fields and no score', () => {
    const findings = diagnose(snapshot(), perf())
    const blur = findings.find((finding) => finding.id === 'setting-no-blur')!

    expect(blur).toMatchObject({
      layer: 'pageRendering',
      severity: 'suggestion',
      confidence: 'setting',
      actionId: 'perf-fast-ui',
    })
    expect(Object.keys(blur.explanation).sort()).toEqual([
      'change', 'detected', 'impact', 'reason', 'reload', 'restore', 'result',
    ])
    expect(blur.explanation.result).toContain('等待再次检查')
    expect(findings).not.toHaveProperty('score')
    expect(JSON.stringify(findings)).not.toMatch(/综合分|评分/)
  })

  it('does not suggest already optimized settings', () => {
    const optimized = perf({
      fast_ui_mode: true,
      reduced_motion: true,
      noShadows: true,
      smooth_streaming: false,
      stream_fade_in: false,
      streaming_fps: 10,
      chat_truncation: 20,
    })
    expect(diagnose(snapshot(), optimized).filter((finding) => finding.confidence === 'setting')).toEqual([])
  })

  it.each([
    [15, false],
    [16, true],
  ])('uses the streaming FPS boundary %s', (streamingFps, hit) => {
    const findings = diagnose(snapshot(), perf({ streaming_fps: streamingFps }))
    expect(findings.some((finding) => finding.id === 'setting-streaming-fps')).toBe(hit)
  })

  it.each([
    [false, 50, false],
    [false, 51, true],
    [true, 20, false],
    [true, 21, true],
  ])('uses the device message boundary mobile=%s, value=%s', (mobile, value, hit) => {
    const input = snapshot()
    input.environment.mobile = { available: true, value: mobile }
    const findings = diagnose(input, perf({ chat_truncation: value }))
    expect(findings.some((finding) => finding.id === 'setting-chat-truncation')).toBe(hit)
  })

  it('does not invent a device-specific message limit when mobile capability is unavailable', () => {
    const input = snapshot()
    input.environment.mobile = { available: false, reason: 'unknown device' }
    const findings = diagnose(input, perf({ chat_truncation: 100 }))
    expect(findings.some((finding) => finding.id === 'setting-chat-truncation')).toBe(false)
  })

  it.each([
    [{ longTaskCount: 0, longestTaskMs: 0 }, false],
    [{ longTaskCount: 1, longestTaskMs: 49 }, false],
    [{ longTaskCount: 1, longestTaskMs: 50 }, true],
    [{ longTaskCount: 2, longestTaskMs: 120 }, true],
  ])('uses the standard Long Task boundary: %j', (dynamic, hit) => {
    const findings = diagnose(snapshot({ dynamic }), null)
    expect(findings.some((finding) => finding.id === 'measured-long-tasks')).toBe(hit)
  })

  it('reports resource evidence only as correlation and asks for comparison', () => {
    const findings = diagnose(snapshot({
      resources: { groups: [{ key: 'extension:third-party/demo', count: 3, transferSize: 1000, durationMs: 80 }] },
    }), null)
    const resource = findings.find((finding) => finding.id === 'extension-resource-evidence')!

    expect(resource.confidence).toBe('correlation')
    expect(resource.actionId).toBeUndefined()
    expect(JSON.stringify(resource.explanation)).toContain('对比')
    expect(JSON.stringify(resource.explanation)).not.toContain('A/B')
    expect(JSON.stringify(resource.explanation)).not.toMatch(/就是|导致卡顿|元凶|证明/)
  })

  it('does not treat ordinary resource groups as extension evidence', () => {
    const findings = diagnose(snapshot({
      resources: { groups: [{ key: 'resource:image', count: 3, transferSize: 1000, durationMs: 80 }] },
    }), null)
    expect(findings.some((finding) => finding.id === 'extension-resource-evidence')).toBe(false)
  })

  it.each([
    [99, 'suggestion'],
    [100, 'risk'],
  ] as const)('uses the Long Task severity boundary %sms', (longestTaskMs, severity) => {
    const findings = diagnose(snapshot({ dynamic: { longTaskCount: 1, longestTaskMs } }), null)
    expect(findings.find((finding) => finding.id === 'measured-long-tasks')?.severity).toBe(severity)
  })

  it('keeps DOM/media counts informational and emits no automatic action', () => {
    const findings = diagnose(snapshot({
      page: { messageCount: 2000, renderedMessageCount: 1000, chatNodeCount: 100000 },
      media: { images: 500, videos: 10, audio: 4, canvas: 5, iframes: 8, visible: 3, offscreen: 524 },
    }), null)
    const evidence = findings.filter((finding) => finding.id.startsWith('evidence-'))
    expect(evidence).toHaveLength(2)
    expect(evidence.every((finding) => finding.severity === 'info' && finding.actionId === undefined)).toBe(true)
  })

  it('does not invent findings for unavailable metric capabilities', () => {
    const input = snapshot({
      dynamic: { longTaskCount: 3, longestTaskMs: 200 },
      resources: { groups: [{ key: 'extension:third-party/demo', count: 1 }] },
      page: { messageCount: 10 },
      media: { images: 10 },
    })
    input.capabilities = [
      { id: 'longTasks', available: false, reason: 'unsupported' },
      { id: 'resourceTiming', available: false, reason: 'unsupported' },
      { id: 'pageSummary', available: false, reason: 'unsupported' },
      { id: 'mediaDom', available: false, reason: 'unsupported' },
      { id: 'storageEstimate', available: false, reason: 'unsupported' },
    ]
    const findings = diagnose(input, null)
    expect(findings).toContainEqual(expect.objectContaining({ id: 'capability-unavailable', severity: 'info' }))
    expect(findings.some((finding) => finding.confidence === 'measurement')).toBe(false)
    expect(findings.some((finding) => finding.id === 'extension-resource-evidence')).toBe(false)
  })
})
