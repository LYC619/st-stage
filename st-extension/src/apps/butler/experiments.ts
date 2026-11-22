import type {
  ExtensionInventoryResult,
  ExtensionWriteResult,
} from './bridge'
import type { ButlerExperiment } from './types'
import { SELF_DIRECTORY_NAME, isSelfExtensionName } from './self-identity'

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
  warnRecovery?(command: string): void
}

export interface ExtensionBatchResult {
  ok: boolean
  applied: string[]
  failed: Array<{ name: string; error: string }>
  reloadRequired: boolean
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort()
}

// 目录名在运行时算，不写死：改过名或换名分发后仍然认得自己。见 self-identity.ts
function isSelf(name: string): boolean {
  return isSelfExtensionName(name)
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
    if (isSelf(name)) failed.push({ name, error: `管家不能禁用 ${SELF_DIRECTORY_NAME} 自身` })
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
export function restoreEmergencyExtensionBackup(
  backup: EmergencyExtensionBackup,
  deps: ExtensionExperimentDependencies,
): Promise<ExtensionBatchResult> {
  return applyDisabledSet(backup.disabledExtensions, deps, false).then(async (batch) => {
    if (!batch.ok) return batch
    deps.backupStorage.removeItem(BACKUP_STORAGE_KEY)
    if (batch.reloadRequired) await deps.reloadPage()
    return batch
  })
}

function partialFailureNote(prefix: string, batch: ExtensionBatchResult): string {
  const applied = batch.applied.length > 0 ? batch.applied.join('、') : '无'
  const failed = batch.failed.map((item) => `${item.name}（${item.error}）`).join('、')
  return `${prefix}；已修改：${applied}；失败：${failed}。页面未刷新，可保留当前状态或恢复原清单。`
}

export function resumeExtensionExperiment(source: ButlerExperiment): ButlerExperiment {
  if (source.status !== 'awaitingReload') return structuredClone(source)
  return { ...structuredClone(source), status: 'sampling' }
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
