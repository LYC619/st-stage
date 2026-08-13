import { describe, expect, it } from 'vitest'
import { createEmptyButlerData, migrateButlerData } from './migrations'
import type {
  ButlerAction,
  ButlerDataV2,
  ButlerExperiment,
  ButlerHistoryRecord,
  ButlerTransaction,
  MeasurementSnapshot,
} from './types'

const legacySnapshot = {
  fast_ui_mode: false,
  reduced_motion: true,
  noShadows: true,
  smooth_streaming: false,
  stream_fade_in: false,
  streaming_fps: 10,
  chat_truncation: 25,
}

function action(): ButlerAction {
  return {
    id: 'action-1',
    group: 'performanceSettings',
    label: '降低流式帧率',
    field: 'streaming_fps',
    before: 30,
    requested: 15,
    actual: 15,
    status: 'applied',
    reloadRequired: false,
  }
}

function transaction(): ButlerTransaction {
  return {
    id: 'transaction-1',
    group: 'performanceSettings',
    createdAt: 100,
    completedAt: 110,
    status: 'applied',
    restoreStatus: 'available',
    baselineMeasurementId: 'measurement-1',
    before: { streaming_fps: 30 },
    requested: { streaming_fps: 15 },
    actual: { streaming_fps: 15 },
    actions: [action()],
  }
}

function measurement(): MeasurementSnapshot {
  return {
    id: 'measurement-1',
    createdAt: 200,
    durationMs: 6_000,
    probe: 'idle',
    foreground: true,
    chatKey: 'chat-hash',
    environment: {
      stVersion: { available: true, value: '1.18.0' },
      stageBuild: { available: true, value: '0.9.0+202608101952' },
      mobile: { available: true, value: false },
      settingsSummary: { available: true, value: { streaming_fps: 15 } },
      disabledExtensionsHash: { available: false, reason: '扩展接口不可用' },
    },
    capabilities: [
      { id: 'long-task', available: false, reason: '浏览器不支持' },
      { id: 'resource-timing', available: true },
    ],
    metrics: { renderedMessages: 24, layers: ['pageRendering', 'extensions'] },
  }
}

function experiment(): ButlerExperiment {
  return {
    id: 'experiment-1',
    kind: 'selectedExtensions',
    status: 'awaitingReload',
    startedAt: 300,
    originalDisabledExtensions: ['third-party/old'],
    candidateExtensions: ['third-party/example'],
    currentRound: 1,
    baselineMeasurementId: 'measurement-1',
    reloadRequiredAfterDecision: true,
  }
}

function history(): ButlerHistoryRecord[] {
  return [
    {
      id: 'history-measurement',
      kind: 'measurement',
      createdAt: 200,
      completedAt: 206,
      outcome: 'completed',
      summary: { label: '静置采样' },
      measurement: measurement(),
    },
    {
      id: 'history-transaction',
      kind: 'transaction',
      createdAt: 100,
      completedAt: 110,
      outcome: 'completed',
      summary: { label: '安全优化' },
      transaction: transaction(),
    },
    {
      id: 'history-experiment',
      kind: 'experiment',
      createdAt: 300,
      completedAt: 310,
      outcome: 'cancelled',
      summary: { label: '扩展 A/B' },
      experiment: { ...experiment(), status: 'completed', completedAt: 310 },
    },
  ]
}

function validV2(): ButlerDataV2 {
  return {
    version: 2,
    performanceModeOn: true,
    activeTransaction: transaction(),
    pendingExperiment: experiment(),
    history: history(),
  }
}

