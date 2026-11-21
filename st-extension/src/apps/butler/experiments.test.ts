import { describe, expect, it, vi } from 'vitest'
import type { ExtensionInventoryItem, ExtensionInventoryResult, ExtensionWriteResult } from './bridge'
import type { ButlerExperiment } from './types'
import {
  applyDesiredDisabledExtensions,
  buildEmergencyBackup,
  finishExtensionExperiment,
  readEmergencyBackup,
  restoreEmergencyExtensionBackup,
  resumeExtensionExperiment,
  type ExtensionExperimentDependencies,
} from './experiments'

function item(
  name: string,
  type = 'local',
  dependencies: string[] = [],
  configuredEnabled = true,
): ExtensionInventoryItem {
  return {
    name,
    type,
    configuredEnabled,
    isSelf: name === 'third-party/st-stage',
    manifest: {
      dependencies: { status: 'valid', names: dependencies },
      requiredModules: { status: 'absent', names: [] },
    },
  }
}

function inventory(
  extensions: ExtensionInventoryItem[],
  disabledExtensions: string[] = [],
): Extract<ExtensionInventoryResult, { status: 'ready' }> {
  return {
    status: 'ready',
    governance: { writable: true },
    disabledExtensions,
    extensions,
  }
}

function harness(
  extensions: ExtensionInventoryItem[] = [
    item('third-party/st-stage'),
    item('third-party/a'),
    item('third-party/b'),
    item('assets', 'system'),
  ],
  disabled: string[] = [],
) {
  let currentDisabled = [...disabled]
  const persisted: Array<ButlerExperiment | null> = []
  const storage = new Map<string, string>()
  const failNames = new Set<string>()
  const deps: ExtensionExperimentDependencies = {
    readExtensions: vi.fn(async () => inventory(
      extensions.map((extension) => ({
        ...extension,
        configuredEnabled: !currentDisabled.includes(extension.name),
      })),
      currentDisabled,
    )),
    setExtensionEnabled: vi.fn(async (name, enabled): Promise<ExtensionWriteResult> => {
      if (failNames.has(name)) return { ok: false, code: 'api-error', error: `failed ${name}` }
      currentDisabled = enabled
        ? currentDisabled.filter((value) => value !== name)
        : [...new Set([...currentDisabled, name])]
      return { ok: true, name, configuredEnabled: enabled, reloadRequired: true }
    }),
    persistExperiment: vi.fn(async (experiment) => { persisted.push(experiment ? structuredClone(experiment) : null) }),
    reloadPage: vi.fn().mockResolvedValue(undefined),
    now: vi.fn(() => 100),
    createId: vi.fn(() => 'exp-1'),
    backupStorage: {
      getItem: vi.fn((key) => storage.get(key) ?? null),
      setItem: vi.fn((key, value) => { storage.set(key, value) }),
      removeItem: vi.fn((key) => { storage.delete(key) }),
    },
  }
  return { deps, persisted, storage, failNames, getDisabled: () => [...currentDisabled] }
}

