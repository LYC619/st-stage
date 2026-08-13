import { describe, expect, it, vi } from 'vitest'
import type { ExtensionInventoryItem, ExtensionInventoryResult, ExtensionWriteResult } from './bridge'
import type { ButlerExperiment } from './types'
import {
  advanceBinaryIsolation,
  applyDesiredDisabledExtensions,
  buildEmergencyBackup,
  defaultExperimentCandidates,
  dependencyWarnings,
  finishExtensionExperiment,
  readEmergencyBackup,
  prepareExtensionExperiment,
  recordExperimentComparison,
  restoreEmergencyExtensionBackup,
  resumeExtensionExperiment,
  startExtensionExperiment,
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
    warnRecovery: vi.fn(),
  }
  return { deps, persisted, storage, failNames, getDisabled: () => [...currentDisabled] }
}

describe('extension candidate policy', () => {
  it('defaults to enabled third-party extensions and always excludes st-stage and system extensions', () => {
    const list = inventory([
      item('third-party/st-stage'),
      item('third-party/a'),
      item('third-party/off', 'local', [], false),
      item('global-helper', 'global'),
      item('assets', 'system'),
    ], ['third-party/off'])

    expect(defaultExperimentCandidates(list)).toEqual(['third-party/a', 'global-helper'])
  })

  it('rejects any explicit attempt to include st-stage itself', () => {
    const list = inventory([item('third-party/st-stage'), item('third-party/a')])
    expect(() => prepareExtensionExperiment('selectedExtensions', ['third-party/st-stage'], list, 'baseline', {
      now: () => 1,
      createId: () => 'id',
    })).toThrow(/st-stage/)
  })

  it('reports enabled dependents that require confirmation before disabling a dependency', () => {
    const list = inventory([
      item('third-party/base'),
      item('third-party/consumer', 'local', ['third-party/base']),
      item('third-party/together', 'local', ['third-party/base']),
    ])
    expect(dependencyWarnings(list, ['third-party/base', 'third-party/together'])).toEqual([
      { dependency: 'third-party/base', dependent: 'third-party/consumer' },
    ])
  })
})

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

describe('official extension batch', () => {
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
})

