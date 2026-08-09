export const API_APP_ID = 'api'
export const API_PROFILE_VERSION = 2

export type MainApi = 'openai' | 'textgenerationwebui' | 'novel' | 'kobold' | 'koboldhorde'
export type SecretMode = 'read' | 'stored' | 'legacy' | 'unavailable'

export interface ApiSourceDescriptor {
  id: string
  mainApi: MainApi
  label: string
  sourceField?: string
  urlField?: string
  modelField?: string
  secretKey?: string
  connectSelector: string
  urlSelector?: string
  modelSelector?: string
  keySelector?: string
  supportsModels?: boolean
}

const chat = (id: string, label: string, options: Partial<ApiSourceDescriptor> = {}): ApiSourceDescriptor => ({
  id,
  label,
  mainApi: 'openai',
  sourceField: 'chat_completion_source',
  connectSelector: '#api_button_openai',
  ...options,
})

export const API_SOURCES: readonly ApiSourceDescriptor[] = [
  chat('openai', 'OpenAI', { modelField: 'openai_model', secretKey: 'api_key_openai', modelSelector: '#model_openai_select', keySelector: '#api_key_openai' }),
  chat('claude', 'Claude', { modelField: 'claude_model', secretKey: 'api_key_claude', modelSelector: '#model_claude_select', keySelector: '#api_key_claude' }),
  chat('openrouter', 'OpenRouter', { modelField: 'openrouter_model', secretKey: 'api_key_openrouter', modelSelector: '#model_openrouter_select', keySelector: '#api_key_openrouter' }),
  chat('makersuite', 'Google AI Studio', { modelField: 'google_model', secretKey: 'api_key_makersuite', modelSelector: '#model_google_select', keySelector: '#api_key_makersuite' }),
  chat('mistralai', 'Mistral AI', { modelField: 'mistralai_model', secretKey: 'api_key_mistralai', modelSelector: '#mistralai_model', keySelector: '#api_key_mistralai' }),
  chat('cohere', 'Cohere', { modelField: 'cohere_model', secretKey: 'api_key_cohere', modelSelector: '#cohere_model', keySelector: '#api_key_cohere' }),
  chat('groq', 'Groq', { modelField: 'groq_model', secretKey: 'api_key_groq', modelSelector: '#groq_model', keySelector: '#api_key_groq' }),
  chat('deepseek', 'DeepSeek', { modelField: 'deepseek_model', secretKey: 'api_key_deepseek', modelSelector: '#deepseek_model', keySelector: '#api_key_deepseek' }),
  chat('xai', 'xAI', { modelField: 'xai_model', secretKey: 'api_key_xai', modelSelector: '#xai_model', keySelector: '#api_key_xai' }),
  chat('custom', '自定义（OpenAI 兼容）', { urlField: 'custom_url', modelField: 'custom_model', secretKey: 'api_key_custom', urlSelector: '#custom_api_url_text', modelSelector: '#custom_model_id', keySelector: '#api_key_custom', supportsModels: true }),
  { id: 'textgenerationwebui', mainApi: 'textgenerationwebui', label: 'Text Completion', urlField: 'api_server_textgenerationwebui', connectSelector: '#api_button_textgenerationwebui', urlSelector: '#api_url_text' },
  { id: 'novel', mainApi: 'novel', label: 'NovelAI', secretKey: 'api_key_novel', connectSelector: '#api_button_novel', keySelector: '#api_key_novel' },
  { id: 'kobold', mainApi: 'kobold', label: 'KoboldAI', urlField: 'api_server', connectSelector: '#api_button', urlSelector: '#api_url_text' },
  { id: 'koboldhorde', mainApi: 'koboldhorde', label: 'KoboldAI Horde', secretKey: 'api_key_horde', connectSelector: '#api_button', keySelector: '#horde_api_key' },
]

const COMMON_CHAT_SOURCE_IDS = new Set(['openai', 'claude', 'openrouter', 'makersuite', 'custom'])

/** 新建档案只展示高频入口；完整 API_SOURCES 继续服务历史档案与桥接兼容。 */
export const COMMON_CHAT_SOURCES: readonly ApiSourceDescriptor[] = API_SOURCES.filter(
  (item) => item.mainApi === 'openai' && COMMON_CHAT_SOURCE_IDS.has(item.id),
)

export function getSource(mainApi: string, source = ''): ApiSourceDescriptor {
  return API_SOURCES.find((item) => item.mainApi === mainApi && (item.mainApi !== 'openai' || item.id === source))
    ?? API_SOURCES.find((item) => item.mainApi === mainApi)
    ?? API_SOURCES.find((item) => item.id === 'custom')!
}

export interface ApiProfile {
  version: 2
  id: string
  name: string
  mainApi: MainApi
  source: string
  url: string
  key: string
  secretId: string
  secretMode: SecretMode
  model: string
  settings: Record<string, string | number | boolean>
}

export interface ApiAppData { profiles: ApiProfile[] }
export type ProfileDraft = Omit<ApiProfile, 'id' | 'version'>

export function emptyDraft(): ProfileDraft {
  return { name: '', mainApi: 'openai', source: 'custom', url: '', key: '', secretId: '', secretMode: 'stored', model: '', settings: {} }
}

export function normalizeUrl(value: string): string { return String(value ?? '').trim().replace(/\/+$/, '') }
function str(value: unknown): string { return typeof value === 'string' ? value : '' }
export function newProfileId(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }

