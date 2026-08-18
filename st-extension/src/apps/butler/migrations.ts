import {
  BUTLER_DATA_VERSION,
  type ButlerAction,
  type ButlerCapability,
  type ButlerDataV2,
  type ButlerExperiment,
  type ButlerHistoryRecord,
  type ButlerObserved,
  type ButlerTransaction,
  type JsonValue,
  type MeasurementEnvironment,
  type MeasurementSnapshot,
  type PerformanceSettingsSnapshot,
} from './types'

interface MigrationOptions {
  now?: number
  idFactory?: () => string
}

type Normalized<T> = { ok: true; value: T } | { ok: false }

const INVALID: Normalized<never> = { ok: false }
const ACTION_GROUPS = ['performanceSettings', 'disabledExtensions', 'gameplaySettings'] as const
const ACTION_STATUSES = ['planned', 'applied', 'failed', 'unchanged'] as const
const TRANSACTION_STATUSES = ['planned', 'applying', 'applied', 'partial', 'failed', 'restored'] as const
const RESTORE_STATUSES = ['unavailable', 'available', 'restoring', 'conflict', 'restored'] as const
const EXPERIMENT_KINDS = ['selectedExtensions', 'binaryIsolation'] as const
const EXPERIMENT_STATUSES = [
  'prepared',
  'awaitingReload',
  'sampling',
  'awaitingDecision',
  'restoring',
  'completed',
  'failed',
] as const
const ACTIVE_TRANSACTION_STATUSES = ['planned', 'applying', 'applied', 'partial', 'failed'] as const
const ACTIVE_RESTORE_STATUSES = ['available', 'restoring', 'conflict'] as const
const COMPLETED_TRANSACTION_STATUSES = ['applied', 'partial', 'failed', 'restored'] as const
const PENDING_EXPERIMENT_STATUSES = [
  'prepared',
  'awaitingReload',
  'sampling',
  'awaitingDecision',
  'restoring',
] as const
const COMPLETED_EXPERIMENT_STATUSES = ['completed', 'failed'] as const
const HISTORY_OUTCOMES = ['completed', 'failed', 'restored', 'cancelled'] as const
const PROBES = ['static', 'idle', 'controlledScroll'] as const
const PERF_BOOLEAN_KEYS = [
  'fast_ui_mode',
  'reduced_motion',
  'noShadows',
  'smooth_streaming',
  'stream_fade_in',
] as const

function valid<T>(value: T): Normalized<T> {
  return { ok: true, value }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T)
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value)
}

function optionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value)
}

function optionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean'
}

function normalizeJsonValue(value: unknown, ancestors = new Set<object>()): Normalized<JsonValue> {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return valid(value)
  if (isFiniteNumber(value)) return valid(value)
  if (typeof value !== 'object' || value === null || ancestors.has(value)) return INVALID

  ancestors.add(value)
  if (Array.isArray(value)) {
    const clone: JsonValue[] = []
    for (const item of value) {
      const normalized = normalizeJsonValue(item, ancestors)
      if (!normalized.ok) {
        ancestors.delete(value)
        return INVALID
      }
      clone.push(normalized.value)
    }
    ancestors.delete(value)
    return valid(clone)
  }

  const entries: Array<[string, JsonValue]> = []
  for (const [key, item] of Object.entries(value)) {
    const normalized = normalizeJsonValue(item, ancestors)
    if (!normalized.ok) {
      ancestors.delete(value)
      return INVALID
    }
    entries.push([key, normalized.value])
  }
  ancestors.delete(value)
  return valid(Object.fromEntries(entries))
}

function normalizeJsonRecord(value: unknown): Normalized<Record<string, JsonValue>> {
  if (!isRecord(value)) return INVALID
  const normalized = normalizeJsonValue(value)
  return normalized.ok && isRecord(normalized.value)
    ? valid(normalized.value as Record<string, JsonValue>)
    : INVALID
}

function normalizeStringArray(value: unknown): Normalized<string[]> {
  return Array.isArray(value) && value.every(isString) ? valid([...value]) : INVALID
}

