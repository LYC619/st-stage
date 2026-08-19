import type {
  ButlerAction,
  ButlerActionGroup,
  ButlerTransaction,
  JsonValue,
  MeasurementSummaryRow,
  MeasurementSnapshot,
} from './types'

export interface ButlerActionBridge {
  readGroup(group: ButlerActionGroup): Promise<Record<string, JsonValue>>
  writeGroup(group: ButlerActionGroup, fields: Record<string, JsonValue>): Promise<void>
  persistTransaction(transaction: ButlerTransaction): Promise<void>
  now(): number
  createId(): string
}

export interface RestoreConflict {
  field: string
  before: JsonValue
  after: JsonValue
  current: JsonValue | undefined
}

export interface RestoreResult {
  transaction: ButlerTransaction
  conflicts: RestoreConflict[]
}

export interface MeasurementComparison {
  comparable: boolean
  reasons: string[]
  before: Record<string, JsonValue>
  after: Record<string, JsonValue>
  deltas: Record<string, number>
}

function errorText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '未知错误'
}

function equalJson(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  if (left === right) return true
  return JSON.stringify(left) === JSON.stringify(right)
}

function cloneActions(actions: ButlerAction[]): ButlerAction[] {
  return actions.map((action) => ({ ...action }))
}

export async function applyTransaction(
  inputActions: ButlerAction[],
  bridge: ButlerActionBridge,
  baselineMeasurementId?: string,
): Promise<ButlerTransaction> {
  const actions = cloneActions(inputActions)
  const group = actions[0]?.group ?? 'performanceSettings'
  if (actions.some((action) => action.group !== group)) throw new Error('事务内动作必须属于同一分组')

  const current = await bridge.readGroup(group)
  const before: Record<string, JsonValue> = {}
  const requested: Record<string, JsonValue> = {}
  for (const action of actions) {
    const actualBefore = current[action.field]
    if (actualBefore !== undefined) action.before = actualBefore
    before[action.field] = action.before
    requested[action.field] = action.requested
  }
  const transaction: ButlerTransaction = {
    id: bridge.createId(),
    group,
    createdAt: bridge.now(),
    status: 'applying',
    restoreStatus: 'available',
    ...(baselineMeasurementId ? { baselineMeasurementId } : {}),
    before,
    requested,
    actual: { ...before },
    actions,
  }
  await bridge.persistTransaction(transaction)

  for (const action of actions) {
    if (action.status === 'unchanged' || equalJson(action.before, action.requested)) {
      action.status = 'unchanged'
      action.actual = action.before
      transaction.actual[action.field] = action.before
      continue
    }
    try {
      await bridge.writeGroup(group, { [action.field]: action.requested })
      const reread = await bridge.readGroup(group)
      action.actual = reread[action.field] ?? null
      transaction.actual[action.field] = action.actual
      if (equalJson(action.actual, action.requested)) {
        action.status = 'applied'
      } else {
        action.status = 'failed'
        action.error = 'SillyTavern 实际值与请求值不一致'
      }
    } catch (error) {
      action.status = 'failed'
      action.error = errorText(error)
      const reread = await bridge.readGroup(group)
      action.actual = reread[action.field] ?? null
      transaction.actual[action.field] = action.actual
    }
  }

  const changed = actions.filter((action) => action.status !== 'unchanged')
  const applied = changed.filter((action) => action.status === 'applied').length
  const failed = changed.filter((action) => action.status === 'failed').length
  transaction.status = failed === 0
    ? 'applied'
    : applied > 0
      ? 'partial'
      : 'failed'
  transaction.completedAt = bridge.now()
  transaction.actual = { ...(await bridge.readGroup(group)) }
  await bridge.persistTransaction(transaction)
  return transaction
}

