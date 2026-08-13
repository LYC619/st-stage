import {
  BUTLER_DATA_BUDGET_BYTES,
  BUTLER_HISTORY_LIMIT,
  type ButlerDataV2,
  type ButlerHistoryRecord,
} from './types'

export type ButlerBudgetStatus = 'ok' | 'evicted' | 'protected-over-budget' | 'data-over-budget'

export interface ButlerBudgetResult {
  data: ButlerDataV2
  bytes: number
  budgetBytes: number
  status: ButlerBudgetStatus
  historyAccepted: boolean
  evictedIds: string[]
}

export function utf8JsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

function protectedMeasurementIds(data: ButlerDataV2): Set<string> {
  return new Set([
    data.activeTransaction?.baselineMeasurementId,
    data.pendingExperiment?.baselineMeasurementId,
    data.pendingExperiment?.comparisonMeasurementId,
  ].filter((id): id is string => Boolean(id)))
}

function oldestRecordIndex(history: ButlerHistoryRecord[], protectedIds: Set<string>): number {
  let oldestIndex = -1
  for (let index = 0; index < history.length; index += 1) {
    const record = history[index]
    if (record.kind === 'measurement' && protectedIds.has(record.measurement.id)) continue
    if (oldestIndex < 0) {
      oldestIndex = index
      continue
    }
    const candidate = history[index]
    const oldest = history[oldestIndex]
    if (candidate.createdAt < oldest.createdAt
      || (candidate.createdAt === oldest.createdAt && candidate.completedAt < oldest.completedAt)) {
      oldestIndex = index
    }
  }
  return oldestIndex
}

function withoutOldest(
  history: ButlerHistoryRecord[],
  evictedIds: string[],
  protectedIds: Set<string>,
): ButlerHistoryRecord[] | null {
  const next = [...history]
  const index = oldestRecordIndex(next, protectedIds)
  if (index < 0) return null
  const [removed] = next.splice(index, 1)
  evictedIds.push(removed.id)
  return next
}

export function fitButlerDataBudget(
  data: ButlerDataV2,
  budgetBytes = BUTLER_DATA_BUDGET_BYTES,
  candidateHistoryId?: string,
): ButlerBudgetResult {
  const evictedIds: string[] = []
  const protectedIds = protectedMeasurementIds(data)
  let history = [...data.history]

  while (history.length > BUTLER_HISTORY_LIMIT) {
    const next = withoutOldest(history, evictedIds, protectedIds)
    if (!next) break
    history = next
  }

  let fitted: ButlerDataV2 = { ...data, history }
  let bytes = utf8JsonBytes(fitted)
  while (bytes > budgetBytes && history.length > 0) {
    const next = withoutOldest(history, evictedIds, protectedIds)
    if (!next) break
    history = next
    fitted = { ...data, history }
    bytes = utf8JsonBytes(fitted)
  }

  if (bytes <= budgetBytes) {
    return {
      data: fitted,
      bytes,
      budgetBytes,
      status: evictedIds.length > 0 ? 'evicted' : 'ok',
      historyAccepted: candidateHistoryId === undefined
        ? true
        : fitted.history.some((record) => record.id === candidateHistoryId),
      evictedIds,
    }
  }

  const protectedStatePresent = data.activeTransaction !== null || data.pendingExperiment !== null || protectedIds.size > 0
  return {
    data: fitted,
    bytes,
    budgetBytes,
    status: protectedStatePresent ? 'protected-over-budget' : 'data-over-budget',
    historyAccepted: false,
    evictedIds,
  }
}
