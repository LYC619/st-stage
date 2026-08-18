import type {
  ButlerAction,
  ButlerActionGroup,
  ButlerTransaction,
  JsonValue,
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
