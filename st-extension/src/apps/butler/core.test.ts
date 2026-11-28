// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import {
  applyTransaction,
  compareMeasurements,
  restoreTransaction,
  summarizeMeasurementComparison,
  type ButlerActionBridge,
} from './actions'
import type { ExtensionInventoryItem, ExtensionInventoryResult, ExtensionWriteResult } from './bridge'
import { buildSafePlan, diagnose } from './diagnosis'
import {
  applyDesiredDisabledExtensions,
  buildEmergencyBackup,
  finishExtensionExperiment,
  readEmergencyBackup,
  restoreEmergencyExtensionBackup,
  resumeExtensionExperiment,
  type ExtensionExperimentDependencies,
} from './experiments'
import { getSystemExtensionAdvice, type SystemExtensionRecommendation } from './extension-advisor'
import { fitButlerDataBudget, utf8JsonBytes } from './history'
import { createEmptyButlerData, migrateButlerData } from './migrations'
import { FALLBACK_DIRECTORY_NAME, installDirectoryName, matchesSelf, selfExtensionNames } from './self-identity'
import { inspectExtensionModule, inspectPowerUserModule, summarizeExtensionManifest } from './st-contract'
import type {
  ButlerAction,
  ButlerActionGroup,
  ButlerDataV2,
  ButlerExperiment,
  ButlerHistoryRecord,
  ButlerTransaction,
  MeasurementSnapshot,
  PerformanceSettingsSnapshot,
} from './types'

function makeAction(field: string, before: unknown, requested: unknown, reloadRequired = false): ButlerAction {
  return {
    id: `action-${field}`,
    group: 'performanceSettings',
    label: field,
    field,
    before: before as never,
    requested: requested as never,
    status: 'planned',
    reloadRequired,
  }
}

