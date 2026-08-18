import { describe, expect, it, vi } from 'vitest'
import type { ButlerAction, ButlerActionGroup, ButlerTransaction, MeasurementSnapshot } from './types'
import {
  applyTransaction,
  compareMeasurements,
  restoreTransaction,
  type ButlerActionBridge,
} from './actions'

function action(field: string, before: unknown, requested: unknown, reloadRequired = false): ButlerAction {
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

function bridge(initial: Record<string, unknown>, failures: string[] = []) {
  const state = { ...initial }
  const order: string[] = []
  const persisted: ButlerTransaction[] = []
  const api: ButlerActionBridge = {
    readGroup: vi.fn(async (_group: ButlerActionGroup) => ({ ...state } as never)),
    writeGroup: vi.fn(async (_group, fields) => {
      const field = Object.keys(fields)[0]
      order.push(`write:${field}`)
      if (failures.includes(field)) throw new Error(`failed ${field}`)
      Object.assign(state, fields)
    }),
    persistTransaction: vi.fn(async (transaction) => {
      order.push(`persist:${transaction.status}`)
      persisted.push(structuredClone(transaction))
    }),
    now: vi.fn(() => 100),
    createId: vi.fn(() => 'tx-1'),
  }
  return { api, state, order, persisted }
}

describe('applyTransaction', () => {
  it('persists the transaction snapshot before the first ST write', async () => {
    const h = bridge({ streaming_fps: 30 })
    const result = await applyTransaction([action('streaming_fps', 30, 15)], h.api)

    expect(h.order[0]).toBe('persist:applying')
    expect(h.order[1]).toBe('write:streaming_fps')
    expect(result.before).toEqual({ streaming_fps: 30 })
  })

  it('rereads actual values rather than assuming requested values were applied', async () => {
    const h = bridge({ streaming_fps: 30 })
    vi.mocked(h.api.writeGroup).mockImplementation(async () => {
      h.order.push('write:streaming_fps')
      h.state.streaming_fps = 12
    })

    const result = await applyTransaction([action('streaming_fps', 30, 15)], h.api)

    expect(result.actual.streaming_fps).toBe(12)
    expect(result.actions[0]).toMatchObject({ actual: 12, status: 'failed' })
    expect(result.status).toBe('failed')
  })

  it('keeps successful fields and failure evidence on partial application', async () => {
    const h = bridge({ streaming_fps: 30, chat_truncation: 100 }, ['chat_truncation'])

    const result = await applyTransaction([
      action('streaming_fps', 30, 15),
      action('chat_truncation', 100, 50, true),
    ], h.api)

    expect(result.status).toBe('partial')
    expect(result.restoreStatus).toBe('available')
    expect(result.actions.map((item) => item.status)).toEqual(['applied', 'failed'])
    expect(result.actions[1].error).toContain('failed chat_truncation')
    expect(result.actions[1].reloadRequired).toBe(true)
    expect(h.state).toEqual({ streaming_fps: 15, chat_truncation: 100 })
  })

  it('does not write unchanged actions', async () => {
    const h = bridge({ streaming_fps: 10 })
    const unchanged = action('streaming_fps', 10, 10)
    unchanged.status = 'unchanged'

    const result = await applyTransaction([unchanged], h.api)

    expect(h.api.writeGroup).not.toHaveBeenCalled()
    expect(result.status).toBe('applied')
  })
})

function transaction(overrides: Partial<ButlerTransaction> = {}): ButlerTransaction {
  return {
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
      { ...action('streaming_fps', 30, 15), actual: 15, status: 'applied' },
      { ...action('chat_truncation', 100, 50, true), actual: 50, status: 'applied' },
    ],
    ...overrides,
  }
}