function normalizePerformanceSnapshot(value: unknown): Normalized<PerformanceSettingsSnapshot> {
  if (!isRecord(value)
    || !PERF_BOOLEAN_KEYS.every((key) => typeof value[key] === 'boolean')
    || !isFiniteNumber(value.streaming_fps)
    || !isFiniteNumber(value.chat_truncation)) return INVALID
  return valid({
    fast_ui_mode: value.fast_ui_mode as boolean,
    reduced_motion: value.reduced_motion as boolean,
    noShadows: value.noShadows as boolean,
    smooth_streaming: value.smooth_streaming as boolean,
    stream_fade_in: value.stream_fade_in as boolean,
    streaming_fps: value.streaming_fps,
    chat_truncation: value.chat_truncation,
  })
}

function normalizeObserved<T extends JsonValue>(
  value: unknown,
  normalizeValue: (input: unknown) => Normalized<T>,
): Normalized<ButlerObserved<T>> {
  if (!isRecord(value) || typeof value.available !== 'boolean') return INVALID
  if (!value.available) {
    return isString(value.reason) ? valid({ available: false, reason: value.reason }) : INVALID
  }
  const normalized = normalizeValue(value.value)
  return normalized.ok ? valid({ available: true, value: normalized.value }) : INVALID
}

function normalizeCapability(value: unknown): Normalized<ButlerCapability> {
  if (!isRecord(value) || !isString(value.id) || typeof value.available !== 'boolean') return INVALID
  if (value.available) return valid({ id: value.id, available: true })
  return isString(value.reason)
    ? valid({ id: value.id, available: false, reason: value.reason })
    : INVALID
}

function normalizeEnvironment(value: unknown): Normalized<MeasurementEnvironment> {
  if (!isRecord(value)) return INVALID
  const stVersion = normalizeObserved(value.stVersion, (input) => isString(input) ? valid(input) : INVALID)
  const stageBuild = normalizeObserved(value.stageBuild, (input) => isString(input) ? valid(input) : INVALID)
  const mobile = normalizeObserved(value.mobile, (input) => typeof input === 'boolean' ? valid(input) : INVALID)
  const settingsSummary = normalizeObserved(value.settingsSummary, normalizeJsonRecord)
  const disabledExtensionsHash = normalizeObserved(
    value.disabledExtensionsHash,
    (input) => isString(input) ? valid(input) : INVALID,
  )
  if (!stVersion.ok || !stageBuild.ok || !mobile.ok || !settingsSummary.ok || !disabledExtensionsHash.ok) {
    return INVALID
  }
  return valid({
    stVersion: stVersion.value,
    stageBuild: stageBuild.value,
    mobile: mobile.value,
    settingsSummary: settingsSummary.value,
    disabledExtensionsHash: disabledExtensionsHash.value,
  })
}

export function normalizeMeasurementSnapshot(value: unknown): MeasurementSnapshot | null {
  if (!isRecord(value)
    || !isString(value.id)
    || !isFiniteNumber(value.createdAt)
    || !isFiniteNumber(value.durationMs)
    || !isOneOf(value.probe, PROBES)
    || typeof value.foreground !== 'boolean'
    || !optionalString(value.chatKey)
    || !optionalString(value.invalidReason)
    || !Array.isArray(value.capabilities)) return null

  const environment = normalizeEnvironment(value.environment)
  const metrics = normalizeJsonRecord(value.metrics)
  const capabilities: ButlerCapability[] = []
  for (const candidate of value.capabilities) {
    const normalized = normalizeCapability(candidate)
    if (!normalized.ok) return null
    capabilities.push(normalized.value)
  }
  if (!environment.ok || !metrics.ok) return null

  return {
    id: value.id,
    createdAt: value.createdAt,
    durationMs: value.durationMs,
    probe: value.probe,
    foreground: value.foreground,
    ...(value.chatKey === undefined ? {} : { chatKey: value.chatKey }),
    environment: environment.value,
    capabilities,
    metrics: metrics.value,
    ...(value.invalidReason === undefined ? {} : { invalidReason: value.invalidReason }),
  }
}

export function normalizeButlerAction(value: unknown): ButlerAction | null {
  if (!isRecord(value)
    || !isString(value.id)
    || !isOneOf(value.group, ACTION_GROUPS)
    || !isString(value.label)
    || !isString(value.field)
    || !isOneOf(value.status, ACTION_STATUSES)
    || typeof value.reloadRequired !== 'boolean'
    || !optionalString(value.error)) return null
  const before = normalizeJsonValue(value.before)
  const requested = normalizeJsonValue(value.requested)
  const actual = value.actual === undefined ? null : normalizeJsonValue(value.actual)
  if (!before.ok || !requested.ok || (actual !== null && !actual.ok)) return null
  return {
    id: value.id,
    group: value.group,
    label: value.label,
    field: value.field,
    before: before.value,
    requested: requested.value,
    ...(actual === null ? {} : { actual: actual.value }),
    status: value.status,
    reloadRequired: value.reloadRequired,
    ...(value.error === undefined ? {} : { error: value.error }),
  }
}