export function sanitizeAppData(raw: unknown): ApiAppData {
  const profiles: ApiProfile[] = []
  const list = (raw as { profiles?: unknown } | undefined)?.profiles
  if (!Array.isArray(list)) return { profiles }
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const p = item as Record<string, unknown>
    const name = str(p.name).trim()
    if (!name) continue
    const legacy = p.version !== API_PROFILE_VERSION
    const mainApi = (legacy ? 'openai' : str(p.mainApi)) as MainApi
    const source = legacy ? 'custom' : str(p.source)
    const url = normalizeUrl(str(p.url))
    const descriptor = getSource(mainApi, source)
    if (descriptor.urlField && !url) continue
    const settings = !legacy && p.settings && typeof p.settings === 'object' ? p.settings as Record<string, string | number | boolean> : {}
    if (legacy) {
      settings.custom_include_body = str(p.includeBody)
      settings.custom_exclude_body = str(p.excludeBody)
      settings.custom_include_headers = str(p.includeHeaders)
    }
    profiles.push({
      version: 2, id: str(p.id) || newProfileId(), name, mainApi, source: descriptor.id, url,
      key: str(p.key), secretId: str(p.secretId), secretMode: (str(p.secretMode) as SecretMode) || (str(p.key) ? 'legacy' : 'unavailable'),
      model: str(p.model).trim(), settings,
    })
  }
  return { profiles }
}

export function validateDraft(draft: Pick<ProfileDraft, 'name' | 'mainApi' | 'source' | 'url'>): string | null {
  if (!draft.name.trim()) return '给连接档案起个名称吧。'
  const descriptor = getSource(draft.mainApi, draft.source)
  if (descriptor.urlField) {
    const url = normalizeUrl(draft.url)
    if (!url) return '这个来源需要填写接口地址 URL。'
    if (!/^https?:\/\//i.test(url)) return '接口地址要以 http:// 或 https:// 开头。'
  }
  return null
}

export function upsertProfile(profiles: ApiProfile[], draft: ProfileDraft, editingId: string | null): { profiles: ApiProfile[] } | { error: string } {
  const invalid = validateDraft(draft)
  if (invalid) return { error: invalid }
  const name = draft.name.trim()
  if (profiles.some((p) => p.name === name && p.id !== editingId)) return { error: `连接档案「${name}」已存在。` }
  const clean: Omit<ApiProfile, 'id'> = { ...draft, version: 2, name, url: normalizeUrl(draft.url), model: draft.model.trim(), settings: { ...draft.settings } }
  if (editingId) {
    const index = profiles.findIndex((p) => p.id === editingId)
    if (index < 0) return { error: '要编辑的连接档案已不存在。' }
    const next = [...profiles]; next[index] = { ...clean, id: editingId }; return { profiles: next }
  }
  return { profiles: [...profiles, { ...clean, id: newProfileId() }] }
}

export function findUrlDuplicate(profiles: ApiProfile[], url: string, excludeId: string | null): ApiProfile | undefined {
  const target = normalizeUrl(url); if (!target) return undefined
  return profiles.find((p) => p.id !== excludeId && normalizeUrl(p.url) === target)
}

export function moveProfile(profiles: ApiProfile[], id: string, delta: -1 | 1): ApiProfile[] {
  const from = profiles.findIndex((p) => p.id === id); const to = from + delta
  if (from < 0 || to < 0 || to >= profiles.length) return profiles
  const next = [...profiles]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next
}

export interface ConnectionIdentity { mainApi: string; source: string; url: string; model: string }
export function findActiveProfile(profiles: ApiProfile[], current: ConnectionIdentity | string, currentModel = ''): ApiProfile | undefined {
  const identity: ConnectionIdentity = typeof current === 'string' ? { mainApi: 'openai', source: 'custom', url: current, model: currentModel } : current
  const candidates = profiles.filter((p) => p.mainApi === identity.mainApi && (p.mainApi !== 'openai' || p.source === identity.source) && (!p.url || normalizeUrl(p.url) === normalizeUrl(identity.url)))
  return candidates.find((p) => p.model && p.model === identity.model) ?? candidates[0]
}

export function profileSummary(profile: ApiProfile): string[] {
  const source = getSource(profile.mainApi, profile.source)
  return [source.label, profile.url || '', profile.model || '', profile.key || profile.secretId ? '已配 Key' : '缺 Key'].filter(Boolean)
}

export function parseModelList(json: unknown): string[] {
  if (json && typeof json === 'object' && 'error' in json && (json as { error: unknown }).error) {
    const message = (json as { message?: unknown }).message
    throw new Error(typeof message === 'string' && message ? message : '站点接口返回了错误')
  }
  const box = json as { data?: unknown; models?: unknown } | unknown[]
  const arr = Array.isArray(box) ? box : Array.isArray(box?.data) ? box.data : Array.isArray(box?.models) ? box.models : []
  const names = arr.map((m) => typeof m === 'string' ? m : m && typeof m === 'object' ? str((m as Record<string, unknown>).id) || str((m as Record<string, unknown>).model) || str((m as Record<string, unknown>).name) : '').filter(Boolean)
  if (!names.length) throw new Error('站点没有返回任何模型')
  return [...new Set(names)].sort()
}