export async function restoreTransaction(
  source: ButlerTransaction,
  bridge: ButlerActionBridge,
  confirmedConflictFields: string[] = [],
): Promise<RestoreResult> {
  const transaction: ButlerTransaction = {
    ...source,
    before: { ...source.before },
    requested: { ...source.requested },
    actual: { ...source.actual },
    actions: cloneActions(source.actions),
    restoreStatus: 'restoring',
  }
  await bridge.persistTransaction(transaction)
  const current = await bridge.readGroup(transaction.group)
  const confirmed = new Set(confirmedConflictFields)
  const conflicts: RestoreConflict[] = []
  const fieldsToRestore: Array<[string, JsonValue]> = []

  for (const [field, before] of Object.entries(transaction.before)) {
    const after = transaction.actual[field] ?? transaction.requested[field]
    const value = current[field]
    if (equalJson(value, before)) continue
    if (!equalJson(value, after) && !confirmed.has(field)) {
      conflicts.push({ field, before, after, current: value })
      continue
    }
    fieldsToRestore.push([field, before])
  }

  if (conflicts.length > 0) {
    transaction.restoreStatus = 'conflict'
    await bridge.persistTransaction(transaction)
    return { transaction, conflicts }
  }

  try {
    for (const [field, before] of fieldsToRestore) {
      await bridge.writeGroup(transaction.group, { [field]: before })
    }
    const restored = await bridge.readGroup(transaction.group)
    const failedFields = Object.entries(transaction.before).filter(([field, before]) => (
      !equalJson(restored[field], before)
    ))
    if (failedFields.length > 0) {
      transaction.restoreStatus = 'conflict'
      transaction.error = `恢复后 ${failedFields.map(([field]) => field).join('、')} 未回到原值`
    } else {
      transaction.status = 'restored'
      transaction.restoreStatus = 'restored'
      transaction.completedAt = bridge.now()
      delete transaction.error
    }
  } catch (error) {
    transaction.restoreStatus = 'conflict'
    transaction.error = `恢复失败：${errorText(error)}`
  }
  await bridge.persistTransaction(transaction)
  return { transaction, conflicts: [] }
}

function capabilitySignature(snapshot: MeasurementSnapshot): string {
  return [...snapshot.capabilities]
    .map((capability) => `${capability.id}:${capability.available ? '1' : '0'}`)
    .sort()
    .join('|')
}

function flattenNumbers(
  value: JsonValue,
  prefix = '',
  output: Record<string, number> = {},
): Record<string, number> {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (prefix) output[prefix] = value
    return output
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return output
  for (const [key, child] of Object.entries(value)) {
    flattenNumbers(child, prefix ? `${prefix}.${key}` : key, output)
  }
  return output
}

export function compareMeasurements(
  before: MeasurementSnapshot,
  after: MeasurementSnapshot,
): MeasurementComparison {
  const reasons: string[] = []
  if (before.invalidReason || after.invalidReason) reasons.push('检查无效')
  if (!before.chatKey || !after.chatKey || before.chatKey !== after.chatKey) reasons.push('聊天不同')
  if (before.probe !== after.probe) reasons.push('检查方式不同')
  if (!before.foreground || !after.foreground || before.foreground !== after.foreground) reasons.push('页面状态不同')
  if (before.durationMs !== after.durationMs || before.durationMs !== 6000) reasons.push('检查时长不同')
  if (capabilitySignature(before) !== capabilitySignature(after)) reasons.push('可读取的数据不同')

  const deltas: Record<string, number> = {}
  if (reasons.length === 0) {
    const beforeNumbers = flattenNumbers(before.metrics)
    const afterNumbers = flattenNumbers(after.metrics)
    for (const [key, beforeValue] of Object.entries(beforeNumbers)) {
      const afterValue = afterNumbers[key]
      if (afterValue !== undefined) deltas[key] = afterValue - beforeValue
    }
  }
  return {
    comparable: reasons.length === 0,
    reasons,
    before: before.metrics,
    after: after.metrics,
    deltas,
  }
}

type SummaryUnit = 'bytes' | 'count' | 'milliseconds'

interface SummaryMetric {
  id: string
  label: string
  unit: SummaryUnit
  read(metrics: Record<string, JsonValue>): number | null
  explanation: string
}

function metricNumber(metrics: Record<string, JsonValue>, path: string[]): number | null {
  let current: JsonValue = metrics
  for (const segment of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null
    current = current[segment]
  }
  return typeof current === 'number' && Number.isFinite(current) ? current : null
}

