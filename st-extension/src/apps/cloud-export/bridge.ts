import type {
  ExportCharacter,
  ExportChat,
  ExportPreset,
  ExportSettingsAssets,
  ExportRegexSet,
  ExportWorldbook,
} from './types'

interface STContextLike {
  getRequestHeaders?: () => Record<string, string>
}

interface RawRecord {
  [key: string]: unknown
}

export interface CloudExportBridge {
  listCharacters(): Promise<ExportCharacter[]>
  listChats(character: ExportCharacter): Promise<ExportChat[]>
  listWorldbooks(): Promise<ExportWorldbook[]>
  loadSettingsAssets(): Promise<ExportSettingsAssets>
  readWorldbook(worldbook: ExportWorldbook): Promise<unknown>
  readCharacterCard(character: ExportCharacter): Promise<ArrayBuffer>
  readChat(character: ExportCharacter, chat: ExportChat): Promise<string>
}

function getSTContext(): STContextLike | undefined {
  try {
    const host = window as Window & { SillyTavern?: { getContext?: () => unknown } }
    return host.SillyTavern?.getContext?.() as STContextLike | undefined
  } catch {
    return undefined
  }
}

function requestHeaders(): Record<string, string> {
  return getSTContext()?.getRequestHeaders?.() ?? { 'Content-Type': 'application/json' }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { ...requestHeaders(), ...(init.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`${path} 请求失败（${response.status}）`)
  return response.json() as Promise<T>
}

async function requestBinary(path: string, init: RequestInit = {}): Promise<ArrayBuffer> {
  const response = await fetch(path, {
    ...init,
    headers: { ...requestHeaders(), ...(init.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`${path} 请求失败（${response.status}）`)
  return response.arrayBuffer()
}

function asRecord(value: unknown): RawRecord {
  return value && typeof value === 'object' ? value as RawRecord : {}
}

function asArray(value: unknown, keys: string[] = []): RawRecord[] {
  if (Array.isArray(value)) return value.map(asRecord)
  const record = asRecord(value)
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key].map(asRecord)
  }
  return []
}

function text(record: RawRecord, keys: string[], fallback = ''): string {
  for (const key of keys) {
    if (typeof record[key] === 'string' && record[key]) return record[key] as string
  }
  return fallback
}

function timestamp(record: RawRecord): number | undefined {
  for (const key of ['updatedAt', 'updated_at', 'lastModified', 'last_modified', 'mtime', 'last_mes']) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value) || Date.parse(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
}

async function listCharacters(): Promise<ExportCharacter[]> {
  const raw = await requestJson<unknown>('/api/characters/all', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return asArray(raw, ['characters', 'data']).map((item, index) => {
    const avatar = text(item, ['avatar', 'avatar_url', 'file_name'])
    const name = text(item, ['name', 'char_name'], avatar.replace(/\.png$/i, '')) || `角色 ${index + 1}`
    return {
      id: avatar || name,
      name,
      avatar: avatar || `${name}.png`,
      updatedAt: timestamp(item),
      chats: [],
    }
  })
}

async function listChats(character: ExportCharacter): Promise<ExportChat[]> {
  const raw = await requestJson<unknown>('/api/characters/chats', {
    method: 'POST',
    body: JSON.stringify({ avatar_url: character.avatar, metadata: true }),
  })
  return asArray(raw, ['chats', 'data']).map((item, index) => {
    const path = text(item, ['path', 'file', 'file_name', 'name'])
    const name = text(item, ['name', 'chat_name'], path.replace(/^.*[\\/]/, '').replace(/\.jsonl$/i, '')) || `聊天 ${index + 1}`
    return { id: `${character.id}:${path || name}`, name, path, updatedAt: timestamp(item) }
  })
}

async function listWorldbooks(): Promise<ExportWorldbook[]> {
  const listing = await requestJson<unknown>('/api/worldinfo/list', { method: 'POST', body: JSON.stringify({}) })
  const items = asArray(listing, ['worlds', 'worldbooks', 'data'])
  return items.map((item, index) => {
    const id = text(item, ['file_id', 'file_name', 'filename', 'name'], `world-${index + 1}`)
    const name = text(item, ['name'], id).replace(/\.json$/i, '')
    return {
      id,
      name,
      fileName: id.endsWith('.json') ? id : `${id}.json`,
      updatedAt: timestamp(item),
    }
  })
}

async function readWorldbook(worldbook: ExportWorldbook): Promise<unknown> {
  return requestJson<unknown>('/api/worldinfo/get', {
    method: 'POST',
    body: JSON.stringify({ name: worldbook.id.replace(/\.json$/i, '') }),
  })
}

function loadPresets(raw: RawRecord): ExportPreset[] {
  const names = Array.isArray(raw.openai_setting_names) ? raw.openai_setting_names : []
  const contents = Array.isArray(raw.openai_settings) ? raw.openai_settings : []
  return names.map((value, index) => {
    const name = typeof value === 'string' && value ? value : `preset-${index + 1}`
    const fileName = name.endsWith('.json') ? name : `${name}.json`
    const rawContent = contents[index]
    let content: unknown = rawContent
    if (typeof rawContent === 'string') {
      try { content = JSON.parse(rawContent) } catch { content = {} }
    }
    return { id: fileName, name: name.replace(/\.json$/i, ''), fileName, content }
  })
}

function loadRegex(raw: RawRecord): ExportRegexSet | null {
  let settings: RawRecord = raw
  if (typeof raw.settings === 'string') {
    try { settings = asRecord(JSON.parse(raw.settings)) } catch { settings = {} }
  }
  const extensionSettings = asRecord(settings.extension_settings ?? settings.extensions)
  const rules = Array.isArray(extensionSettings.regex) ? extensionSettings.regex : []
  return rules.length ? { rules } : null
}

export function createSTCloudExportBridge(): CloudExportBridge {
  return {
    listCharacters,
    listChats,
    listWorldbooks,
    async loadSettingsAssets() {
      const settings = await requestJson<unknown>('/api/settings/get', { method: 'POST', body: JSON.stringify({}) }).then(asRecord)
      const presets = loadPresets(settings)
      const regex = loadRegex(settings)
      return { presets, regex }
    },
    readWorldbook,
    readCharacterCard: (character) => requestBinary('/api/characters/export', {
      method: 'POST',
      body: JSON.stringify({ format: 'png', avatar_url: character.avatar }),
    }),
    async readChat(character, chat) {
      const fileName = (chat.path || chat.name).replace(/\.jsonl$/i, '')
      const raw = await requestJson<unknown>('/api/chats/get', {
        method: 'POST',
        body: JSON.stringify({ ch_name: character.name, avatar_url: character.avatar, file_name: fileName }),
      })
      if (!Array.isArray(raw)) throw new Error(`聊天 ${chat.name} 返回了无法导出的数据`)
      return raw.map((line) => JSON.stringify(line)).join('\n') + (raw.length ? '\n' : '')
    },
  }
}
