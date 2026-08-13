import type { PluginSettings, PresetPackOverride, Sprite } from './types'
import {
  getPresetPacks,
  isPresetPack,
  mergePresetPacks,
  presetSpriteKey,
  sanitizePresetOverrides,
} from './presets'
import { isSafeLocalUserImagePath } from './sprite-store'

type PresetMetadataInput = NonNullable<PresetPackOverride['metadata']>

function getCurrentPreset(presetId: string) {
  if (!isPresetPack(presetId)) return undefined
  return getPresetPacks().find((preset) => preset.id === presetId)
}

function withSanitizedOverride(
  settings: PluginSettings,
  presetId: string,
  rawOverride: Record<string, unknown>,
): PluginSettings {
  const sanitized = sanitizePresetOverrides({ [presetId]: rawOverride })[presetId]
  const presetOverrides = { ...settings.presetOverrides }
  if (sanitized) presetOverrides[presetId] = sanitized
  else delete presetOverrides[presetId]
  const materialized = mergePresetPacks(presetOverrides).find((preset) => preset.id === presetId)
  return {
    ...settings,
    presetOverrides,
    packs: materialized
      ? settings.packs.map((pack) => pack.id === presetId ? materialized : pack)
      : settings.packs,
  }
}

/** 为当前代码预设保存一张来自 ST 用户图片目录的本地立绘。 */
export function setPresetLocalSprite(
  settings: PluginSettings,
  presetId: string,
  sourceSprite: Pick<Sprite, 'group' | 'outfit' | 'tag'>,
  localUrl: string,
): PluginSettings {
  const preset = getCurrentPreset(presetId)
  if (!preset || typeof localUrl !== 'string' || !isSafeLocalUserImagePath(localUrl)) {
    return settings
  }

  const sourceKey = presetSpriteKey(sourceSprite)
  if (!preset.sprites.some((sprite) => presetSpriteKey(sprite) === sourceKey)) return settings

  const existing = settings.presetOverrides[presetId] ?? {}
  return withSanitizedOverride(settings, presetId, {
    ...existing,
    localSprites: {
      ...existing.localSprites,
      [sourceKey]: localUrl,
    },
  })
}

/** 保存经过现有预设覆盖层门禁清洗的包级元数据；null 表示清空元数据。 */
export function setPresetMetadata(
  settings: PluginSettings,
  presetId: string,
  metadata: PresetMetadataInput | null,
): PluginSettings {
  if (!getCurrentPreset(presetId)) return settings
  const existing = settings.presetOverrides[presetId] ?? {}
  return withSanitizedOverride(settings, presetId, {
    ...existing,
    metadata,
  })
}

/** 清除包级元数据覆盖，但保留本地立绘覆盖。 */
export function clearPresetMetadata(settings: PluginSettings, presetId: string): PluginSettings {
  if (!getCurrentPreset(presetId)) return settings
  const existing = settings.presetOverrides[presetId]
  if (!existing?.metadata) return settings

  const { metadata: _metadata, ...rest } = existing
  const presetOverrides = { ...settings.presetOverrides }
  if (Object.keys(rest).length > 0) presetOverrides[presetId] = rest
  else delete presetOverrides[presetId]
  const materialized = mergePresetPacks(presetOverrides).find((preset) => preset.id === presetId)
  return {
    ...settings,
    presetOverrides,
    packs: materialized
      ? settings.packs.map((pack) => pack.id === presetId ? materialized : pack)
      : settings.packs,
  }
}