function mediaCount(metrics: Record<string, JsonValue>): number | null {
  const values = ['images', 'videos', 'audio', 'canvas', 'iframes']
    .map((key) => metricNumber(metrics, ['media', key]))
  const available = values.filter((value): value is number => value !== null)
  return available.length > 0 ? available.reduce((sum, value) => sum + value, 0) : null
}

const SUMMARY_METRICS: SummaryMetric[] = [
  {
    id: 'heap.usedBytes',
    label: '网页内存',
    unit: 'bytes',
    read: (metrics) => metricNumber(metrics, ['heap', 'usedBytes']),
    explanation: '受浏览器垃圾回收和缓存影响，单次升降不能单独证明优化有效。',
  },
  {
    id: 'page.chatNodeCount',
    label: '页面节点',
    unit: 'count',
    read: (metrics) => metricNumber(metrics, ['page', 'chatNodeCount']),
    explanation: '用于观察聊天页面规模；聊天内容不同会直接改变数量。',
  },
  {
    id: 'page.messageCount',
    label: '消息数',
    unit: 'count',
    read: (metrics) => metricNumber(metrics, ['page', 'messageCount']),
    explanation: '用于确认两次检查的聊天规模是否接近，本身不代表快慢。',
  },
  {
    id: 'media.total',
    label: '图片 / 媒体数',
    unit: 'count',
    read: mediaCount,
    explanation: '汇总图片、视频、音频、画布和内嵌页面，只作为资源规模参照。',
  },
  {
    id: 'dynamic.longTaskCount',
    label: '6 秒长任务',
    unit: 'count',
    read: (metrics) => metricNumber(metrics, ['dynamic', 'longTaskCount']),
    explanation: '主线程连续占用 50 ms 以上的次数；同条件下越少通常越流畅。',
  },
  {
    id: 'dynamic.longestTaskMs',
    label: '最长卡顿',
    unit: 'milliseconds',
    read: (metrics) => metricNumber(metrics, ['dynamic', 'longestTaskMs']),
    explanation: '6 秒检查中最长一次主线程占用；同条件下越短越好。',
  },
  {
    id: 'dynamic.frameIntervalP95Ms',
    label: '95% 帧间隔',
    unit: 'milliseconds',
    read: (metrics) => metricNumber(metrics, ['dynamic', 'frameIntervalP95Ms']),
    explanation: '大多数画面更新之间的间隔；同条件下越低通常越顺滑。',
  },
  {
    id: 'dynamic.timerDelayP95Ms',
    label: '定时器延迟',
    unit: 'milliseconds',
    read: (metrics) => metricNumber(metrics, ['dynamic', 'timerDelayP95Ms']),
    explanation: '大多数定时任务额外等待的时间；同条件下越低越好。',
  },
]

function formatSummaryValue(value: number | null, unit: SummaryUnit): string {
  if (value === null) return '未读取到'
  if (unit === 'bytes') return `${(value / 1024 / 1024).toFixed(1)} MB`
  if (unit === 'count') return `${Number.isInteger(value) ? value : value.toFixed(1)} 项`
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ms`
}

function formatSummaryChange(
  before: number | null,
  after: number | null,
  unit: SummaryUnit,
  comparable: boolean,
): string {
  if (!comparable || before === null || after === null) return '不计算'
  const delta = after - before
  if (delta === 0) return '无变化'
  return `${delta < 0 ? '减少' : '增加'} ${formatSummaryValue(Math.abs(delta), unit)}`
}

export function summarizeMeasurementComparison(
  comparison: MeasurementComparison,
): MeasurementSummaryRow[] {
  return SUMMARY_METRICS.map((metric) => {
    const before = metric.read(comparison.before)
    const after = metric.read(comparison.after)
    return {
      id: metric.id,
      label: metric.label,
      before: formatSummaryValue(before, metric.unit),
      after: formatSummaryValue(after, metric.unit),
      change: formatSummaryChange(before, after, metric.unit, comparison.comparable),
      explanation: metric.explanation,
    }
  })
}