describe('migrateButlerData', () => {
  it('把旧 snapshot/perfOn 迁移成可恢复的 performanceSettings 分组事务', () => {
    const data = migrateButlerData(
      { snapshot: legacySnapshot, perfOn: true },
      { now: 1_723_456_789_000, idFactory: () => 'legacy-transaction' },
    )

    expect(data).toMatchObject({
      version: 2,
      performanceModeOn: true,
      activeTransaction: {
        id: 'legacy-transaction',
        group: 'performanceSettings',
        createdAt: 1_723_456_789_000,
        status: 'applied',
        restoreStatus: 'available',
        before: legacySnapshot,
        requested: {},
        actual: {},
      },
      pendingExperiment: null,
      history: [],
    })
  })

  it('旧数据未开启性能模式时迁移 performanceModeOn=false', () => {
    expect(migrateButlerData({ snapshot: legacySnapshot, perfOn: false }).performanceModeOn).toBe(false)
    expect(migrateButlerData({ snapshot: legacySnapshot }).performanceModeOn).toBe(false)
  })

  it('对 malformed 顶层数据安全回退为空 V2 数据', () => {
    const fallback = createEmptyButlerData()

    expect(migrateButlerData('{broken')).toEqual(fallback)
    expect(migrateButlerData({ snapshot: { streaming_fps: 'fast' }, perfOn: true })).toEqual(fallback)
    expect(migrateButlerData({ version: 2, history: 'not-an-array' })).toEqual(fallback)
  })

  it('activeTransaction 损坏时只清空该受保护槽并保留 pendingExperiment 与有效历史', () => {
    const input = validV2() as unknown as Record<string, unknown>
    const active = input.activeTransaction as Record<string, unknown>
    active.actions = [{ broken: true }]

    const normalized = migrateButlerData(input)

    expect(normalized.activeTransaction).toBeNull()
    expect(normalized.pendingExperiment).toEqual(experiment())
    expect(normalized.history).toEqual(history())
  })

  it('丢弃单条 malformed history 并保留恢复状态与其他有效历史', () => {
    const input = validV2() as unknown as Record<string, unknown>
    const records = input.history as Array<Record<string, unknown>>
    records[0].measurement = { broken: true }

    const normalized = migrateButlerData(input)

    expect(normalized.activeTransaction).toEqual(transaction())
    expect(normalized.pendingExperiment).toEqual(experiment())
    expect(normalized.history).toEqual(history().slice(1))
  })

  it('逐条丢弃 kind 与嵌套对象不匹配或混入其他 kind 对象的历史', () => {
    const wrongKind = validV2() as unknown as Record<string, unknown>
    const wrongRecords = wrongKind.history as Array<Record<string, unknown>>
    wrongRecords[0] = { ...wrongRecords[0], kind: 'transaction' }

    const mixedKind = validV2() as unknown as Record<string, unknown>
    const mixedRecords = mixedKind.history as Array<Record<string, unknown>>
    mixedRecords[0].transaction = transaction()

    expect(migrateButlerData(wrongKind).history).toEqual(history().slice(1))
    expect(migrateButlerData(mixedKind).history).toEqual(history().slice(1))
  })

  it('各自清空 malformed 受保护槽，并逐条丢弃 malformed 历史', () => {
    const badTransaction = validV2() as unknown as Record<string, unknown>
    const active = badTransaction.activeTransaction as Record<string, unknown>
    active.completedAt = 'later'

    const badExperiment = validV2() as unknown as Record<string, unknown>
    const pending = badExperiment.pendingExperiment as Record<string, unknown>
    pending.notes = 123

    const badMeasurement = validV2() as unknown as Record<string, unknown>
    const records = badMeasurement.history as Array<Record<string, unknown>>
    const snapshot = records[0].measurement as Record<string, unknown>
    const environment = snapshot.environment as Record<string, unknown>
    environment.disabledExtensionsHash = { available: false }

    expect(migrateButlerData(badTransaction)).toMatchObject({
      activeTransaction: null,
      pendingExperiment: experiment(),
      history: history(),
    })
    expect(migrateButlerData(badExperiment)).toMatchObject({
      activeTransaction: transaction(),
      pendingExperiment: null,
      history: history(),
    })
    expect(migrateButlerData(badMeasurement)).toMatchObject({
      activeTransaction: transaction(),
      pendingExperiment: experiment(),
      history: history().slice(1),
    })
  })

  it('activeTransaction 只保留尚可恢复的状态，pendingExperiment 只保留未结束状态', () => {
    const restoredTransaction = validV2() as unknown as Record<string, unknown>
    Object.assign(restoredTransaction.activeTransaction as object, {
      status: 'restored',
      restoreStatus: 'restored',
    })

    const unavailableTransaction = validV2() as unknown as Record<string, unknown>
    Object.assign(unavailableTransaction.activeTransaction as object, { restoreStatus: 'unavailable' })

    for (const status of ['completed', 'failed']) {
      const finishedExperiment = validV2() as unknown as Record<string, unknown>
      Object.assign(finishedExperiment.pendingExperiment as object, { status, completedAt: 320 })
      expect(migrateButlerData(finishedExperiment).pendingExperiment).toBeNull()
    }

    expect(migrateButlerData(restoredTransaction).activeTransaction).toBeNull()
    expect(migrateButlerData(unavailableTransaction).activeTransaction).toBeNull()
  })

  it('历史 transaction 和 experiment 只接受带完成时间的完成态', () => {
    const input = validV2() as unknown as Record<string, unknown>
    const records = input.history as Array<Record<string, unknown>>
    const transactionRecord = records[1].transaction as Record<string, unknown>
    transactionRecord.status = 'applying'
    delete transactionRecord.completedAt
    const experimentRecord = records[2].experiment as Record<string, unknown>
    experimentRecord.status = 'sampling'
    delete experimentRecord.completedAt

    expect(migrateButlerData(input).history).toEqual([history()[0]])
  })

  it('拒绝 action group 与所属 transaction group 不一致的事务', () => {
    const input = validV2() as unknown as Record<string, unknown>
    const active = input.activeTransaction as Record<string, unknown>
    const actions = active.actions as Array<Record<string, unknown>>
    actions[0].group = 'disabledExtensions'

    expect(migrateButlerData(input).activeTransaction).toBeNull()
  })

  it('合法 V2 会逐层深拷贝并清洗未知字段', () => {
    const input = validV2() as ButlerDataV2 & Record<string, unknown>
    input.unknownTopLevel = 'remove-me'
    const firstRecord = input.history[0] as ButlerHistoryRecord & Record<string, unknown>
    firstRecord.unknownHistoryField = 'remove-me'
    const sourceMetric = (firstRecord.measurement?.metrics.layers as string[])

    const normalized = migrateButlerData(input)

    expect(normalized).toEqual(validV2())
    expect(normalized).not.toBe(input)
    expect(normalized.activeTransaction).not.toBe(input.activeTransaction)
    expect(normalized.history).not.toBe(input.history)
    expect(normalized.history[0]).not.toBe(input.history[0])
    sourceMetric.push('mediaResourcesStorage')
    expect(normalized.history[0].measurement?.metrics.layers).toEqual(['pageRendering', 'extensions'])
    expect(normalized).not.toHaveProperty('unknownTopLevel')
    expect(normalized.history[0]).not.toHaveProperty('unknownHistoryField')
  })
})
