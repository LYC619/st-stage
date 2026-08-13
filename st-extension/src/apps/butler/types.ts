export const BUTLER_DATA_VERSION = 2 as const
export const BUTLER_HISTORY_LIMIT = 10
export const BUTLER_DATA_BUDGET_BYTES = 64 * 1024

export type ButlerLayer = 'pageRendering' | 'mediaResourcesStorage' | 'extensions' | 'generationContext'
export type ButlerSeverity = 'info' | 'suggestion' | 'risk'
export type ButlerConfidence = 'setting' | 'measurement' | 'correlation'
export type ButlerActionGroup = 'performanceSettings' | 'disabledExtensions' | 'gameplaySettings'
export type ButlerProbe = 'static' | 'idle' | 'controlledScroll'
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface PerformanceSettingsSnapshot {
  fast_ui_mode: boolean
  reduced_motion: boolean
  noShadows: boolean
  smooth_streaming: boolean
  stream_fade_in: boolean
  streaming_fps: number
  chat_truncation: number
}

export type ButlerObserved<T extends JsonValue> =
  | { available: true; value: T }
  | { available: false; reason: string }

export type ButlerCapability =
  | { id: string; available: true }
  | { id: string; available: false; reason: string }

export interface MeasurementEnvironment {
  stVersion: ButlerObserved<string>
  stageBuild: ButlerObserved<string>
  mobile: ButlerObserved<boolean>
  settingsSummary: ButlerObserved<Record<string, JsonValue>>
  disabledExtensionsHash: ButlerObserved<string>
}

/** 持久化快照只保留摘要指标；不得写入聊天正文、完整 URL 或资源明细。 */
export interface MeasurementSnapshot {
  id: string
  createdAt: number
  durationMs: number
  probe: ButlerProbe
  foreground: boolean
  chatKey?: string
  environment: MeasurementEnvironment
  capabilities: ButlerCapability[]
  metrics: Record<string, JsonValue>
  invalidReason?: string
}

export interface FindingExplanation {
  detected: string
  change: string
  reason: string
  impact: string
  reload: string
  restore: string
  result: string
}

export interface Finding {
  id: string
  layer: ButlerLayer
  evidence: Record<string, JsonValue>
  severity: ButlerSeverity
  confidence: ButlerConfidence
  actionId?: string
  explanation: FindingExplanation
}

export interface ButlerAction {
  id: string
  group: ButlerActionGroup
  label: string
  field: string
  before: JsonValue
  requested: JsonValue
  actual?: JsonValue
  status: 'planned' | 'applied' | 'failed' | 'unchanged'
  reloadRequired: boolean
  error?: string
}

export interface ButlerTransaction {
  id: string
  group: ButlerActionGroup
  createdAt: number
  completedAt?: number
  status: 'planned' | 'applying' | 'applied' | 'partial' | 'failed' | 'restored'
  restoreStatus: 'unavailable' | 'available' | 'restoring' | 'conflict' | 'restored'
  /** Dynamic sample captured immediately before this transaction was applied. */
  baselineMeasurementId?: string
  before: Record<string, JsonValue>
  requested: Record<string, JsonValue>
  actual: Record<string, JsonValue>
  actions: ButlerAction[]
  error?: string
}

export interface ButlerExperiment {
  id: string
  kind: 'selectedExtensions' | 'binaryIsolation'
  status: 'prepared' | 'awaitingReload' | 'sampling' | 'awaitingDecision' | 'restoring' | 'completed' | 'failed'
  startedAt: number
  completedAt?: number
  originalDisabledExtensions: string[]
  candidateExtensions: string[]
  /** 二分流程本轮实际禁用的候选；选定扩展流程等于 candidateExtensions。 */
  trialDisabledExtensions?: string[]
  currentRound: number
  baselineMeasurementId?: string
  comparisonMeasurementId?: string
  /** Some extension changes have not taken effect because a partial batch intentionally skipped reload. */
  reloadRequiredAfterDecision?: boolean
  notes?: string
}

interface ButlerHistoryRecordBase {
  id: string
  createdAt: number
  completedAt: number
  outcome: 'completed' | 'failed' | 'restored' | 'cancelled'
  summary: Record<string, JsonValue>
}

export type ButlerHistoryRecord =
  | (ButlerHistoryRecordBase & {
      kind: 'measurement'
      measurement: MeasurementSnapshot
      transaction?: never
      experiment?: never
    })
  | (ButlerHistoryRecordBase & {
      kind: 'transaction'
      measurement?: never
      transaction: ButlerTransaction
      experiment?: never
    })
  | (ButlerHistoryRecordBase & {
      kind: 'experiment'
      measurement?: never
      transaction?: never
      experiment: ButlerExperiment
    })

export interface ButlerDataV2 {
  version: typeof BUTLER_DATA_VERSION
  performanceModeOn: boolean
  activeTransaction: ButlerTransaction | null
  pendingExperiment: ButlerExperiment | null
  history: ButlerHistoryRecord[]
}