export function normalizeButlerTransaction(value: unknown): ButlerTransaction | null {
  if (!isRecord(value)
    || !isString(value.id)
    || !isOneOf(value.group, ACTION_GROUPS)
    || !isFiniteNumber(value.createdAt)
    || !optionalNumber(value.completedAt)
    || !isOneOf(value.status, TRANSACTION_STATUSES)
    || !isOneOf(value.restoreStatus, RESTORE_STATUSES)
    || !optionalString(value.baselineMeasurementId)
    || !Array.isArray(value.actions)
    || !optionalString(value.error)) return null
  const before = normalizeJsonRecord(value.before)
  const requested = normalizeJsonRecord(value.requested)
  const actual = normalizeJsonRecord(value.actual)
  const actions: ButlerAction[] = []
  for (const candidate of value.actions) {
    const normalized = normalizeButlerAction(candidate)
    if (!normalized || normalized.group !== value.group) return null
    actions.push(normalized)
  }
  if (!before.ok || !requested.ok || !actual.ok || actions.length === 0) return null
  return {
    id: value.id,
    group: value.group,
    createdAt: value.createdAt,
    ...(value.completedAt === undefined ? {} : { completedAt: value.completedAt }),
    status: value.status,
    restoreStatus: value.restoreStatus,
    ...(value.baselineMeasurementId === undefined ? {} : { baselineMeasurementId: value.baselineMeasurementId }),
    before: before.value,
    requested: requested.value,
    actual: actual.value,
    actions,
    ...(value.error === undefined ? {} : { error: value.error }),
  }
}

export function normalizeButlerExperiment(value: unknown): ButlerExperiment | null {
  if (!isRecord(value)
    || !isString(value.id)
    || !isOneOf(value.kind, EXPERIMENT_KINDS)
    || !isOneOf(value.status, EXPERIMENT_STATUSES)
    || !isFiniteNumber(value.startedAt)
    || !optionalNumber(value.completedAt)
    || !isFiniteNumber(value.currentRound)
    || !Number.isInteger(value.currentRound)
    || value.currentRound < 0
    || !optionalString(value.baselineMeasurementId)
    || !optionalString(value.comparisonMeasurementId)
    || !optionalBoolean(value.reloadRequiredAfterDecision)
    || !optionalString(value.notes)) return null
  const originalDisabledExtensions = normalizeStringArray(value.originalDisabledExtensions)
  const candidateExtensions = normalizeStringArray(value.candidateExtensions)
  const trialDisabledExtensions = value.trialDisabledExtensions === undefined
    ? null
    : normalizeStringArray(value.trialDisabledExtensions)
  if (!originalDisabledExtensions.ok || !candidateExtensions.ok || (trialDisabledExtensions && !trialDisabledExtensions.ok)) {
    return null
  }
  return {
    id: value.id,
    kind: value.kind,
    status: value.status,
    startedAt: value.startedAt,
    ...(value.completedAt === undefined ? {} : { completedAt: value.completedAt }),
    originalDisabledExtensions: originalDisabledExtensions.value,
    candidateExtensions: candidateExtensions.value,
    ...(trialDisabledExtensions === null ? {} : { trialDisabledExtensions: trialDisabledExtensions.value }),
    currentRound: value.currentRound,
    ...(value.baselineMeasurementId === undefined ? {} : { baselineMeasurementId: value.baselineMeasurementId }),
    ...(value.comparisonMeasurementId === undefined ? {} : { comparisonMeasurementId: value.comparisonMeasurementId }),
    ...(value.reloadRequiredAfterDecision === undefined ? {} : { reloadRequiredAfterDecision: value.reloadRequiredAfterDecision }),
    ...(value.notes === undefined ? {} : { notes: value.notes }),
  }
}

