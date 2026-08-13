import type {
  ExtensionInventoryItem,
  ExtensionInventoryResult,
  ExtensionWriteResult,
} from './bridge'
import type { ButlerExperiment } from './types'

const BACKUP_STORAGE_KEY = 'st-stage:butler:extension-recovery:v1'

export interface EmergencyExtensionBackup {
  version: 1
  createdAt: number
  disabledExtensions: string[]
}

export interface ExtensionExperimentDependencies {
  readExtensions(): Promise<ExtensionInventoryResult>
  setExtensionEnabled(name: string, enabled: boolean): Promise<ExtensionWriteResult>
  persistExperiment(experiment: ButlerExperiment | null): Promise<void>
  reloadPage(): Promise<void>
  now(): number
  createId(): string
  backupStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  warnRecovery(command: string): void
}

export interface ExtensionBatchResult {
  ok: boolean
  applied: string[]
  failed: Array<{ name: string; error: string }>
  reloadRequired: boolean
}

export interface ExperimentStartResult {
  experiment: ButlerExperiment
  batch: ExtensionBatchResult
}

export interface DependencyWarning {
  dependency: string
  dependent: string
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort()
}

function isSelf(name: string): boolean {
  return name === 'st-stage' || name === 'third-party/st-stage'
}

function isSystem(item: ExtensionInventoryItem): boolean {
  return item.type.toLowerCase() === 'system'
}

function trialForCandidates(kind: ButlerExperiment['kind'], candidates: string[]): string[] {
  if (kind === 'selectedExtensions') return [...candidates]
  return candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2)))
}

export function defaultExperimentCandidates(
  inventory: Extract<ExtensionInventoryResult, { status: 'ready' }>,
): string[] {
  return inventory.extensions
    .filter((item) => item.configuredEnabled && !item.isSelf && !isSelf(item.name) && !isSystem(item))
    .map((item) => item.name)
}

export function dependencyWarnings(
  inventory: Extract<ExtensionInventoryResult, { status: 'ready' }>,
  selectedNames: string[],
): DependencyWarning[] {
  const selected = new Set(selectedNames)
  const warnings: DependencyWarning[] = []
  for (const dependent of inventory.extensions) {
    if (!dependent.configuredEnabled || selected.has(dependent.name)) continue
    if (dependent.manifest?.dependencies.status !== 'valid') continue
    for (const dependency of dependent.manifest.dependencies.names) {
      if (selected.has(dependency)) warnings.push({ dependency, dependent: dependent.name })
    }
  }
  return warnings
}

function recoveryCommand(backup: EmergencyExtensionBackup): string {
  const disabled = JSON.stringify(uniqueSorted(backup.disabledExtensions))
  return `(async()=>{const m=await import('/scripts/extensions.js');const d=new Set(${disabled});for(const n of m.extensionNames){await (d.has(n)?m.disableExtension(n,false):m.enableExtension(n,false));}location.reload();})()`
}

export const buildEmergencyBackup = Object.assign(
  (disabledExtensions: string[], createdAt: number): EmergencyExtensionBackup => ({
    version: 1,
    createdAt,
    disabledExtensions: uniqueSorted(disabledExtensions),
  }),
  { recoveryCommand },
)