describe('emergency backup', () => {
  it('contains only extension names and timestamp and emits an official-API recovery command', () => {
    const backup = buildEmergencyBackup(['third-party/a', 'third-party/b'], 123)
    const serialized = JSON.stringify(backup)

    expect(backup).toEqual({ version: 1, createdAt: 123, disabledExtensions: ['third-party/a', 'third-party/b'] })
    expect(serialized).not.toMatch(/prompt|chat|key|secret/i)
    expect(backup).not.toHaveProperty('recoveryCommand')
    expect(buildEmergencyBackup.recoveryCommand(backup)).toContain("import('/scripts/extensions.js')")
    expect(buildEmergencyBackup.recoveryCommand(backup)).toContain('disableExtension')
    expect(buildEmergencyBackup.recoveryCommand(backup)).toContain('enableExtension')
  })

  it('strictly reads a stored backup and rejects malformed or unsafe shapes', () => {
    const storage = new Map<string, string>()
    const source = {
      getItem: (key: string) => storage.get(key) ?? null,
    }
    storage.set('st-stage:butler:extension-recovery:v1', JSON.stringify({
      version: 1,
      createdAt: 123,
      disabledExtensions: ['third-party/b', 'third-party/a', 'third-party/a'],
    }))

    expect(readEmergencyBackup(source)).toEqual({
      version: 1,
      createdAt: 123,
      disabledExtensions: ['third-party/a', 'third-party/b'],
    })

    storage.set('st-stage:butler:extension-recovery:v1', JSON.stringify({
      version: 1,
      createdAt: 123,
      disabledExtensions: ['third-party/a', 42],
    }))
    expect(readEmergencyBackup(source)).toBeNull()
  })

  it('restores a stored backup through official APIs and only clears it after success', async () => {
    const h = harness(undefined, ['third-party/a'])
    const backup = buildEmergencyBackup([], 123)

    const result = await restoreEmergencyExtensionBackup(backup, h.deps)

    expect(result.ok).toBe(true)
    expect(h.getDisabled()).toEqual([])
    expect(h.deps.backupStorage.removeItem).toHaveBeenCalledOnce()
    expect(h.deps.reloadPage).toHaveBeenCalledOnce()

    const failed = harness(undefined, ['third-party/a'])
    failed.failNames.add('third-party/a')
    const failure = await restoreEmergencyExtensionBackup(backup, failed.deps)
    expect(failure.ok).toBe(false)
    expect(failed.deps.backupStorage.removeItem).not.toHaveBeenCalled()
    expect(failed.deps.reloadPage).not.toHaveBeenCalled()
  })
})

describe('official extension batch & legacy experiment recovery', () => {
  it('reloads exactly once after every change succeeds', async () => {
    const h = harness()
    const result = await applyDesiredDisabledExtensions(['third-party/a', 'third-party/b'], h.deps)

    expect(result.ok).toBe(true)
    expect(h.deps.setExtensionEnabled).toHaveBeenCalledTimes(2)
    expect(h.deps.reloadPage).toHaveBeenCalledTimes(1)
    expect(h.getDisabled().sort()).toEqual(['third-party/a', 'third-party/b'])
  })

  it('does not reload on partial failure and reports successful and failed items', async () => {
    const h = harness()
    h.failNames.add('third-party/b')
    const result = await applyDesiredDisabledExtensions(['third-party/a', 'third-party/b'], h.deps)

    expect(result.ok).toBe(false)
    expect(result.applied).toEqual(['third-party/a'])
    expect(result.failed).toEqual([{ name: 'third-party/b', error: 'failed third-party/b' }])
    expect(h.deps.reloadPage).not.toHaveBeenCalled()
  })

  it('never disables st-stage even if it appears in the desired disabled list', async () => {
    const h = harness()
    const result = await applyDesiredDisabledExtensions(['third-party/st-stage'], h.deps)

    expect(result.ok).toBe(false)
    expect(result.failed[0]).toMatchObject({ name: 'third-party/st-stage' })
    expect(h.deps.setExtensionEnabled).not.toHaveBeenCalledWith('third-party/st-stage', false)
    expect(h.deps.reloadPage).not.toHaveBeenCalled()
  })

  it('resumes legacy awaitingReload state and restores or keeps pending experiments', async () => {
    const h = harness(undefined, ['third-party/a', 'third-party/b'])
    const legacy: ButlerExperiment = {
      id: 'exp-1',
      kind: 'selectedExtensions',
      status: 'awaitingReload',
      startedAt: 50,
      originalDisabledExtensions: ['third-party/b'],
      candidateExtensions: ['third-party/a'],
      trialDisabledExtensions: ['third-party/a'],
      currentRound: 1,
      baselineMeasurementId: 'baseline',
    }
    const sampling = resumeExtensionExperiment(legacy)
    expect(sampling.status).toBe('sampling')

    const decision: ButlerExperiment = { ...sampling, status: 'awaitingDecision' }
    const restored = await finishExtensionExperiment(decision, 'restore', h.deps)
    expect(restored.status).toBe('completed')
    expect(h.getDisabled()).toEqual(['third-party/b'])
    expect(h.deps.reloadPage).toHaveBeenCalledTimes(1)
  })
})