describe('selected extension A/B lifecycle', () => {
  it('persists pending state and emergency backup before changing extensions', async () => {
    const h = harness()
    const list = await h.deps.readExtensions()
    if (list.status !== 'ready') throw new Error('expected inventory')
    const experiment = prepareExtensionExperiment('selectedExtensions', ['third-party/a'], list, 'baseline', {
      now: h.deps.now,
      createId: h.deps.createId,
    })

    await startExtensionExperiment(experiment, h.deps)

    expect(h.persisted[0]?.status).toBe('prepared')
    expect(h.storage.size).toBe(1)
    expect(h.deps.warnRecovery).toHaveBeenCalledWith(expect.stringContaining("import('/scripts/extensions.js')"))
    expect(vi.mocked(h.deps.setExtensionEnabled).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(h.deps.persistExperiment).mock.invocationCallOrder[0],
    )
    expect(h.persisted.at(-1)?.status).toBe('awaitingReload')
  })

  it('partial start failure stays recoverable without reloading and can restore successful changes', async () => {
    const h = harness()
    h.failNames.add('third-party/b')
    const list = await h.deps.readExtensions()
    if (list.status !== 'ready') throw new Error('expected inventory')
    const experiment = prepareExtensionExperiment('selectedExtensions', ['third-party/a', 'third-party/b'], list, 'baseline', {
      now: h.deps.now,
      createId: h.deps.createId,
    })

    const started = await startExtensionExperiment(experiment, h.deps)

    expect(started.batch.ok).toBe(false)
    expect(started.experiment.status).toBe('awaitingDecision')
    expect(started.experiment.notes).toContain('已修改：third-party/a')
    expect(started.experiment.notes).toContain('失败：third-party/b')
    expect(h.deps.reloadPage).not.toHaveBeenCalled()
    expect(h.getDisabled()).toEqual(['third-party/a'])

    const kept = await finishExtensionExperiment(started.experiment, 'keep', h.deps)
    expect(kept.status).toBe('completed')
    expect(h.deps.reloadPage).toHaveBeenCalledOnce()

    const restoreHarness = harness()
    restoreHarness.failNames.add('third-party/b')
    const restoreList = await restoreHarness.deps.readExtensions()
    if (restoreList.status !== 'ready') throw new Error('expected inventory')
    const restoreSource = prepareExtensionExperiment('selectedExtensions', ['third-party/a', 'third-party/b'], restoreList, 'baseline', {
      now: restoreHarness.deps.now,
      createId: restoreHarness.deps.createId,
    })
    const restoreStarted = await startExtensionExperiment(restoreSource, restoreHarness.deps)
    h.failNames.clear()
    restoreHarness.failNames.clear()
    const restored = await finishExtensionExperiment(restoreStarted.experiment, 'restore', restoreHarness.deps)
    expect(restored.status).toBe('completed')
    expect(restoreHarness.getDisabled()).toEqual([])
  })

  it('returns to a retryable decision state when restoring the original list partially fails', async () => {
    const h = harness()
    const list = await h.deps.readExtensions()
    if (list.status !== 'ready') throw new Error('expected inventory')
    const source = prepareExtensionExperiment('selectedExtensions', ['third-party/a'], list, 'baseline', {
      now: h.deps.now,
      createId: h.deps.createId,
    })
    const started = await startExtensionExperiment(source, h.deps)
    const decision = recordExperimentComparison(
      resumeExtensionExperiment(started.experiment),
      'comparison',
    )
    h.failNames.add('third-party/a')

    const restoring = await finishExtensionExperiment(decision, 'restore', h.deps)

    expect(restoring.status).toBe('awaitingDecision')
    expect(restoring.reloadRequiredAfterDecision).toBe(false)
    expect(restoring.notes).toContain('恢复未全部成功')
    expect(h.deps.reloadPage).toHaveBeenCalledTimes(1)
  })

  it('resumes after reload, records comparison, and can keep the tested state', async () => {
    const h = harness()
    const list = await h.deps.readExtensions()
    if (list.status !== 'ready') throw new Error('expected inventory')
    const experiment = prepareExtensionExperiment('selectedExtensions', ['third-party/a'], list, 'baseline', {
      now: h.deps.now,
      createId: h.deps.createId,
    })
    const awaitingReload = (await startExtensionExperiment(experiment, h.deps)).experiment
    const sampling = resumeExtensionExperiment(awaitingReload)
    const decision = recordExperimentComparison(sampling, 'comparison')
    const completed = await finishExtensionExperiment(decision, 'keep', h.deps)

    expect(sampling.status).toBe('sampling')
    expect(decision).toMatchObject({ status: 'awaitingDecision', comparisonMeasurementId: 'comparison' })
    expect(completed.status).toBe('completed')
    expect(h.deps.backupStorage.removeItem).toHaveBeenCalled()
  })

  it('restores the complete original disabled list and reloads once', async () => {
    const h = harness(undefined, ['third-party/b'])
    const list = await h.deps.readExtensions()
    if (list.status !== 'ready') throw new Error('expected inventory')
    const experiment = prepareExtensionExperiment('selectedExtensions', ['third-party/a'], list, 'baseline', {
      now: h.deps.now,
      createId: h.deps.createId,
    })
    const awaitingReload = (await startExtensionExperiment(experiment, h.deps)).experiment
    vi.mocked(h.deps.reloadPage).mockClear()

    const completed = await finishExtensionExperiment(
      recordExperimentComparison(resumeExtensionExperiment(awaitingReload), 'comparison'),
      'restore',
      h.deps,
    )

    expect(completed.status).toBe('completed')
    expect(h.getDisabled()).toEqual(['third-party/b'])
    expect(h.deps.reloadPage).toHaveBeenCalledTimes(1)
    expect(h.deps.backupStorage.removeItem).toHaveBeenCalled()
  })
})

