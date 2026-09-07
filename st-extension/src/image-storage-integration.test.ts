// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyImageChanges, scanEmbeddedImages } from '../../core/image-storage'
import { createMigrationReceipt, createStorageBackup, parseMigrationReceipt, parseStorageBackup, restoreMigratedImages } from '../../core/image-storage-backup'
import { createDefaultSettings, type PluginSettings } from '../../core/types'
import { stageEmbeddedImages } from './image-storage'
import { STAdapter } from './st-adapter'

afterEach(() => {
  delete window.SillyTavern
})

describe('large settings migration through the ST persistence boundary', () => {
  it('shrinks 30 MiB of embedded settings, reloads, restores and migrates again without touching Apps', async () => {
    const first = 'data:image/png;base64,' + 'QUFB'.repeat(4 * 1024 * 1024)
    const second = 'data:image/gif;base64,' + 'QkJC'.repeat(4 * 1024 * 1024)
    const original: PluginSettings = { ...createDefaultSettings(), packs: [{
      id: 'large', name: 'large', inventoryPrompt: 'preserved',
      sprites: [{ tag: 'one', url: first, labels: ['original'] }, { tag: 'two', url: second }],
    }], apps: { private: { credential: 'synthetic-only', image: 'data:image/png;base64,Q0ND' } } }
    const context = { extensionSettings: { sprite_overlay: original }, saveSettingsDebounced: vi.fn() }
    window.SillyTavern = { getContext: () => context } as never
    const adapter = new STAdapter()
    const loaded = await adapter.loadSettings()
    expect(context.saveSettingsDebounced).not.toHaveBeenCalled()
    const backup = parseStorageBackup(JSON.stringify(createStorageBackup(loaded, adapter.getStoredSettingsForBackup(), 'a'.repeat(32), 'now')))
    expect(new Blob([JSON.stringify(backup.settings)]).size).toBeGreaterThan(30 * 1024 * 1024)
    const scan = scanEmbeddedImages(loaded)
    const save = vi.fn(async (source: string) => source === first ? '/user/images/one.png' : '/user/images/two.gif')
    const stage = await stageEmbeddedImages(scan.candidates, { save })
    expect(stage.failed).toEqual([])
    expect(save).toHaveBeenCalledTimes(2)
    expect(context.extensionSettings.sprite_overlay.packs[0].sprites[0].url).toBe(first)
    const receipt = parseMigrationReceipt(JSON.stringify(createMigrationReceipt(backup, stage.ready)), backup)
    const applied = applyImageChanges(loaded, stage.ready)
    await adapter.saveSettings(applied.settings)
    // Simulate the host's JSON round trip, not a real server save acknowledgement.
    context.extensionSettings.sprite_overlay = JSON.parse(JSON.stringify(context.extensionSettings.sprite_overlay))
    expect(new Blob([JSON.stringify(context.extensionSettings.sprite_overlay)]).size).toBeLessThan(10 * 1024)
    const reloaded = await new STAdapter().loadSettings()
    const custom = reloaded.packs.find((pack) => pack.id === 'large')!
    expect(custom.inventoryPrompt).toBe('preserved')
    expect(custom.sprites.map((sprite) => sprite.url)).toEqual(['/user/images/one.png', '/user/images/two.gif'])
    expect(reloaded.apps).toEqual(original.apps)
    const restored = restoreMigratedImages(reloaded, backup, receipt)
    expect(restored.applied).toHaveLength(2)
    await adapter.saveSettings(restored.settings)
    expect(context.extensionSettings.sprite_overlay.packs[0]).toEqual(original.packs[0])
    expect(context.extensionSettings.sprite_overlay.apps).toEqual(original.apps)
    const repeated = await stageEmbeddedImages(scanEmbeddedImages(await adapter.loadSettings()).candidates, { save })
    await adapter.saveSettings(applyImageChanges(await adapter.loadSettings(), repeated.ready).settings)
    expect(scanEmbeddedImages(await adapter.loadSettings()).candidates).toHaveLength(0)
    expect(context.saveSettingsDebounced).toHaveBeenCalledTimes(3)
  })
})
