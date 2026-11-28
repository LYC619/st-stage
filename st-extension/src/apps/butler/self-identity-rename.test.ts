// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

const RENAMED = 'st-butler'

vi.mock('./self-identity', () => {
  const names = (dir: string) => (dir.includes('/') ? [dir] : [dir, `third-party/${dir}`])
  const matches = (name: string, dir: string) =>
    names(dir).some((c) => c.toLowerCase() === name?.trim().toLowerCase())
  return {
    FALLBACK_DIRECTORY_NAME: 'st-stage',
    SELF_DIRECTORY_NAME: RENAMED,
    installDirectoryName: () => RENAMED,
    selfExtensionNames: names,
    matchesSelf: matches,
    isSelfExtensionName: (name: string) => matches(name, RENAMED),
  }
})

const { createButlerBridge } = await import('./bridge')
const { applyDesiredDisabledExtensions } = await import('./experiments')

function extensionModule(selfName = `third-party/${RENAMED}`): Record<string, unknown> {
  const manifests: Record<string, unknown> = {
    expressions: { display_name: 'Expressions', dependencies: [] },
    [selfName]: { display_name: 'Butler', dependencies: [] },
  }
  const disabledExtensions: string[] = []
  return {
    extensionNames: ['expressions', selfName],
    extensionTypes: { expressions: 'system', [selfName]: 'local' },
    extension_settings: { disabledExtensions },
    findExtension: vi.fn((name: string) => (
      manifests[name] ? { name, enabled: !disabledExtensions.includes(name) } : null
    )),
    getExtensionManifest: vi.fn((name: string) => manifests[name] ?? null),
    enableExtension: vi.fn(async () => undefined),
    disableExtension: vi.fn(async () => undefined),
  }
}

describe('self-protection follows runtime directory name', () => {
  it('protects the renamed directory, stops protecting literal st-stage, and blocks batch self-disable', async () => {
    const renamedMod = extensionModule()
    const renamedBridge = createButlerBridge({ loadModule: async () => renamedMod })
    const blocked = await renamedBridge.setExtensionEnabled(`third-party/${RENAMED}`, false)
    expect(blocked).toMatchObject({ ok: false, code: 'protected' })
    expect((blocked as { error: string }).error).toContain(RENAMED)
    expect(renamedMod.disableExtension).not.toHaveBeenCalled()

    const otherMod = extensionModule('third-party/st-stage')
    const otherBridge = createButlerBridge({ loadModule: async () => otherMod })
    const allowed = await otherBridge.setExtensionEnabled('third-party/st-stage', false)
    expect(allowed.ok).toBe(true)
    expect(otherMod.disableExtension).toHaveBeenCalled()

    const setExtensionEnabled = vi.fn()
    const batch = await applyDesiredDisabledExtensions([`third-party/${RENAMED}`, 'third-party/a'], {
      readExtensions: vi.fn(async () => ({
        status: 'ready' as const,
        governance: { writable: true },
        disabledExtensions: [],
        extensions: [`third-party/${RENAMED}`, 'third-party/a'].map((name) => ({
          name,
          type: 'local',
          configuredEnabled: true,
          isSelf: false,
          manifest: { dependencies: { status: 'valid' as const, names: [] }, requiredModules: { status: 'absent' as const, names: [] } },
        })),
      })),
      setExtensionEnabled,
      persistExperiment: vi.fn(async () => undefined),
      reloadPage: vi.fn(),
    } as unknown as Parameters<typeof applyDesiredDisabledExtensions>[1])
    expect(batch.ok).toBe(false)
    expect(batch.failed[0]?.name).toBe(`third-party/${RENAMED}`)
    expect(setExtensionEnabled).not.toHaveBeenCalledWith(`third-party/${RENAMED}`, expect.anything())
  })
})