describe('binary isolation', () => {
  it('disables the first half and narrows to it when the symptom improves', async () => {
    const h = harness([
      item('third-party/st-stage'),
      item('third-party/a'),
      item('third-party/b'),
      item('third-party/c'),
      item('third-party/d'),
    ])
    const list = await h.deps.readExtensions()
    if (list.status !== 'ready') throw new Error('expected inventory')
    const experiment = prepareExtensionExperiment(
      'binaryIsolation',
      ['third-party/a', 'third-party/b', 'third-party/c', 'third-party/d'],
      list,
      'baseline',
      { now: h.deps.now, createId: h.deps.createId },
    )
    expect(experiment.trialDisabledExtensions).toEqual(['third-party/a', 'third-party/b'])
    const first = (await startExtensionExperiment(experiment, h.deps)).experiment
    vi.mocked(h.deps.reloadPage).mockClear()

    const next = await advanceBinaryIsolation(
      recordExperimentComparison(resumeExtensionExperiment(first), 'round-1'),
      true,
      h.deps,
    )

    expect(next.candidateExtensions).toEqual(['third-party/a', 'third-party/b'])
    expect(next.currentRound).toBe(2)
    expect(next.trialDisabledExtensions).toEqual(['third-party/a'])
    expect(h.getDisabled()).toEqual(['third-party/a'])
    expect(h.deps.reloadPage).toHaveBeenCalledTimes(1)
  })

  it('moves directly to sampling when the next round needs no extension changes', async () => {
    const h = harness([
      item('third-party/st-stage'),
      item('third-party/a'),
      item('third-party/b'),
    ])
    const list = await h.deps.readExtensions()
    if (list.status !== 'ready') throw new Error('expected inventory')
    const prepared = prepareExtensionExperiment(
      'binaryIsolation',
      ['third-party/a', 'third-party/b'],
      list,
      'baseline',
      { now: h.deps.now, createId: h.deps.createId },
    )
    const started = await startExtensionExperiment(prepared, h.deps)
    const decision = recordExperimentComparison(
      resumeExtensionExperiment(started.experiment),
      'comparison',
    )
    vi.mocked(h.deps.reloadPage).mockClear()

    const next = await advanceBinaryIsolation(decision, true, h.deps)

    expect(next.status).toBe('sampling')
    expect(next.candidateExtensions).toEqual(['third-party/a'])
    expect(h.deps.reloadPage).not.toHaveBeenCalled()
  })

  it('narrows to the other half when the symptom does not improve', async () => {
    const h = harness([
      item('third-party/st-stage'), item('third-party/a'), item('third-party/b'), item('third-party/c'), item('third-party/d'),
    ])
    const list = await h.deps.readExtensions()
    if (list.status !== 'ready') throw new Error('expected inventory')
    const experiment = prepareExtensionExperiment(
      'binaryIsolation',
      ['third-party/a', 'third-party/b', 'third-party/c', 'third-party/d'],
      list,
      'baseline',
      { now: h.deps.now, createId: h.deps.createId },
    )
    const first = (await startExtensionExperiment(experiment, h.deps)).experiment

    const next = await advanceBinaryIsolation(
      recordExperimentComparison(resumeExtensionExperiment(first), 'round-1'),
      false,
      h.deps,
    )

    expect(next.candidateExtensions).toEqual(['third-party/c', 'third-party/d'])
    expect(next.trialDisabledExtensions).toEqual(['third-party/c'])
    expect(h.getDisabled()).toEqual(['third-party/c'])
  })

  it('keeps a partially applied next round recoverable instead of stranding it in prepared state', async () => {
    const h = harness([
      item('third-party/st-stage'), item('third-party/a'), item('third-party/b'), item('third-party/c'), item('third-party/d'),
    ])
    const list = await h.deps.readExtensions()
    if (list.status !== 'ready') throw new Error('expected inventory')
    const experiment = prepareExtensionExperiment(
      'binaryIsolation',
      ['third-party/a', 'third-party/b', 'third-party/c', 'third-party/d'],
      list,
      'baseline',
      { now: h.deps.now, createId: h.deps.createId },
    )
    const first = (await startExtensionExperiment(experiment, h.deps)).experiment
    h.failNames.add('third-party/b')

    const next = await advanceBinaryIsolation(
      recordExperimentComparison(resumeExtensionExperiment(first), 'round-1'),
      true,
      h.deps,
    )

    expect(next.status).toBe('awaitingDecision')
    expect(next.notes).toContain('失败：third-party/b')
    expect(h.deps.reloadPage).toHaveBeenCalledTimes(1)
  })
})