function normalizeHistoryBase(value: Record<string, unknown>): Normalized<{
  id: string
  createdAt: number
  completedAt: number
  outcome: ButlerHistoryRecord['outcome']
  summary: Record<string, JsonValue>
}> {
  if (!isString(value.id)
    || !isFiniteNumber(value.createdAt)
    || !isFiniteNumber(value.completedAt)
    || !isOneOf(value.outcome, HISTORY_OUTCOMES)) return INVALID
  const summary = normalizeJsonRecord(value.summary)
  return summary.ok
    ? valid({
        id: value.id,
        createdAt: value.createdAt,
        completedAt: value.completedAt,
        outcome: value.outcome,
        summary: summary.value,
      })
    : INVALID
}

function normalizeHistoryRecord(value: unknown): ButlerHistoryRecord | null {
  if (!isRecord(value)) return null
  const base = normalizeHistoryBase(value)
  if (!base.ok) return null
  if (value.kind === 'measurement') {
    if (value.transaction !== undefined || value.experiment !== undefined) return null
    const measurement = normalizeMeasurementSnapshot(value.measurement)
    return measurement ? { ...base.value, kind: 'measurement', measurement } : null
  }
  if (value.kind === 'transaction') {
    if (value.measurement !== undefined || value.experiment !== undefined) return null
    const transaction = normalizeButlerTransaction(value.transaction)
    return transaction
      && transaction.completedAt !== undefined
      && isOneOf(transaction.status, COMPLETED_TRANSACTION_STATUSES)
      ? { ...base.value, kind: 'transaction', transaction }
      : null
  }
  if (value.kind === 'experiment') {
    if (value.measurement !== undefined || value.transaction !== undefined) return null
    const experiment = normalizeButlerExperiment(value.experiment)
    return experiment
      && experiment.completedAt !== undefined
      && isOneOf(experiment.status, COMPLETED_EXPERIMENT_STATUSES)
      ? { ...base.value, kind: 'experiment', experiment }
      : null
  }
  return null
}

function normalizeV2(value: Record<string, unknown>): ButlerDataV2 | null {
  if (value.version !== BUTLER_DATA_VERSION
    || typeof value.performanceModeOn !== 'boolean'
    || !Array.isArray(value.history)) return null
  const activeTransaction = value.activeTransaction === null
    ? null
    : normalizeButlerTransaction(value.activeTransaction)
  const pendingExperiment = value.pendingExperiment === null
    ? null
    : normalizeButlerExperiment(value.pendingExperiment)

  const recoverableTransaction = activeTransaction
    && isOneOf(activeTransaction.status, ACTIVE_TRANSACTION_STATUSES)
    && isOneOf(activeTransaction.restoreStatus, ACTIVE_RESTORE_STATUSES)
    ? activeTransaction
    : null
  const resumableExperiment = pendingExperiment
    && isOneOf(pendingExperiment.status, PENDING_EXPERIMENT_STATUSES)
    ? pendingExperiment
    : null

  const history: ButlerHistoryRecord[] = []
  for (const candidate of value.history) {
    const normalized = normalizeHistoryRecord(candidate)
    if (normalized) history.push(normalized)
  }
  return {
    version: BUTLER_DATA_VERSION,
    performanceModeOn: value.performanceModeOn,
    activeTransaction: recoverableTransaction,
    pendingExperiment: resumableExperiment,
    history,
  }
}

export function createEmptyButlerData(): ButlerDataV2 {
  return {
    version: BUTLER_DATA_VERSION,
    performanceModeOn: false,
    activeTransaction: null,
    pendingExperiment: null,
    history: [],
  }
}

export function migrateButlerData(value: unknown, _options: MigrationOptions = {}): ButlerDataV2 {
  if (!isRecord(value)) return createEmptyButlerData()
  if (value.version === BUTLER_DATA_VERSION) return normalizeV2(value) ?? createEmptyButlerData()
  const snapshot = normalizePerformanceSnapshot(value.snapshot)
  if (!snapshot.ok || (value.perfOn !== undefined && typeof value.perfOn !== 'boolean')) {
    return createEmptyButlerData()
  }

  return {
    version: BUTLER_DATA_VERSION,
    performanceModeOn: false,
    // 旧版只保存整组快照，没有每个字段的实际回读结果，无法安全生成可恢复事务。
    // 清空保护槽，让用户重新体检并生成有逐项证据的新事务。
    activeTransaction: null,
    pendingExperiment: null,
    history: [],
  }
}
