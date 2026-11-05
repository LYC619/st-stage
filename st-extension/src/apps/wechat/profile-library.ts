import { normalizeProfile, safeAssetUrl, type WeChatProfile } from './profile'
import { isSafePath } from '../path-utils'
import type { WeChatConfig } from './types'
import { stableCharacterKey, isStableCharacterKey as validKey } from '../../../../core/character-identity'

export interface WeChatProfileTemplate { id: string; name: string; profile: WeChatProfile }
const MAX_TEMPLATES = 30
const MAX_TEXT = 64 * 1024
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
function record(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null
}
export class ProfileLibraryError extends Error {
  constructor(public code: 'invalid' | 'name' | 'duplicate' | 'limit') { super(code) }
}
export const profileCharacterKey = stableCharacterKey
export function hasCharacterProfile(config: WeChatConfig, key: string | null): boolean {
  return !!key && validKey(key) && record(config.characterProfiles) && own(config.characterProfiles, key) && record(config.characterProfiles[key])
}
export function resolveProfile(config: WeChatConfig, key: string | null): WeChatProfile {
  return normalizeProfile(hasCharacterProfile(config, key) ? { profile: config.characterProfiles![key!] } : config)
}
export function saveScopedProfile(config: WeChatConfig, key: string | null, profile: WeChatProfile): WeChatConfig {
  const normalized = normalizeProfile({ profile })
  if (key === null) return { ...config, profile: normalized }
  if (!validKey(key)) throw new ProfileLibraryError('invalid')
  return { ...config, characterProfiles: { ...config.characterProfiles, [key]: normalized } }
}
export function inheritProfile(config: WeChatConfig, key: string): WeChatConfig {
  const characterProfiles = { ...config.characterProfiles }
  delete characterProfiles[key]
  return { ...config, characterProfiles }
}
function templateName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 60) throw new ProfileLibraryError('name')
  return value.trim()
}
function strictProfile(value: unknown): WeChatProfile {
  if (!record(value)) throw new ProfileLibraryError('invalid')
  const keys = ['preset', 'playerName', 'contactName', 'openingMessage', 'contextMessageCount', 'useBuiltinAssets', 'mappings', 'assetOverrides']
  const optional = ['assetGroups', 'assetEdits', 'customAssets', 'replyPrompt', 'statePrompt', 'formatPrompt', 'scene']
  if (Object.keys(value).some(key => !keys.includes(key) && !optional.includes(key)) || keys.some(key => !own(value, key))) throw new ProfileLibraryError('invalid')
  if (!['general', 'cohabitation'].includes(value.preset as string) || typeof value.useBuiltinAssets !== 'boolean'
    || !Number.isInteger(value.contextMessageCount) || (value.contextMessageCount as number) < 0 || (value.contextMessageCount as number) > 20) throw new ProfileLibraryError('invalid')
  for (const [field, limit] of [['playerName', 60], ['contactName', 60], ['openingMessage', 500]] as const) {
    if (typeof value[field] !== 'string' || value[field].length > limit) throw new ProfileLibraryError('invalid')
  }
  if (!record(value.mappings) || Object.entries(value.mappings).some(([key, path]) =>
    !['mood', 'interest', 'money', 'location'].includes(key) || typeof path !== 'string' || path.length > 200 || !isSafePath(path))) throw new ProfileLibraryError('invalid')
  if (!record(value.assetOverrides) || Object.keys(value.assetOverrides).length > 100 || Object.entries(value.assetOverrides).some(([key, url]) =>
    !/^(player|contact|photo)\.[\w-]+$/.test(key) || typeof url !== 'string' || !safeAssetUrl(url))) throw new ProfileLibraryError('invalid')
  for (const [key, limit] of [['replyPrompt', 12000], ['statePrompt', 8000], ['formatPrompt', 4000], ['scene', 2000]] as const) {
    if (own(value, key) && (typeof value[key] !== 'string' || value[key].length > limit)) throw new ProfileLibraryError('invalid')
  }
  if (own(value, 'assetGroups') && (!record(value.assetGroups) || Object.keys(value.assetGroups).length !== 3 || !['player', 'contact', 'photo'].every(key => typeof (value.assetGroups as Record<string, unknown>)[key] === 'boolean'))) throw new ProfileLibraryError('invalid')
  if (own(value, 'assetEdits') && (!record(value.assetEdits) || Object.keys(value.assetEdits).length > 200 || Object.entries(value.assetEdits).some(([key, edit]) =>
    !/^(player|contact|photo)\.[\w-]+$/.test(key) || !record(edit) || Object.entries(edit).some(([field, text]) => !['name', 'description'].includes(field) || typeof text !== 'string' || text.length > (field === 'name' ? 60 : 200))))) throw new ProfileLibraryError('invalid')
  if (own(value, 'customAssets') && (!record(value.customAssets) || Object.keys(value.customAssets).length > 100 || Object.entries(value.customAssets).some(([key, item]) =>
    !/^(player|contact|photo)\.custom-[\w-]+$/.test(key) || !record(item) || Object.keys(item).some(field => !['name', 'description', 'file'].includes(field)) || typeof item.name !== 'string' || item.name.length > 60 || typeof item.description !== 'string' || item.description.length > 200 || typeof item.file !== 'string' || !safeAssetUrl(item.file)))) throw new ProfileLibraryError('invalid')
  return normalizeProfile({ profile: value as unknown as WeChatProfile })
}
export function encodeProfileTemplate(name: string, profile: WeChatProfile): string {
  const encoded = JSON.stringify({ format: 'baigong-wechat-profile', version: 1, name: templateName(name), profile: normalizeProfile({ profile }) }, null, 2)
  if (new TextEncoder().encode(encoded).length > MAX_TEXT) throw new ProfileLibraryError('invalid')
  return encoded
}
export function decodeProfileTemplate(text: string): Omit<WeChatProfileTemplate, 'id'> {
  if (text.length > MAX_TEXT || new TextEncoder().encode(text).length > MAX_TEXT) throw new ProfileLibraryError('invalid')
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new ProfileLibraryError('invalid') }
  if (!record(raw) || raw.format !== 'baigong-wechat-profile' || raw.version !== 1
    || Object.keys(raw).some(key => !['format', 'version', 'name', 'profile'].includes(key))) throw new ProfileLibraryError('invalid')
  return { name: templateName(raw.name), profile: strictProfile(raw.profile) }
}
export function normalizeTemplates(raw: unknown): WeChatProfileTemplate[] {
  if (!Array.isArray(raw)) return []
  const result: WeChatProfileTemplate[] = []
  for (const entry of raw) {
    if (result.length === MAX_TEMPLATES) break
    if (!record(entry) || typeof entry.id !== 'string' || !/^[\w-]{1,100}$/.test(entry.id) || result.some(item => item.id === entry.id)) continue
    try {
      const name = templateName(entry.name)
      if (!result.some(item => item.name === name)) result.push({ id: entry.id, name, profile: strictProfile(entry.profile) })
    } catch { /* Skip malformed stored entries without invalidating the usable library. */ }
  }
  return result
}
export function addProfileTemplate(list: WeChatProfileTemplate[], name: string, profile: WeChatProfile): WeChatProfileTemplate[] {
  const normalized = normalizeTemplates(list), validName = templateName(name)
  if (normalized.some(item => item.name === validName)) throw new ProfileLibraryError('duplicate')
  if (normalized.length >= MAX_TEMPLATES) throw new ProfileLibraryError('limit')
  const id = globalThis.crypto?.randomUUID?.() ?? `template-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const clean = decodeProfileTemplate(encodeProfileTemplate(validName, profile))
  return [...normalized, { id, ...clean }]
}
