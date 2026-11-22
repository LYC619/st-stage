import type { EmojiItem, PhotoItem, WeChatConfig } from './types'
import { isSafePath } from '../path-utils'

export type StateMappings = Partial<Record<'mood' | 'interest' | 'money' | 'location', string>>
export interface WeChatProfile {
  preset: 'cohabitation' | 'general'
  playerName: string
  contactName: string
  openingMessage: string
  scene?: string
  contextMessageCount: number
  includeWorldbook?: boolean
  useBuiltinAssets: boolean
  /** 内置素材组开关；旧数据缺省全部启用，避免通用角色出现空表情抽屉 */
  assetGroups: { player: boolean; contact: boolean; photo: boolean }
  mappings: StateMappings
  assetOverrides: Record<string, string>
  /** 允许在设置中修订内置素材名称和含义 */
  assetEdits: Record<string, { name?: string; description?: string }>
  /** 自定义回复与状态提示词；空串表示内置默认 */
  replyPrompt?: string
  statePrompt?: string
  formatPrompt?: string
  customAssets: Record<string, EmojiItem>
}

export function safeAssetUrl(value: string): boolean {
  if (value.startsWith('/user/images/')) {
    try {
      const decoded = decodeURIComponent(value)
      return /^\/user\/images\/[\w\-./ \u0080-\uffff]+$/.test(decoded)
        && !decoded.split('/').some(segment => segment === '.' || segment === '..')
    } catch { return false }
  }
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
}

export function normalizeProfile(config?: WeChatConfig): WeChatProfile {
  const raw = config?.profile
  const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''
  const mappings: StateMappings = {}
  for (const field of ['mood', 'interest', 'money', 'location'] as const) {
    const value = text(raw?.mappings?.[field], 200)
    if (value && isSafePath(value)) mappings[field] = value
  }
  const assetOverrides: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw?.assetOverrides ?? {}).slice(0, 100)) {
    if (/^(player|contact|photo)\.[\w-]+$/.test(key) && typeof value === 'string' && safeAssetUrl(value)) assetOverrides[key] = value
  }
  const rawGroups = raw?.assetGroups
  const assetGroups = {
    player: typeof rawGroups?.player === 'boolean' ? rawGroups.player : raw?.useBuiltinAssets !== false,
    contact: typeof rawGroups?.contact === 'boolean' ? rawGroups.contact : raw?.useBuiltinAssets !== false,
    photo: typeof rawGroups?.photo === 'boolean' ? rawGroups.photo : raw?.preset === 'cohabitation' && raw?.useBuiltinAssets !== false,
  }
  const assetEdits: Record<string, { name?: string; description?: string }> = {}
  if (raw?.assetEdits && typeof raw.assetEdits === 'object' && !Array.isArray(raw.assetEdits)) {
    for (const [key, edit] of Object.entries(raw.assetEdits).slice(0, 200)) {
      if (!/^(player|contact|photo)\.[\w-]+$/.test(key) || !edit || typeof edit !== 'object') continue
      const item = edit as Record<string, unknown>
      const name = typeof item.name === 'string' ? item.name.trim().slice(0, 60) : undefined
      const description = typeof item.description === 'string' ? item.description.trim().slice(0, 200) : undefined
      if (name || description) assetEdits[key] = { ...(name ? { name } : {}), ...(description ? { description } : {}) }
    }
  }
  const customAssets: Record<string, EmojiItem> = {}
  for (const [key, item] of Object.entries(raw?.customAssets ?? {}).slice(0, 100)) {
    if (!/^(player|contact|photo)\.custom-[\w-]+$/.test(key) || !item || typeof item.file !== 'string' || !safeAssetUrl(item.file)) continue
    customAssets[key] = { name: text(item.name, 60) || '图库图片', description: text(item.description, 200), file: item.file }
  }
  return {
    preset: raw?.preset === 'general' ? 'general' : 'cohabitation',
    playerName: text(raw?.playerName, 60), contactName: text(raw?.contactName, 60), openingMessage: text(raw?.openingMessage, 500),
    scene: text(raw?.scene, 2000),
    contextMessageCount: typeof raw?.contextMessageCount === 'number' && Number.isFinite(raw.contextMessageCount)
      ? Math.max(0, Math.min(20, Math.trunc(raw.contextMessageCount))) : 12,
    includeWorldbook: raw?.includeWorldbook !== false,
    useBuiltinAssets: raw?.useBuiltinAssets !== false,
    assetGroups,
    mappings, assetOverrides, assetEdits, customAssets,
    replyPrompt: text(raw?.replyPrompt, 12000), statePrompt: text(raw?.statePrompt, 8000),
    formatPrompt: text(raw?.formatPrompt, 4000),
  }
}

export function applyAssetProfile<T extends EmojiItem | PhotoItem>(items: Record<string, T>, prefix: string, profile: WeChatProfile): Record<string, T> {
  if (!profile.assetGroups[prefix as keyof WeChatProfile['assetGroups']]) return {}
  const custom = Object.fromEntries(Object.entries(profile.customAssets).filter(([key]) => key.startsWith(`${prefix}.`)).map(([key, item]) => [key.slice(prefix.length + 1), item]))
  return Object.fromEntries(Object.entries({ ...items, ...custom })
    .map(([id, item]) => {
      const edit = profile.assetEdits[`${prefix}.${id}`]
      return [id, {
        ...item,
        file: profile.assetOverrides[`${prefix}.${id}`] ?? item.file,
        ...(edit?.name ? { name: edit.name } : {}),
        ...(edit?.description ? { description: edit.description } : {}),
      } as T]
    }))
}

/** Explicit paths are relative to stat_data and never fall back to an unrelated alias. */
export function mappedValue(raw: Record<string, unknown>, field: string): unknown {
  if (!isSafePath(field)) return undefined
  let value: unknown = raw.stat_data && typeof raw.stat_data === 'object' && !Array.isArray(raw.stat_data) ? raw.stat_data : raw
  for (const key of field.split('.')) {
    if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, key)) return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}
