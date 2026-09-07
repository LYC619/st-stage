import { describe, expect, it } from 'vitest'
import { createDefaultSettings, type PluginSettings } from './types'
import { createMigrationReceipt, createStorageBackup, parseMigrationReceipt, parseStorageBackup, restoreMigratedImages } from './image-storage-backup'
import { scanEmbeddedImages } from './image-storage'

const one = 'data:image/png;base64,QUFB'
const two = 'data:image/gif;base64,QkJC'
const id = '0123456789abcdef0123456789abcdef'

function fixture(): PluginSettings {
  return { ...createDefaultSettings(), packs: [{ id: 'custom', name: '原包', inventoryPrompt: '保留',
    sprites: [{ tag: '一', url: one }, { tag: '二', url: two, remoteUrl: 'https://img.test/two.gif' }] }] }
}

describe('storage backup and migration receipt', () => {
  it.each(['sprites', 'overlay', 'phone', 'binding'])('rejects a backup with missing required nested fields: %s', (field) => {
    const backup = createStorageBackup(fixture(), fixture(), id, 'now')
    const raw = JSON.parse(JSON.stringify(backup))
    if (field === 'sprites') delete raw.settings.packs[0].sprites
    if (field === 'overlay') delete raw.settings.overlay.x
    if (field === 'phone') delete raw.settings.phone.open
    if (field === 'binding') raw.settings.bindings = [{ characterName: 'Alice', packIds: ['custom'] }]
    expect(() => parseStorageBackup(JSON.stringify(raw))).toThrow('设置')
  })

  it('round trips a persistable snapshot and records only unmapped embedded values', () => {
    const settings = fixture()
    const raw = { ...settings, apps: { private: { token: one } }, packs: settings.packs }
    const backup = createStorageBackup(settings, raw, id, '2026-09-06T00:00:00+08:00')
    expect(backup.settings.packs).toEqual(settings.packs)
    expect(backup.unmappedEmbedded).toEqual([])
    const parsed = parseStorageBackup(JSON.stringify(backup))
    expect(parsed).toEqual(backup)
    expect(JSON.stringify(backup)).not.toContain('token')
  })

  it('keeps data from a raw preset copy as an unmapped appendix', () => {
    const settings = fixture()
    const presetRaw = { ...settings, packs: [{ id: 'preset_seraphina_casual', name: '预设', sprites: [{ tag: '一', url: one }] }] }
    const backup = createStorageBackup(settings, presetRaw, id, 'now')
    expect(backup.unmappedEmbedded).toHaveLength(1)
    expect(backup.unmappedEmbedded[0].location).toContain('packs[0]')
  })

  it('round trips mixed hosted/local images without requiring derived codes', () => {
    const settings = fixture()
    settings.packs[0].sprites.push({ tag: '远程', url: 'https://files.catbox.moe/test.png' })
    settings.packs[0].sprites.push({ tag: '本地', url: '/user/images/saved.png' })
    settings.apps = { private: { key: 'synthetic-secret', nested: { url: one } } }
    const backup = createStorageBackup(settings, settings, id, 'now')
    expect(parseStorageBackup(JSON.stringify(backup))).toEqual(backup)
    settings.packs[0].sprites[0].url = two
    settings.apps.private = { changed: true }
    expect(backup.settings.packs[0].sprites[0].url).toBe(one)
    expect(backup.settings.apps.private).toEqual({ key: 'synthetic-secret', nested: { url: one } })
  })

  it('preserves raw embedded values with the same ref but different bytes', () => {
    const settings = fixture()
    const raw = structuredClone(settings)
    raw.packs[0].sprites[0].url = two
    expect(createStorageBackup(settings, raw, id, 'now').unmappedEmbedded).toEqual([
      { location: 'packs[0].sprites[0].url', value: two },
    ])
  })

  it('rejects ambiguous identities and incomplete settings in parsed backups', () => {
    const backup = createStorageBackup(fixture(), fixture(), id, 'now')
    backup.settings.packs.push(structuredClone(backup.settings.packs[0]))
    expect(() => parseStorageBackup(JSON.stringify(backup))).toThrow('身份')
    const missing = createStorageBackup(fixture(), fixture(), id, 'now')
    delete (missing.settings as Partial<PluginSettings>).apps
    expect(() => parseStorageBackup(JSON.stringify(missing))).toThrow('设置')
  })

  it('preserves safe encoded URLs and rejects aliases with URL suffixes or traversal', () => {
    const backup = createStorageBackup(fixture(), fixture(), id, 'now')
    const candidate = scanEmbeddedImages(backup.settings).candidates[0]
    const receipt = createMigrationReceipt(backup, [{ ref: candidate.ref, expectedUrl: one, nextUrl: '/user/images/a%23b.png' }])
    expect(parseMigrationReceipt(JSON.stringify(receipt), backup).entries[0].localUrl).toBe('/user/images/a%23b.png')
    for (const url of ['/user/images/a.png#x', '/user/images/a.png?x', '/user/images/%2e%2e/a.png', '/user/images/a\\b.png', '/user/images/']) {
      expect(() => createMigrationReceipt(backup, [{ ref: candidate.ref, expectedUrl: one, nextUrl: url }])).toThrow('不安全')
    }
  })

  it('rejects malformed, future, mismatched and duplicate receipts', () => {
    const backup = createStorageBackup(fixture(), fixture(), id, 'now')
    expect(() => parseStorageBackup('{}')).toThrow('格式')
    expect(() => parseStorageBackup(JSON.stringify({ ...backup, backupId: 'bad' }))).toThrow('格式')
    expect(() => parseStorageBackup(JSON.stringify({ ...backup, createdAt: '' }))).toThrow('格式')
    expect(() => parseMigrationReceipt(JSON.stringify({ format: 'st-stage-image-migration-receipt@1', backupId: 'f'.repeat(32), entries: [] }), backup)).toThrow('不匹配')
    const ref = scanEmbeddedImages(backup.settings).candidates[0].ref
    const entry = { ref, localUrl: '/user/images/a.png' }
    const duplicate = { format: 'st-stage-image-migration-receipt@1', backupId: id, entries: [entry, entry] }
    expect(() => parseMigrationReceipt(JSON.stringify(duplicate), backup)).toThrow('不匹配')
    expect(() => createMigrationReceipt(backup, [{ ref, expectedUrl: one, nextUrl: 'data:image/png;base64,AA==' }])).toThrow('不安全')
    expect(() => createMigrationReceipt(backup, [{ ref: { ...ref, tag: '不存在' }, expectedUrl: one, nextUrl: '/user/images/a.png' }]))
      .toThrow('不匹配')
    expect(() => createMigrationReceipt(backup, [{ ref, expectedUrl: two, nextUrl: '/user/images/a.png' }]))
      .toThrow('不匹配')
    expect(() => createMigrationReceipt(backup, [{ ref, expectedUrl: one, nextUrl: '/user/images/a.png?cache=1' }]))
      .toThrow('不安全')
  })

  it('rejects a backup when migration would silently discard known settings data', () => {
    const backup = createStorageBackup(fixture(), fixture(), id, 'now')
    const invalid = structuredClone(backup) as unknown as Record<string, unknown>
    const settings = invalid.settings as Record<string, unknown>
    const packs = settings.packs as Array<Record<string, unknown>>
    packs[0].inventoryPrompt = 42
    expect(() => parseStorageBackup(JSON.stringify(invalid))).toThrow('设置')

    const withUnknownRoot = structuredClone(backup) as unknown as Record<string, unknown>
    ;(withUnknownRoot.settings as Record<string, unknown>).unexpected = true
    expect(() => parseStorageBackup(JSON.stringify(withUnknownRoot))).toThrow('设置')
  })

  it('restores only unchanged migrated references and preserves later edits/apps', () => {
    const original = fixture()
    const backup = createStorageBackup(original, original, id, 'now')
    const candidates = scanEmbeddedImages(original).candidates
    const receipt = createMigrationReceipt(backup, candidates.map((candidate, index) => ({
      ref: candidate.ref, expectedUrl: candidate.sourceUrl, nextUrl: `/user/images/migrated-${index}.png`,
    })))
    const apps = { private: { changed: true } }
    const latest: PluginSettings = { ...original, apps, packs: [{ ...original.packs[0], name: '新包名', sprites: [
      { ...original.packs[0].sprites[0], url: '/user/images/migrated-0.png' },
      { ...original.packs[0].sprites[1], url: '/user/images/new-edit.gif' },
    ] }] }
    const result = restoreMigratedImages(latest, backup, receipt)
    expect(result.applied).toHaveLength(1)
    expect(result.conflicts).toHaveLength(1)
    expect(result.settings.packs[0].name).toBe('新包名')
    expect(result.settings.packs[0].sprites[0].url).toBe(one)
    expect(result.settings.packs[0].sprites[1].url).toBe('/user/images/new-edit.gif')
    expect(result.settings.apps).toBe(apps)
  })
})
