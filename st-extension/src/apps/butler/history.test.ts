import { describe, expect, it } from 'vitest'
import { fitButlerDataBudget, utf8JsonBytes } from './history'
import { createEmptyButlerData } from './migrations'
import type {
  ButlerDataV2,
  ButlerExperiment,
  ButlerHistoryRecord,
  MeasurementSnapshot,
  ButlerTransaction,
} from './types'

function measurement(index: number): MeasurementSnapshot {
  return {
    id: `measurement-${index}`,
    createdAt: index,
    durationMs: 0,
    probe: 'static',
    foreground: true,
    environment: {
      stVersion: { available: false, reason: '未读取' },
      stageBuild: { available: false, reason: '未读取' },
      mobile: { available: false, reason: '未读取' },
      settingsSummary: { available: false, reason: '未读取' },
      disabledExtensionsHash: { available: false, reason: '未读取' },
    },
    capabilities: [],
    metrics: {},
  }
}

function historyRecord(index: number, summary = `记录 ${index}`): ButlerHistoryRecord {
  return {
    id: `history-${index}`,
    kind: 'measurement',
    createdAt: index,
    completedAt: index + 1,
    outcome: 'completed',
    summary: { label: summary },
    measurement: measurement(index),
  }
}

function activeTransaction(payload = ''): ButlerTransaction {
  return {
    id: 'active-transaction',
    group: 'performanceSettings',
    createdAt: 100,
    status: 'applied',
    restoreStatus: 'available',
    before: { streaming_fps: 10, note: payload },
    requested: { streaming_fps: 15 },
    actual: { streaming_fps: 10 },
    actions: [],
  }
}

function pendingExperiment(payload = ''): ButlerExperiment {
  return {
    id: 'pending-experiment',
    kind: 'selectedExtensions',
    status: 'awaitingReload',
    startedAt: 200,
    originalDisabledExtensions: ['third-party/example'],
    candidateExtensions: ['third-party/example'],
    currentRound: 0,
    notes: payload,
  }
}

function withHistory(history: ButlerHistoryRecord[]): ButlerDataV2 {
  return { ...createEmptyButlerData(), history }
}

function protectedDataAtBytes(targetBytes: number): ButlerDataV2 {
  const data: ButlerDataV2 = {
    ...createEmptyButlerData(),
    activeTransaction: activeTransaction(''),
  }
  const baseBytes = utf8JsonBytes(data)
  const payloadBytes = targetBytes - baseBytes
  if (payloadBytes < 0) throw new Error('目标预算小于基础 Butler 数据')
  data.activeTransaction = activeTransaction('x'.repeat(payloadBytes))
  expect(utf8JsonBytes(data)).toBe(targetBytes)
  return data
}

describe('utf8JsonBytes', () => {
  it('按 JSON 序列化后的 UTF-8 字节计算中文', () => {
    const value = { text: '管家' }

    expect(utf8JsonBytes(value)).toBe(new TextEncoder().encode(JSON.stringify(value)).byteLength)
    expect(utf8JsonBytes(value)).toBeGreaterThan(JSON.stringify(value).length)
  })
})

