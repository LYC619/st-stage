import { applyImageChanges, imageRefKey, scanEmbeddedImages, spriteImageRef, type ImageChange, type ImageRef } from './image-storage'
import { isPresetPack } from './presets'
import { migrateSettings } from './migrate'
import { createDefaultSettings, SETTINGS_VERSION, type PluginSettings } from './types'
import { localUserImagePath } from './sprite-store'

export interface StorageBackupV1 {
  format: 'st-stage-storage-backup@1'
  backupId: string
  createdAt: string
  settings: PluginSettings
  unmappedEmbedded: Array<{ location: string; value: string }>
}

export interface MigrationReceiptV1 {
  format: 'st-stage-image-migration-receipt@1'
  backupId: string
  entries: Array<{ ref: ImageRef; localUrl: string }>
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{32}$/i.test(value)
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function hasFields(value: unknown, fields: string[]): boolean {
  const record = object(value)
  return !!record && fields.every((key) => Object.hasOwn(record, key))
}

// Migration may add derived fields (e.g. image codes), but may not discard or change backup data.
function preservesFields(original: unknown, normalized: unknown): boolean {
  if (original === normalized) return true
  if (Array.isArray(original)) {
    return Array.isArray(normalized) && original.length === normalized.length &&
      original.every((value, index) => preservesFields(value, normalized[index]))
  }
  const record = object(original)
  const next = object(normalized)
  return !!record && !!next && Object.keys(record).every((key) =>
    Object.hasOwn(next, key) && preservesFields(record[key], next[key]))
}

export function findUnmappedEmbeddedImages(rawSettings: unknown, settings: PluginSettings): StorageBackupV1['unmappedEmbedded'] {
  const raw = object(rawSettings)
  if (!raw) return []
  const validRefs = new Map(scanEmbeddedImages(settings).candidates.map((item) => [imageRefKey(item.ref), item.sourceUrl]))
  const result: StorageBackupV1['unmappedEmbedded'] = []
  const rawPacks = Array.isArray(raw.packs) ? raw.packs : []
  rawPacks.forEach((rawPack, packIndex) => {
    const pack = object(rawPack)
    const sprites = pack && Array.isArray(pack.sprites) ? pack.sprites : []
    sprites.forEach((rawSprite, spriteIndex) => {
      const sprite = object(rawSprite)
      if (typeof sprite?.url !== 'string' || !/^data:/i.test(sprite.url)) return
      const ref: ImageRef = {
        packId: typeof pack?.id === 'string' ? pack.id : '',
        group: typeof sprite.group === 'string' ? sprite.group : '',
        outfit: typeof sprite.outfit === 'string' ? sprite.outfit : '',
        tag: typeof sprite.tag === 'string' ? sprite.tag : '',
      }
      if (isPresetPack(ref.packId) || validRefs.get(imageRefKey(ref)) !== sprite.url) {
        result.push({ location: 'packs[' + packIndex + '].sprites[' + spriteIndex + '].url', value: sprite.url })
      }
    })
  })
  const overrides = object(raw.presetOverrides)
  for (const [presetId, rawOverride] of Object.entries(overrides ?? {})) {
    const localSprites = object(object(rawOverride)?.localSprites)
    for (const [key, value] of Object.entries(localSprites ?? {})) {
      if (typeof value === 'string' && /^data:/i.test(value)) {
        result.push({ location: 'presetOverrides.' + presetId + '.localSprites.' + key, value })
      }
    }
  }
  return result
}

export function createStorageBackup(settings: PluginSettings, rawSettings: unknown, backupId: string, createdAt: string): StorageBackupV1 {
  if (!validId(backupId)) throw new Error('备份 ID 不合法')
  if (!createdAt) throw new Error('备份时间不合法')
  const persisted = { ...settings, packs: settings.packs.filter((pack) => !isPresetPack(pack.id)) }
  const backup: StorageBackupV1 = { format: 'st-stage-storage-backup@1', backupId, createdAt, settings: persisted, unmappedEmbedded: findUnmappedEmbeddedImages(rawSettings, persisted) }
  return JSON.parse(JSON.stringify(backup)) as StorageBackupV1
}

export function parseStorageBackup(text: string): StorageBackupV1 {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch (error) { throw new Error('存储备份不是有效 JSON', { cause: error }) }
  const raw = object(parsed)
  if (!raw || raw.format !== 'st-stage-storage-backup@1' || !validId(raw.backupId) || typeof raw.createdAt !== 'string' || !raw.createdAt || !Array.isArray(raw.unmappedEmbedded)) throw new Error('存储备份格式或版本不支持')
  if (raw.unmappedEmbedded.some((item) => { const entry = object(item); return typeof entry?.location !== 'string' || typeof entry.value !== 'string' || !/^data:/i.test(entry.value) })) throw new Error('存储备份附录不合法')
  const rawSettings = object(raw.settings)
  const defaults = createDefaultSettings()
  if (!rawSettings || !Array.isArray(rawSettings.packs) || rawSettings.settingsVersion !== SETTINGS_VERSION ||
    !hasFields(rawSettings, Object.keys(defaults)) ||
    !hasFields(rawSettings.overlay, Object.keys(defaults.overlay)) ||
    !hasFields(rawSettings.phone, Object.keys(defaults.phone)) ||
    !Array.isArray(rawSettings.bindings) ||
    rawSettings.bindings.some((binding) => !hasFields(binding, ['characterName', 'packIds', 'enabled']))) {
    throw new Error('存储备份设置不合法')
  }
  const settings = migrateSettings(rawSettings)
  if (
    settings.packs.some((pack) => isPresetPack(pack.id)) ||
    !preservesFields(rawSettings, settings)
  ) {
    throw new Error('存储备份设置不合法')
  }
  const packIds = new Set<string>()
  const refs = new Set<string>()
  for (const pack of settings.packs) {
    if (packIds.has(pack.id)) throw new Error('存储备份包含重复图片身份')
    packIds.add(pack.id)
    for (const sprite of pack.sprites) {
      const key = imageRefKey(spriteImageRef(pack, sprite))
      if (refs.has(key)) throw new Error('存储备份包含重复图片身份')
      refs.add(key)
    }
  }
  return { format: 'st-stage-storage-backup@1', backupId: raw.backupId, createdAt: raw.createdAt, settings: rawSettings as unknown as PluginSettings, unmappedEmbedded: raw.unmappedEmbedded as StorageBackupV1['unmappedEmbedded'] }
}

function assertLocalUrl(url: string): string {
  const normalized = localUserImagePath(url)
  const hasControl = Array.from(url).some((char) => char.charCodeAt(0) < 32)
  if (!normalized || !url.startsWith('/user/images/') || /[?#\\]/.test(url) || hasControl ||
    /%(?:2f|5c)/i.test(url) || normalized.endsWith('/') || normalized.includes('//')) {
    throw new Error('迁移回执包含不安全的本地图片路径')
  }
  return url
}

export function createMigrationReceipt(backup: StorageBackupV1, ready: ImageChange[]): MigrationReceiptV1 {
  const scan = scanEmbeddedImages(backup.settings)
  if (scan.ambiguous.length > 0) throw new Error('迁移回执与备份不匹配')
  const sourceByRef = new Map(scan.candidates.map((item) => [imageRefKey(item.ref), item]))
  const keys = new Set<string>()
  const entries = ready.map((change) => {
    const key = imageRefKey(change.ref)
    const source = sourceByRef.get(key)
    if (keys.has(key)) throw new Error('迁移回执包含重复图片身份')
    if (!source || source.sourceUrl !== change.expectedUrl) throw new Error('迁移回执与备份不匹配')
    keys.add(key)
    return { ref: change.ref, localUrl: assertLocalUrl(change.nextUrl) }
  })
  return { format: 'st-stage-image-migration-receipt@1', backupId: backup.backupId, entries }
}

export function parseMigrationReceipt(text: string, backup: StorageBackupV1): MigrationReceiptV1 {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch (error) { throw new Error('迁移回执不是有效 JSON', { cause: error }) }
  const raw = object(parsed)
  if (!raw || raw.format !== 'st-stage-image-migration-receipt@1' || raw.backupId !== backup.backupId || !Array.isArray(raw.entries)) throw new Error('迁移回执与备份不匹配')
  const scan = scanEmbeddedImages(backup.settings)
  if (scan.ambiguous.length > 0) throw new Error('迁移回执与备份不匹配')
  const sourceByRef = new Map(scan.candidates.map((item) => [imageRefKey(item.ref), item]))
  const keys = new Set<string>()
  const entries = raw.entries.map((item) => {
    const entry = object(item)
    const ref = object(entry?.ref)
    if (!ref || typeof ref.packId !== 'string' || typeof ref.group !== 'string' || typeof ref.outfit !== 'string' || typeof ref.tag !== 'string' || typeof entry?.localUrl !== 'string') throw new Error('迁移回执条目不合法')
    const normalized: ImageRef = { packId: ref.packId, group: ref.group, outfit: ref.outfit, tag: ref.tag }
    const key = imageRefKey(normalized)
    if (keys.has(key) || !sourceByRef.has(key)) throw new Error('迁移回执与备份不匹配')
    keys.add(key)
    assertLocalUrl(entry.localUrl)
    return { ref: normalized, localUrl: entry.localUrl }
  })
  return { format: 'st-stage-image-migration-receipt@1', backupId: backup.backupId, entries }
}

export function restoreMigratedImages(latest: PluginSettings, backup: StorageBackupV1, receipt: MigrationReceiptV1) {
  if (receipt.backupId !== backup.backupId) throw new Error('迁移回执与备份不匹配')
  if (receipt.format !== 'st-stage-image-migration-receipt@1') throw new Error('迁移回执格式不支持')
  const scan = scanEmbeddedImages(backup.settings)
  if (scan.ambiguous.length > 0) throw new Error('迁移回执与备份不匹配')
  const sourceByRef = new Map(scan.candidates.map((item) => [imageRefKey(item.ref), item]))
  const keys = new Set<string>()
  const changes = receipt.entries.map((entry) => {
    const key = imageRefKey(entry.ref)
    const source = sourceByRef.get(imageRefKey(entry.ref))
    if (keys.has(key) || !source) throw new Error('迁移回执与备份不匹配')
    keys.add(key)
    const localUrl = assertLocalUrl(entry.localUrl)
    return { ref: entry.ref, expectedUrl: localUrl, nextUrl: source.sourceUrl }
  })
  return applyImageChanges(latest, changes)
}