function makePerf(overrides: Partial<PerformanceSettingsSnapshot> = {}): PerformanceSettingsSnapshot {
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

function makeMeasurement(overrides: Partial<MeasurementSnapshot> = {}): MeasurementSnapshot {
  return {
    id: 'm1',
    createdAt: 1,
    durationMs: 6000,
    probe: 'idle',
    foreground: true,
    chatKey: 'chat-hash',
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
    metrics: { dynamic: { longestTaskMs: 80, frameIntervalP95Ms: 32 }, page: { chatNodeCount: 100 } },
    ...overrides,
  }
}

describe('actions: transactions & measurement comparison', () => {
  function actionBridge(initial: Record<string, unknown>, failures: string[] = []) {
    const state = { ...initial }
    const order: string[] = []
    const api: ButlerActionBridge = {
      readGroup: vi.fn(async (_group: ButlerActionGroup) => ({ ...state } as never)),
      writeGroup: vi.fn(async (_group, fields) => {
        const field = Object.keys(fields)[0]
        order.push(`write:${field}`)
        if (failures.includes(field)) throw new Error(`failed ${field}`)
        Object.assign(state, fields)
      }),
      persistTransaction: vi.fn(async (tx) => { order.push(`persist:${tx.status}`) }),
      now: vi.fn(() => 100),
      createId: vi.fn(() => 'tx-1'),
    }
    return { api, state, order }
  }

  it('persists before writing, verifies reread values, handles partial failures, and skips unchanged actions', async () => {
    const h = actionBridge({ streaming_fps: 30 })
    const res = await applyTransaction([makeAction('streaming_fps', 30, 15)], h.api)
    expect(h.order.slice(0, 2)).toEqual(['persist:applying', 'write:streaming_fps'])
    expect(res.before).toEqual({ streaming_fps: 30 })

    const mismatch = actionBridge({ streaming_fps: 30 })
    vi.mocked(mismatch.api.writeGroup).mockImplementation(async () => { mismatch.state.streaming_fps = 12 })
    const badActual = await applyTransaction([makeAction('streaming_fps', 30, 15)], mismatch.api)
    expect(badActual).toMatchObject({ status: 'failed', actual: { streaming_fps: 12 } })

    const partial = actionBridge({ streaming_fps: 30, chat_truncation: 100 }, ['chat_truncation'])
    const partRes = await applyTransaction([makeAction('streaming_fps', 30, 15), makeAction('chat_truncation', 100, 50, true)], partial.api)
    expect(partRes.status).toBe('partial')
    expect(partRes.actions.map((a) => a.status)).toEqual(['applied', 'failed'])
    expect(partial.state).toEqual({ streaming_fps: 15, chat_truncation: 100 })

    const noOp = actionBridge({ streaming_fps: 10 })
    const unchanged = { ...makeAction('streaming_fps', 10, 10), status: 'unchanged' as const }
    expect((await applyTransaction([unchanged], noOp.api)).status).toBe('applied')
    expect(noOp.api.writeGroup).not.toHaveBeenCalled()
  })

  it('restores applied fields while detecting user-modified conflicts unless explicitly confirmed', async () => {
    const tx: ButlerTransaction = {
      id: 'tx',
      group: 'performanceSettings',
      createdAt: 1,
      completedAt: 2,
      status: 'applied',
      restoreStatus: 'available',
      before: { streaming_fps: 30, chat_truncation: 100 },
      requested: { streaming_fps: 15, chat_truncation: 50 },
      actual: { streaming_fps: 15, chat_truncation: 50 },
      actions: [
        { ...makeAction('streaming_fps', 30, 15), actual: 15, status: 'applied' },
        { ...makeAction('chat_truncation', 100, 50, true), actual: 50, status: 'applied' },
      ],
    }

    const clean = actionBridge({ streaming_fps: 15, chat_truncation: 50, unrelated: 'keep' })
    const ok = await restoreTransaction(tx, clean.api)
    expect(ok.conflicts).toEqual([])
    expect(ok.transaction.restoreStatus).toBe('restored')
    expect(clean.state).toEqual({ streaming_fps: 30, chat_truncation: 100, unrelated: 'keep' })

    const conflictH = actionBridge({ streaming_fps: 20, chat_truncation: 50 })
    const blocked = await restoreTransaction(tx, conflictH.api)
    expect(blocked.conflicts).toEqual([{ field: 'streaming_fps', before: 30, after: 15, current: 20 }])
    expect(conflictH.api.writeGroup).not.toHaveBeenCalled()

    const forced = await restoreTransaction(tx, conflictH.api, ['streaming_fps'])
    expect(forced.transaction.restoreStatus).toBe('restored')
    expect(conflictH.state).toEqual({ streaming_fps: 30, chat_truncation: 100 })
  })

  it('computes comparable deltas, withholds non-comparable diffs, and formats the 8 summary rows', () => {
    const before = makeMeasurement({
      metrics: {
        heap: { usedBytes: 120 * 1024 * 1024 },
        page: { chatNodeCount: 900, messageCount: 80 },
        media: { images: 6, videos: 1, audio: 1, canvas: 1, iframes: 1 },
        dynamic: { longTaskCount: 3, longestTaskMs: 90, frameIntervalP95Ms: 28, timerDelayP95Ms: 12 },
      },
    })
    const after = makeMeasurement({
      id: 'm2',
      metrics: {
        heap: { usedBytes: 100 * 1024 * 1024 },
        page: { chatNodeCount: 750, messageCount: 80 },
        media: { images: 5, videos: 1, audio: 1, canvas: 1, iframes: 1 },
        dynamic: { longTaskCount: 1, longestTaskMs: 55, frameIntervalP95Ms: 20, timerDelayP95Ms: 8 },
      },
    })
    const cmp = compareMeasurements(before, after)
    expect(cmp.comparable).toBe(true)
    const rows = summarizeMeasurementComparison(cmp)
    expect(rows).toHaveLength(8)
    expect(rows[0]).toMatchObject({ label: '网页内存', before: '120.0 MB', after: '100.0 MB', change: '减少 20.0 MB' })
    expect(rows[5]).toMatchObject({ label: '最长卡顿', before: '90 ms', after: '55 ms', change: '减少 35 ms' })

    for (const [overrides, reason] of [
      [{ chatKey: 'other' }, '聊天不同'],
      [{ probe: 'controlledScroll' as const }, '检查方式不同'],
      [{ foreground: false }, '页面状态不同'],
      [{ durationMs: 5000 }, '检查时长不同'],
      [{ invalidReason: 'cancelled' }, '检查无效'],
      [{ capabilities: [{ id: 'longTasks', available: false, reason: 'x' }] }, '可读取的数据不同'],
    ] as Array<[Partial<MeasurementSnapshot>, string]>) {
      const diff = compareMeasurements(before, makeMeasurement(overrides))
      expect(diff.comparable).toBe(false)
      expect(diff.reasons).toContain(reason)
      expect(summarizeMeasurementComparison(diff).every((r) => r.change === '不计算')).toBe(true)
    }
  })
})

describe('diagnosis & safe plan', () => {
  it('only moves settings toward lower rendering cost without raising FPS or exceeding device truncation bounds', () => {
    for (const [field, before, requested] of [
      ['fast_ui_mode', false, true],
      ['reduced_motion', false, true],
      ['noShadows', false, true],
      ['smooth_streaming', true, false],
      ['stream_fade_in', true, false],
    ] as const) {
      expect(buildSafePlan(makePerf({ [field]: before }), 'desktop').actions)
        .toContainEqual(expect.objectContaining({ field, before, requested }))
      expect(buildSafePlan(makePerf({ [field]: requested }), 'desktop').actions)
        .not.toContainEqual(expect.objectContaining({ field }))
    }

    for (const [device, fps, expectedFps, trunc, expectedTrunc] of [
      ['desktop', 30, 15, 0, 50],
      ['desktop', 10, 10, 25, 25],
      ['mobile', 8, 8, 100, 20],
      ['mobile', 25, 15, 15, 15],
    ] as const) {
      const plan = buildSafePlan(makePerf({ streaming_fps: fps, chat_truncation: trunc }), device)
      const all = [...plan.actions, ...plan.unchanged]
      expect(all.find((a) => a.field === 'streaming_fps')?.requested).toBe(expectedFps)
      expect(all.find((a) => a.field === 'chat_truncation')?.requested).toBe(expectedTrunc)
    }
    expect(buildSafePlan(makePerf(), 'mobile').actions.find((a) => a.field === 'chat_truncation')?.reloadRequired).toBe(true)
  })

  it('emits explainable findings, respects capability/Long-Task boundaries, and keeps extension evidence non-causal', () => {
    const baseFindings = diagnose(makeMeasurement(), makePerf())
    const blur = baseFindings.find((f) => f.id === 'setting-no-blur')!
    expect(Object.keys(blur.explanation).sort()).toEqual(['change', 'detected', 'impact', 'reason', 'reload', 'restore', 'result'])
    expect(JSON.stringify(baseFindings)).not.toMatch(/综合分|评分/)

    const optimized = makePerf({
      fast_ui_mode: true, reduced_motion: true, noShadows: true,
      smooth_streaming: false, stream_fade_in: false, streaming_fps: 15, chat_truncation: 20,
    })
    expect(diagnose(makeMeasurement(), optimized).filter((f) => f.confidence === 'setting')).toEqual([])

    expect(diagnose(makeMeasurement({ metrics: { dynamic: { longTaskCount: 1, longestTaskMs: 49 } } }), null)
      .some((f) => f.id === 'measured-long-tasks')).toBe(false)
    expect(diagnose(makeMeasurement({ metrics: { dynamic: { longTaskCount: 1, longestTaskMs: 99 } } }), null)
      .find((f) => f.id === 'measured-long-tasks')?.severity).toBe('suggestion')
    expect(diagnose(makeMeasurement({ metrics: { dynamic: { longTaskCount: 1, longestTaskMs: 100 } } }), null)
      .find((f) => f.id === 'measured-long-tasks')?.severity).toBe('risk')

    const extEvidence = diagnose(makeMeasurement({
      metrics: { resources: { groups: [{ key: 'extension:third-party/demo', count: 3, transferSize: 1000, durationMs: 80 }] } },
    }), null).find((f) => f.id === 'extension-resource-evidence')!
    expect(extEvidence.confidence).toBe('correlation')
    expect(extEvidence.actionId).toBeUndefined()
    expect(JSON.stringify(extEvidence.explanation)).not.toMatch(/就是|导致卡顿|元凶|证明|A\/B|临时关闭/)

    const unavailable = makeMeasurement({ metrics: { dynamic: { longTaskCount: 3, longestTaskMs: 200 } } })
    unavailable.capabilities = [{ id: 'longTasks', available: false, reason: 'unsupported' }]
    expect(diagnose(unavailable, null).some((f) => f.confidence === 'measurement')).toBe(false)
  })
})

describe('experiments, emergency backup & system extension advisor', () => {
  function harness(disabled: string[] = []) {
    let currentDisabled = [...disabled]
    const storage = new Map<string, string>()
    const failNames = new Set<string>()
    const extensions: ExtensionInventoryItem[] = ['third-party/st-stage', 'third-party/a', 'third-party/b'].map((name) => ({
      name,
      type: 'local',
      configuredEnabled: true,
      isSelf: name === 'third-party/st-stage',
      manifest: { dependencies: { status: 'valid', names: [] }, requiredModules: { status: 'absent', names: [] } },
    }))
    const deps: ExtensionExperimentDependencies = {
      readExtensions: vi.fn(async (): Promise<Extract<ExtensionInventoryResult, { status: 'ready' }>> => ({
        status: 'ready',
        governance: { writable: true },
        disabledExtensions: currentDisabled,
        extensions: extensions.map((ext) => ({ ...ext, configuredEnabled: !currentDisabled.includes(ext.name) })),
      })),
      setExtensionEnabled: vi.fn(async (name, enabled): Promise<ExtensionWriteResult> => {
        if (failNames.has(name)) return { ok: false, code: 'api-error', error: `failed ${name}` }
        currentDisabled = enabled ? currentDisabled.filter((v) => v !== name) : [...new Set([...currentDisabled, name])]
        return { ok: true, name, configuredEnabled: enabled, reloadRequired: true }
      }),
      persistExperiment: vi.fn(async () => undefined),
      reloadPage: vi.fn().mockResolvedValue(undefined),
      now: vi.fn(() => 100),
      createId: vi.fn(() => 'exp-1'),
      backupStorage: {
        getItem: vi.fn((k) => storage.get(k) ?? null),
        setItem: vi.fn((k, v) => { storage.set(k, v) }),
        removeItem: vi.fn((k) => { storage.delete(k) }),
      },
    }
    return { deps, storage, failNames, getDisabled: () => [...currentDisabled] }
  }

  it('manages emergency backups, guards st-stage during batch disable, and recovers legacy experiments', async () => {
    const backup = buildEmergencyBackup(['third-party/a'], 123)
    expect(buildEmergencyBackup.recoveryCommand(backup)).toContain("import('/scripts/extensions.js')")

    const h = harness(['third-party/a'])
    h.storage.set('st-stage:butler:extension-recovery:v1', JSON.stringify({ version: 1, createdAt: 123, disabledExtensions: ['third-party/b', 'third-party/a', 'third-party/a'] }))
    expect(readEmergencyBackup(h.deps.backupStorage)?.disabledExtensions).toEqual(['third-party/a', 'third-party/b'])
    h.storage.set('st-stage:butler:extension-recovery:v1', JSON.stringify({ version: 1, createdAt: 123, disabledExtensions: [42] }))
    expect(readEmergencyBackup(h.deps.backupStorage)).toBeNull()

    const restoredBackup = await restoreEmergencyExtensionBackup(buildEmergencyBackup([], 123), h.deps)
    expect(restoredBackup.ok).toBe(true)
    expect(h.getDisabled()).toEqual([])
    expect(h.deps.reloadPage).toHaveBeenCalledOnce()

    const selfBlocked = await applyDesiredDisabledExtensions(['third-party/st-stage'], h.deps)
    expect(selfBlocked.ok).toBe(false)
    expect(h.deps.setExtensionEnabled).not.toHaveBeenCalledWith('third-party/st-stage', false)

    const partial = harness()
    partial.failNames.add('third-party/b')
    const partialRes = await applyDesiredDisabledExtensions(['third-party/a', 'third-party/b'], partial.deps)
    expect(partialRes.ok).toBe(false)
    expect(partial.deps.reloadPage).not.toHaveBeenCalled()

    const legacyH = harness(['third-party/a', 'third-party/b'])
    const legacy: ButlerExperiment = {
      id: 'exp-1', kind: 'selectedExtensions', status: 'awaitingReload', startedAt: 50,
      originalDisabledExtensions: ['third-party/b'], candidateExtensions: ['third-party/a'], currentRound: 1,
    }
    const resumed = resumeExtensionExperiment(legacy)
    expect(resumed.status).toBe('sampling')
    const finished = await finishExtensionExperiment({ ...resumed, status: 'awaitingDecision' }, 'restore', legacyH.deps)
    expect(finished.status).toBe('completed')
    expect(legacyH.getDisabled()).toEqual(['third-party/b'])
  })

  it('classifies known built-in extensions without fake numbers and leaves unknown ones null', () => {
    const allowed: SystemExtensionRecommendation[] = ['保留', '不用时可临时关闭', '排障时可临时关闭观察']
    for (const name of ['expressions', 'gallery', 'memory', 'quick-reply', 'regex', 'stable-diffusion', 'translate', 'tts', 'vectors']) {
      const advice = getSystemExtensionAdvice(name)!
      expect(allowed).toContain(advice.recommendation)
      expect(`${advice.purpose}${advice.whenNeeded}${advice.disabledImpact}`).not.toMatch(/占用\s*\d|耗时\s*\d/)
    }
    expect(getSystemExtensionAdvice('future-system-extension')).toBeNull()
  })
})

describe('history budget & data migrations', () => {
  function historyRecord(index: number, summary = `记录 ${index}`): ButlerHistoryRecord {
    return {
      id: `history-${index}`,
      kind: 'measurement',
      createdAt: index,
      completedAt: index + 1,
      outcome: 'completed',
      summary: { label: summary },
      measurement: makeMeasurement({ id: `measurement-${index}`, createdAt: index, durationMs: 0, probe: 'static' }),
    }
  }

  it('enforces 10-item cap, UTF-8 byte budget, baseline pinning, and protected-slot preservation', () => {
    expect(utf8JsonBytes({ text: '管家' })).toBe(new TextEncoder().encode(JSON.stringify({ text: '管家' })).byteLength)

    const tx: ButlerTransaction = {
      id: 'tx', group: 'performanceSettings', createdAt: 100, status: 'applied', restoreStatus: 'available',
      baselineMeasurementId: 'measurement-1', before: { streaming_fps: 10 }, requested: { streaming_fps: 15 }, actual: { streaming_fps: 10 },
      actions: [{ ...makeAction('streaming_fps', 10, 15), actual: 15, status: 'applied' }],
    }
    const capped = fitButlerDataBudget({
      ...createEmptyButlerData(),
      activeTransaction: tx,
      history: Array.from({ length: 12 }, (_, i) => historyRecord(i + 1)),
    }, 1_000_000)
    expect(capped.data.history).toHaveLength(10)
    expect(capped.data.history.some((r) => r.kind === 'measurement' && r.measurement.id === 'measurement-1')).toBe(true)

    const overBudget = fitButlerDataBudget({
      ...createEmptyButlerData(),
      activeTransaction: { ...tx, before: { note: '快照'.repeat(300) } },
      history: [historyRecord(99)],
    }, 256)
    expect(overBudget.status).toBe('protected-over-budget')
    expect(overBudget.historyAccepted).toBe(false)
    expect(overBudget.data.history).toEqual([])
    expect(overBudget.data.activeTransaction).not.toBeNull()
  })

  it('migrates legacy shapes, isolates broken recovery slots with warnings, filters malformed history, and strips unknown fields', () => {
    expect(migrateButlerData('{broken')).toEqual(createEmptyButlerData())
    expect(migrateButlerData({ snapshot: { streaming_fps: 10 }, perfOn: true })).toMatchObject({
      version: 2, performanceModeOn: false, activeTransaction: null,
    })

    const valid: ButlerDataV2 = {
      version: 2,
      performanceModeOn: true,
      activeTransaction: {
        id: 'tx-1', group: 'performanceSettings', createdAt: 100, completedAt: 110, status: 'applied', restoreStatus: 'available',
        before: { streaming_fps: 30 }, requested: { streaming_fps: 15 }, actual: { streaming_fps: 15 },
        actions: [{ ...makeAction('streaming_fps', 30, 15), actual: 15, status: 'applied' }],
      },
      pendingExperiment: {
        id: 'exp-1', kind: 'selectedExtensions', status: 'awaitingReload', startedAt: 300,
        originalDisabledExtensions: ['third-party/old'], candidateExtensions: ['third-party/example'], currentRound: 1,
      },
      history: [historyRecord(99)],
    }

    const brokenTx = migrateButlerData({ ...valid, activeTransaction: { broken: true } })
    expect(brokenTx.activeTransaction).toBeNull()
    expect(brokenTx.recoveryWarnings).toEqual(['performance'])
    expect(brokenTx.pendingExperiment).toEqual(valid.pendingExperiment)

    const emptyActions = migrateButlerData({
      ...valid,
      activeTransaction: { ...valid.activeTransaction!, actions: [] },
    })
    expect(emptyActions.activeTransaction).toBeNull()

    const badHistory = migrateButlerData({
      ...valid,
      history: [{ ...historyRecord(1), kind: 'transaction' }, historyRecord(2)],
    })
    expect(badHistory.history).toEqual([historyRecord(2)])

    const dirty = { ...structuredClone(valid), extraField: 'strip-me' } as Record<string, unknown>
    const cleaned = migrateButlerData(dirty)
    expect(cleaned).toEqual(valid)
    expect(cleaned).not.toHaveProperty('extraField')
  })
})

describe('self-identity & SillyTavern module contracts', () => {
  it('resolves install directory safely across renamed/query/invalid URLs and matches self case-insensitively', () => {
    expect(installDirectoryName('https://host/scripts/extensions/third-party/st-stage/bundle.js')).toBe('st-stage')
    expect(installDirectoryName('https://host/scripts/extensions/third-party/st-butler/bundle.js?v=1#x')).toBe('st-butler')
    expect(installDirectoryName('https://host/scripts/extensions/st-stage/bundle.js')).toBe('st-stage')
    for (const bad of ['', 'bundle.js', 'https://host/scripts/extensions/third-party/bundle.js', 'file:///D:/proj/st-extension/src/apps/butler/self-identity.ts']) {
      expect(installDirectoryName(bad)).toBe(FALLBACK_DIRECTORY_NAME)
    }
    expect(selfExtensionNames('st-stage')).toEqual(['st-stage', 'third-party/st-stage'])
    expect(selfExtensionNames('third-party/st-stage')).toEqual(['third-party/st-stage'])
    expect(matchesSelf('third-party/ST-Stage', 'st-stage')).toBe(true)
    expect(matchesSelf('third-party/st-stage', 'st-butler')).toBe(false)
    expect(matchesSelf('third-party/st-stage-fork', 'st-stage')).toBe(false)
  })

  it('validates ST 1.18 extension/power-user module contracts and strips sensitive manifest fields', () => {
    const baseMod = () => ({
      extensionNames: ['expressions', 'third-party/st-stage'],
      extensionTypes: { expressions: 'system', 'third-party/st-stage': 'local' },
      extension_settings: { disabledExtensions: [] },
      findExtension: vi.fn(),
      getExtensionManifest: vi.fn(),
      enableExtension: vi.fn(),
      disableExtension: vi.fn(),
    })
    expect(inspectExtensionModule(baseMod())).toMatchObject({ status: 'ready', governance: { writable: true } })

    for (const required of ['extensionNames', 'extensionTypes', 'extension_settings', 'findExtension', 'getExtensionManifest']) {
      const m = baseMod() as Record<string, unknown>
      delete m[required]
      expect(inspectExtensionModule(m).status).toBe('unavailable')
    }
    for (const writeFn of ['enableExtension', 'disableExtension']) {
      const m = baseMod() as Record<string, unknown>
      delete m[writeFn]
      expect(inspectExtensionModule(m)).toMatchObject({ status: 'ready', governance: { writable: false } })
    }

    const fn = vi.fn()
    expect(inspectPowerUserModule({ applyPowerUserSettings: fn })).toEqual({ available: true, applyPowerUserSettings: fn })
    expect(inspectPowerUserModule({ applyPowerUserSettings: true }).available).toBe(false)

    const manifest = summarizeExtensionManifest({
      display_name: 'Tool', version: '1.0.0', dependencies: ['third-party/base'], api_key: 'secret',
    })
    expect(manifest?.dependencies).toEqual({ status: 'valid', names: ['third-party/base'] })
    expect(JSON.stringify(manifest)).not.toContain('secret')
    expect(summarizeExtensionManifest('not-an-object')).toBeNull()
  })
})