describe('fitButlerDataBudget', () => {
  it('最多保留最近 10 条已完成历史', () => {
    const result = fitButlerDataBudget(withHistory(Array.from({ length: 12 }, (_, index) => historyRecord(index))), 1_000_000)

    expect(result.status).toBe('evicted')
    expect(result.evictedIds).toEqual(['history-0', 'history-1'])
    expect(result.data.history.map((record) => record.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `history-${index + 2}`),
    )
  })

  it('超出字节预算时先淘汰创建时间最早的历史记录', () => {
    const data = withHistory([
      historyRecord(30, '新'.repeat(160)),
      historyRecord(10, '旧'.repeat(160)),
      historyRecord(20, '中'.repeat(160)),
    ])
    const twoNewestOnly = withHistory([data.history[0], data.history[2]])
    const budget = utf8JsonBytes(twoNewestOnly)

    const result = fitButlerDataBudget(data, budget)

    expect(result.status).toBe('evicted')
    expect(result.evictedIds).toEqual(['history-10'])
    expect(result.data.history.map((record) => record.id)).toEqual(['history-30', 'history-20'])
    expect(result.bytes).toBeLessThanOrEqual(budget)
  })

  it('淘汰历史时绝不删除 active restore transaction 或 pending experiment', () => {
    const transaction = activeTransaction('恢复快照')
    const experiment = pendingExperiment('跨刷新状态')
    const data: ButlerDataV2 = {
      ...withHistory([historyRecord(1, '旧记录'.repeat(100))]),
      activeTransaction: transaction,
      pendingExperiment: experiment,
    }
    const protectedOnly: ButlerDataV2 = { ...data, history: [] }
    const budget = utf8JsonBytes(protectedOnly)

    const result = fitButlerDataBudget(data, budget)

    expect(result.data.activeTransaction).toEqual(transaction)
    expect(result.data.pendingExperiment).toEqual(experiment)
    expect(result.data.history).toEqual([])
    // 未指定候选 ID 时，historyAccepted 表示整份数据已成功压入预算。
    expect(result.historyAccepted).toBe(true)
    expect(result.bytes).toBeLessThanOrEqual(budget)
  })

  it('历史裁剪保留活动事务与扩展实验仍引用的测量基线', () => {
    const transaction = activeTransaction()
    transaction.baselineMeasurementId = 'measurement-1'
    const experiment = pendingExperiment()
    experiment.baselineMeasurementId = 'measurement-2'
    const data: ButlerDataV2 = {
      ...withHistory(Array.from({ length: 12 }, (_, index) => historyRecord(index + 1))),
      activeTransaction: transaction,
      pendingExperiment: experiment,
    }

    const result = fitButlerDataBudget(data, 1_000_000)

    expect(result.data.history).toHaveLength(10)
    expect(result.data.history.some((record) => record.kind === 'measurement' && record.measurement.id === 'measurement-1')).toBe(true)
    expect(result.data.history.some((record) => record.kind === 'measurement' && record.measurement.id === 'measurement-2')).toBe(true)
    expect(result.evictedIds).toEqual(['history-3', 'history-4'])
  })

  it('指定候选历史时仅在候选最终保留的情况下报告接受', () => {
    const old = historyRecord(1, '旧记录')
    const candidate = historyRecord(2, '新记录'.repeat(300))
    const data = withHistory([old, candidate])
    const budget = utf8JsonBytes(withHistory([old]))

    const result = fitButlerDataBudget(data, budget, candidate.id)

    expect(result.status).toBe('evicted')
    expect(result.evictedIds).toContain(candidate.id)
    expect(result.data.history).not.toContainEqual(candidate)
    expect(result.historyAccepted).toBe(false)
  })

  it('指定候选历史在淘汰旧记录后仍保留时报告接受', () => {
    const old = historyRecord(1, '旧记录'.repeat(300))
    const candidate = historyRecord(2, '新记录')
    const data = withHistory([old, candidate])
    const budget = utf8JsonBytes(withHistory([candidate]))

    const result = fitButlerDataBudget(data, budget, candidate.id)

    expect(result.data.history).toEqual([candidate])
    expect(result.historyAccepted).toBe(true)
  })

  it('受保护数据自身超预算时明确拒绝保存历史而不破坏恢复状态', () => {
    const transaction = activeTransaction('快照'.repeat(300))
    const experiment = pendingExperiment('实验'.repeat(300))
    const data: ButlerDataV2 = {
      ...withHistory([historyRecord(1)]),
      activeTransaction: transaction,
      pendingExperiment: experiment,
    }
    const budget = 256

    const result = fitButlerDataBudget(data, budget)

    expect(result.status).toBe('protected-over-budget')
    expect(result.historyAccepted).toBe(false)
    expect(result.data.history).toEqual([])
    expect(result.data.activeTransaction).toEqual(transaction)
    expect(result.data.pendingExperiment).toEqual(experiment)
    expect(result.bytes).toBeGreaterThan(budget)
  })

  it('默认 64 KiB 预算在临界值接受，超出 1 字节明确拒绝', () => {
    const exact = fitButlerDataBudget(protectedDataAtBytes(64 * 1024))
    const oneByteOver = fitButlerDataBudget(protectedDataAtBytes(64 * 1024 + 1))

    expect(exact).toMatchObject({
      status: 'ok',
      historyAccepted: true,
      bytes: 64 * 1024,
      budgetBytes: 64 * 1024,
    })
    expect(oneByteOver).toMatchObject({
      status: 'protected-over-budget',
      historyAccepted: false,
      bytes: 64 * 1024 + 1,
      budgetBytes: 64 * 1024,
    })
  })
})