/** 只接受管家自己写出的最小备份形状；损坏数据不会进入扩展启停 API。 */
export function readEmergencyBackup(
  storage: Pick<Storage, 'getItem'>,
): EmergencyExtensionBackup | null {
  let raw: string | null
  try {
    raw = storage.getItem(BACKUP_STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    if (
      record.version !== 1 ||
      typeof record.createdAt !== 'number' ||
      !Number.isFinite(record.createdAt) ||
      !Array.isArray(record.disabledExtensions) ||
      !record.disabledExtensions.every((name) => typeof name === 'string' && name.length > 0) ||
      record.disabledExtensions.some((name) => typeof name === 'string' && isSelf(name))
    ) return null
    return buildEmergencyBackup(record.disabledExtensions as string[], record.createdAt)
  } catch {
    return null
  }
}

export function prepareExtensionExperiment(
  kind: ButlerExperiment['kind'],
  candidateNames: string[],
  inventory: Extract<ExtensionInventoryResult, { status: 'ready' }>,
  baselineMeasurementId: string,
  deps: Pick<ExtensionExperimentDependencies, 'now' | 'createId'>,
): ButlerExperiment {
  const known = new Set(inventory.extensions.map((item) => item.name))
  const candidates = uniqueSorted(candidateNames)
  if (candidates.some(isSelf)) throw new Error('st-stage 自身不能进入扩展实验')
  const unknown = candidates.filter((name) => !known.has(name))
  if (unknown.length > 0) throw new Error(`未找到扩展：${unknown.join('、')}`)
  if (candidates.length === 0) throw new Error('至少选择一个扩展')
  return {
    id: deps.createId(),
    kind,
    status: 'prepared',
    startedAt: deps.now(),
    originalDisabledExtensions: uniqueSorted(inventory.disabledExtensions),
    candidateExtensions: candidates,
    trialDisabledExtensions: trialForCandidates(kind, candidates),
    currentRound: 1,
    baselineMeasurementId,
  }
}

async function applyDisabledSet(
  desiredDisabledExtensions: string[],
  deps: ExtensionExperimentDependencies,
  reloadOnSuccess: boolean,
): Promise<ExtensionBatchResult> {
  const inventory = await deps.readExtensions()
  if (inventory.status !== 'ready') {
    return { ok: false, applied: [], failed: [{ name: 'SillyTavern', error: inventory.reason }], reloadRequired: false }
  }
  if (!inventory.governance.writable) {
    return {
      ok: false,
      applied: [],
      failed: [{ name: 'SillyTavern', error: inventory.governance.reason ?? '扩展治理只读' }],
      reloadRequired: false,
    }
  }

  const desired = new Set(uniqueSorted(desiredDisabledExtensions))
  const failed: ExtensionBatchResult['failed'] = []
  const applied: string[] = []
  for (const name of desired) {
    if (isSelf(name)) failed.push({ name, error: '管家不能禁用 st-stage 自身' })
  }
  if (failed.length > 0) return { ok: false, applied, failed, reloadRequired: false }

  for (const extension of inventory.extensions) {
    if (extension.isSelf || isSelf(extension.name)) continue
    const shouldEnable = !desired.has(extension.name)
    if (extension.configuredEnabled === shouldEnable) continue
    const result = await deps.setExtensionEnabled(extension.name, shouldEnable)
    if (result.ok) applied.push(extension.name)
    else failed.push({ name: extension.name, error: result.error })
  }

  const ok = failed.length === 0
  const reloadRequired = applied.length > 0
  if (ok && reloadRequired && reloadOnSuccess) await deps.reloadPage()
  return { ok, applied, failed, reloadRequired }
}

export function applyDesiredDisabledExtensions(
  desiredDisabledExtensions: string[],
  deps: ExtensionExperimentDependencies,
): Promise<ExtensionBatchResult> {
  return applyDisabledSet(desiredDisabledExtensions, deps, true)
}

/** 用户主动从独立备份恢复；失败时保留备份，成功后才清理并按需刷新。 */
export async function restoreEmergencyExtensionBackup(
  backup: EmergencyExtensionBackup,
  deps: ExtensionExperimentDependencies,
): Promise<ExtensionBatchResult> {
  const batch = await applyDisabledSet(backup.disabledExtensions, deps, false)
  if (!batch.ok) return batch
  deps.backupStorage.removeItem(BACKUP_STORAGE_KEY)
  if (batch.reloadRequired) await deps.reloadPage()
  return batch
}

function desiredForTrial(experiment: ButlerExperiment): string[] {
  return uniqueSorted([
    ...experiment.originalDisabledExtensions,
    ...(experiment.trialDisabledExtensions ?? experiment.candidateExtensions),
  ])
}

function storeEmergencyBackup(experiment: ButlerExperiment, deps: ExtensionExperimentDependencies): void {
  const backup = buildEmergencyBackup(experiment.originalDisabledExtensions, deps.now())
  deps.backupStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backup))
  deps.warnRecovery(buildEmergencyBackup.recoveryCommand(backup))
}

function partialFailureNote(prefix: string, batch: ExtensionBatchResult): string {
  const applied = batch.applied.length > 0 ? batch.applied.join('、') : '无'
  const failed = batch.failed.map((item) => `${item.name}（${item.error}）`).join('、')
  return `${prefix}；已修改：${applied}；失败：${failed}。页面未刷新，可保留当前状态或恢复原清单。`
}