describe('restoreTransaction', () => {
  it('restores only the transaction group and marks the transaction restored', async () => {
    const h = bridge({ streaming_fps: 15, chat_truncation: 50, unrelated: 'keep' })
    const result = await restoreTransaction(transaction(), h.api)

    expect(result.conflicts).toEqual([])
    expect(result.transaction.status).toBe('restored')
    expect(result.transaction.restoreStatus).toBe('restored')
    expect(h.state).toEqual({ streaming_fps: 30, chat_truncation: 100, unrelated: 'keep' })
    expect(h.api.writeGroup).toHaveBeenCalledTimes(2)
  })

  it('does not overwrite a field changed by the user after application', async () => {
    const h = bridge({ streaming_fps: 20, chat_truncation: 50 })
    const result = await restoreTransaction(transaction(), h.api)

    expect(result.conflicts).toEqual([
      { field: 'streaming_fps', before: 30, after: 15, current: 20 },
    ])
    expect(result.transaction.restoreStatus).toBe('conflict')
    expect(h.api.writeGroup).not.toHaveBeenCalled()
  })

  it('allows explicitly confirmed conflict fields while preserving unrelated state', async () => {
    const h = bridge({ streaming_fps: 20, chat_truncation: 50, unrelated: 'keep' })
    const result = await restoreTransaction(transaction(), h.api, ['streaming_fps'])

    expect(result.conflicts).toEqual([])
    expect(result.transaction.restoreStatus).toBe('restored')
    expect(h.state).toEqual({ streaming_fps: 30, chat_truncation: 100, unrelated: 'keep' })
  })

  it('treats fields already equal to before as restored without rewriting them', async () => {
    const h = bridge({ streaming_fps: 30, chat_truncation: 50 })
    await restoreTransaction(transaction(), h.api)

    expect(h.api.writeGroup).toHaveBeenCalledTimes(1)
    expect(h.api.writeGroup).toHaveBeenCalledWith('performanceSettings', { chat_truncation: 100 })
  })
})

function measurement(overrides: Partial<MeasurementSnapshot> = {}): MeasurementSnapshot {
  return {
    id: 'm',
    createdAt: 1,
    durationMs: 6000,
    probe: 'idle',
    foreground: true,
    chatKey: 'chat-hash',
    environment: {
      stVersion: { available: true, value: '1.18.0' },
      stageBuild: { available: true, value: 'build' },
      mobile: { available: true, value: false },
      settingsSummary: { available: true, value: {} },
      disabledExtensionsHash: { available: true, value: 'hash' },
    },
    capabilities: [
      { id: 'longTasks', available: true },
      { id: 'jsHeap', available: false, reason: 'unsupported' },
    ],
    metrics: { dynamic: { longestTaskMs: 80, frameIntervalP95Ms: 32 }, page: { chatNodeCount: 100 } },
    ...overrides,
  }
}

describe('compareMeasurements', () => {
  it('computes raw numeric deltas only when all comparability gates match', () => {
    const before = measurement()
    const after = measurement({
      id: 'm2',
      metrics: { dynamic: { longestTaskMs: 50, frameIntervalP95Ms: 20 }, page: { chatNodeCount: 90 } },
    })
    const result = compareMeasurements(before, after)

    expect(result.comparable).toBe(true)
    expect(result.reasons).toEqual([])
    expect(result.deltas).toMatchObject({
      'dynamic.longestTaskMs': -30,
      'dynamic.frameIntervalP95Ms': -12,
      'page.chatNodeCount': -10,
    })
    expect(result.before).toBe(before.metrics)
    expect(result.after).toBe(after.metrics)
  })

  it.each([
    ['chat', { chatKey: 'other' }, '聊天不同'],
    ['probe', { probe: 'controlledScroll' as const }, '检查方式不同'],
    ['visibility', { foreground: false }, '页面状态不同'],
    ['duration', { durationMs: 5000 }, '检查时长不同'],
    ['invalid', { invalidReason: 'cancelled' }, '检查无效'],
    ['capability', { capabilities: [{ id: 'longTasks', available: false as const, reason: 'unsupported' }] }, '可读取的数据不同'],
  ])('falls back to raw values when %s differs', (_name, overrides, reason) => {
    const before = measurement()
    const after = measurement(overrides)
    const result = compareMeasurements(before, after)

    expect(result.comparable).toBe(false)
    expect(result.reasons).toContain(reason)
    expect(result.deltas).toEqual({})
    expect(result.before).toBe(before.metrics)
    expect(result.after).toBe(after.metrics)
  })
})