export async function startExtensionExperiment(
  source: ButlerExperiment,
  deps: ExtensionExperimentDependencies,
): Promise<ExperimentStartResult> {
  if (source.status !== 'prepared') throw new Error('实验尚未处于准备状态')
  const experiment = structuredClone(source)
  await deps.persistExperiment(experiment)
  storeEmergencyBackup(experiment, deps)
  const batch = await applyDisabledSet(desiredForTrial(experiment), deps, false)
  if (!batch.ok) {
    experiment.status = 'awaitingDecision'
    experiment.reloadRequiredAfterDecision = batch.reloadRequired
    experiment.notes = partialFailureNote('扩展变更未全部成功', batch)
    await deps.persistExperiment(experiment)
    return { experiment, batch }
  }
  experiment.status = batch.reloadRequired ? 'awaitingReload' : 'sampling'
  await deps.persistExperiment(experiment)
  if (batch.reloadRequired) await deps.reloadPage()
  return { experiment, batch }
}

export function resumeExtensionExperiment(source: ButlerExperiment): ButlerExperiment {
  if (source.status !== 'awaitingReload') return structuredClone(source)
  return { ...structuredClone(source), status: 'sampling' }
}

export function recordExperimentComparison(
  source: ButlerExperiment,
  comparisonMeasurementId: string,
): ButlerExperiment {
  if (source.status !== 'sampling') throw new Error('实验未处于复测阶段')
  return {
    ...structuredClone(source),
    status: 'awaitingDecision',
    comparisonMeasurementId,
  }
}

export async function finishExtensionExperiment(
  source: ButlerExperiment,
  decision: 'keep' | 'restore',
  deps: ExtensionExperimentDependencies,
): Promise<ButlerExperiment> {
  if (source.status !== 'awaitingDecision') throw new Error('实验尚未等待用户决定')
  const completed = structuredClone(source)
  if (decision === 'restore') {
    const restoring = { ...completed, status: 'restoring' as const }
    await deps.persistExperiment(restoring)
    const batch = await applyDisabledSet(restoring.originalDisabledExtensions, deps, false)
    if (!batch.ok) {
      const retryable: ButlerExperiment = {
        ...restoring,
        status: 'awaitingDecision',
        reloadRequiredAfterDecision: Boolean(
          restoring.reloadRequiredAfterDecision || batch.reloadRequired,
        ),
        notes: partialFailureNote('恢复未全部成功', batch),
      }
      await deps.persistExperiment(retryable)
      return retryable
    }
    completed.status = 'completed'
    completed.completedAt = deps.now()
    await deps.persistExperiment(null)
    deps.backupStorage.removeItem(BACKUP_STORAGE_KEY)
    if (batch.reloadRequired) await deps.reloadPage()
    return completed
  }

  completed.status = 'completed'
  completed.completedAt = deps.now()
  await deps.persistExperiment(null)
  deps.backupStorage.removeItem(BACKUP_STORAGE_KEY)
  if (completed.reloadRequiredAfterDecision) await deps.reloadPage()
  return completed
}

export async function advanceBinaryIsolation(
  source: ButlerExperiment,
  symptomImproved: boolean,
  deps: ExtensionExperimentDependencies,
): Promise<ButlerExperiment> {
  if (source.kind !== 'binaryIsolation' || source.status !== 'awaitingDecision') {
    throw new Error('二分实验尚未等待本轮判断')
  }
  const tested = new Set(source.trialDisabledExtensions ?? [])
  const candidates = symptomImproved
    ? source.candidateExtensions.filter((name) => tested.has(name))
    : source.candidateExtensions.filter((name) => !tested.has(name))
  const next: ButlerExperiment = {
    ...structuredClone(source),
    status: 'prepared',
    candidateExtensions: candidates,
    trialDisabledExtensions: trialForCandidates('binaryIsolation', candidates),
    currentRound: source.currentRound + 1,
    comparisonMeasurementId: undefined,
    reloadRequiredAfterDecision: undefined,
  }
  await deps.persistExperiment(next)
  const batch = await applyDisabledSet(desiredForTrial(next), deps, false)
  if (!batch.ok) {
    next.status = 'awaitingDecision'
    next.reloadRequiredAfterDecision = batch.reloadRequired
    next.notes = partialFailureNote('本轮扩展变更未全部成功', batch)
    await deps.persistExperiment(next)
    return next
  }
  next.status = batch.reloadRequired ? 'awaitingReload' : 'sampling'
  await deps.persistExperiment(next)
  if (batch.reloadRequired) await deps.reloadPage()
  return next
}
