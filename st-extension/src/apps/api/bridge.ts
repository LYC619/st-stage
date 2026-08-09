import type { ApiProfile, ConnectionIdentity, SecretMode } from './core'
import { getSource, parseModelList } from './core'

interface BridgeContext {
  chatCompletionSettings?: Record<string, unknown>
  textCompletionSettings?: Record<string, unknown>
  powerUserSettings?: Record<string, unknown>
  getRequestHeaders?: () => Record<string, string>
  saveSettingsDebounced?: () => void
  onlineStatus?: string
  mainApi?: string
  eventSource?: { on(event: string, handler: () => void): void; removeListener(event: string, handler: () => void): void }
  event_types?: Record<string, string>
}

function getST(): BridgeContext | undefined {
  try { return window.SillyTavern?.getContext() as unknown as BridgeContext | undefined } catch { return undefined }
}

export function toast(kind: 'success' | 'error', message: string): void {
  const t = (window as { toastr?: Record<string, (msg: string, title?: string) => void> }).toastr
  t?.[kind]?.(message, 'API 切换')
}

function readString(object: Record<string, unknown> | undefined, key?: string): string {
  const value = key ? object?.[key] : undefined
  return typeof value === 'string' ? value : ''
}

function settingsFor(st: BridgeContext, mainApi: string): Record<string, unknown> {
  return mainApi === 'openai' ? st.chatCompletionSettings ?? {} : st.textCompletionSettings ?? st.powerUserSettings ?? {}
}

const SOURCE_SETTING_KEYS = ['custom_include_body', 'custom_exclude_body', 'custom_include_headers'] as const

export interface ConnectionInfo extends ConnectionIdentity {
  online: boolean
  settings: Record<string, string | number | boolean>
  key: string
  secretId: string
  secretMode: SecretMode
}

async function secretRequest(path: 'find' | 'write', body: Record<string, string>, st: BridgeContext): Promise<Response> {
  return fetch(`/api/secrets/${path}`, { method: 'POST', headers: st.getRequestHeaders?.() ?? { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

async function readSecret(st: BridgeContext, secretKey?: string, secretId = ''): Promise<{ key: string; mode: SecretMode }> {
  if (!secretKey) return { key: '', mode: 'unavailable' }
  try {
    const response = await secretRequest('find', { key: secretKey, id: secretId }, st)
    if (!response.ok) return { key: '', mode: 'unavailable' }
    const json = await response.json() as { value?: unknown }
    return { key: typeof json.value === 'string' ? json.value : '', mode: 'read' }
  } catch { return { key: '', mode: 'unavailable' } }
}

export async function readConnection(): Promise<ConnectionInfo | null> {
  const st = getST(); if (!st) return null
  const mainApi = st.mainApi ?? (document.querySelector<HTMLSelectElement>('#main_api')?.value || 'openai')
  const settings = settingsFor(st, mainApi)
  const source = mainApi === 'openai' ? readString(settings, 'chat_completion_source') || document.querySelector<HTMLSelectElement>('#chat_completion_source')?.value || 'openai' : mainApi
  const descriptor = getSource(mainApi, source)
  const secretId = readString(settings, `${descriptor.secretKey}_id`) || readString(settings, 'secret_id')
  const secret = await readSecret(st, descriptor.secretKey, secretId)
  const snapshot: Record<string, string | number | boolean> = {}
  for (const key of SOURCE_SETTING_KEYS) {
    const value = settings[key]
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') snapshot[key] = value
  }
  return {
    mainApi, source: descriptor.id, url: readString(settings, descriptor.urlField) || (descriptor.urlSelector ? document.querySelector<HTMLInputElement>(descriptor.urlSelector)?.value ?? '' : ''),
    model: readString(settings, descriptor.modelField) || (descriptor.modelSelector ? document.querySelector<HTMLInputElement | HTMLSelectElement>(descriptor.modelSelector)?.value ?? '' : ''),
    online: (st.onlineStatus ?? 'no_connection') !== 'no_connection', settings: snapshot, key: secret.key, secretId, secretMode: secret.mode,
  }
}

export function onOnlineStatusChanged(handler: () => void): () => void {
  const st = getST(); const source = st?.eventSource
  if (!source) return () => {}
  const eventName = st.event_types?.ONLINE_STATUS_CHANGED ?? 'online_status_changed'
  source.on(eventName, handler); return () => source.removeListener(eventName, handler)
}

function dispatchValue(element: HTMLInputElement | HTMLSelectElement, value: string): void {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function waitFor<T extends Element>(selector: string, timeout = 2500): Promise<T | null> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const element = document.querySelector<T>(selector)
    if (element) return element
    await sleep(50)
  }
  return null
}

async function waitForValue(element: HTMLInputElement | HTMLSelectElement, value: string, timeout = 5000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (element instanceof HTMLSelectElement) {
      if ([...element.options].some((option) => option.value === value)) return true
    } else if (element.value === value) return true
    await sleep(80)
  }
  return false
}

async function waitForConnection(profile: ApiProfile, timeout = 8000): Promise<ConnectionInfo> {
  const start = Date.now(); let latest: ConnectionInfo | null = null
  while (Date.now() - start < timeout) {
    latest = await readConnection()
    const sourceMatches = latest?.mainApi === profile.mainApi && (profile.mainApi !== 'openai' || latest.source === profile.source)
    const modelMatches = !profile.model || latest?.model === profile.model
    if (latest?.online && sourceMatches && modelMatches) return latest
    await sleep(120)
  }
  if (profile.model && (!latest?.model || latest.model.toLowerCase() === 'none')) throw new Error(`模型「${profile.model}」尚未加载，未将 NONE 视为切换成功`)
  throw new Error(`连接回验超时${latest?.model ? `（当前模型：${latest.model}）` : ''}`)
}

async function writeSecret(st: BridgeContext, profile: ApiProfile): Promise<void> {
  const descriptor = getSource(profile.mainApi, profile.source)
  if (!descriptor.secretKey || !profile.key) return
  let response = await secretRequest('write', { key: descriptor.secretKey, value: profile.key, id: profile.secretId }, st)
  if (!response.ok && profile.secretId) response = await secretRequest('write', { key: descriptor.secretKey, value: profile.key }, st)
  if (!response.ok) throw new Error(`密钥写入 ST 失败（HTTP ${response.status}）`)
  if (descriptor.keySelector) {
    const input = await waitFor<HTMLInputElement>(descriptor.keySelector, 800)
    if (input) dispatchValue(input, profile.key)
  }
}

export type ApplyProfileProgress = (message: string) => void

export async function applyProfile(profile: ApiProfile, onProgress: ApplyProfileProgress = () => {}): Promise<ConnectionInfo> {
  const st = getST(); if (!st) throw new Error('未检测到 SillyTavern 运行时')
  const descriptor = getSource(profile.mainApi, profile.source)
  onProgress('正在切换补全方式与渠道…')
  const mainApiSelect = await waitFor<HTMLSelectElement>('#main_api')
  if (!mainApiSelect) throw new Error('找不到 SillyTavern API 类型选择器')
  dispatchValue(mainApiSelect, profile.mainApi)
  if (profile.mainApi === 'openai') {
    const sourceSelect = await waitFor<HTMLSelectElement>('#chat_completion_source')
    if (!sourceSelect) throw new Error('找不到聊天补全来源选择器')
    dispatchValue(sourceSelect, profile.source)
  }
  await sleep(120)
  await writeSecret(st, profile)
  const settings = settingsFor(st, profile.mainApi)
  if (descriptor.sourceField) settings[descriptor.sourceField] = profile.source
  if (descriptor.urlField) settings[descriptor.urlField] = profile.url
  for (const [key, value] of Object.entries(profile.settings)) settings[key] = value
  if (descriptor.urlSelector) {
    const input = await waitFor<HTMLInputElement>(descriptor.urlSelector)
    if (!input) throw new Error(`找不到 ${descriptor.label} 的 URL 输入框`)
    dispatchValue(input, profile.url)
  }
  st.saveSettingsDebounced?.()
  if (descriptor.urlField && readString(settings, descriptor.urlField) !== profile.url) throw new Error('URL 写入后回验失败，已停止连接')
  const button = await waitFor<HTMLElement>(descriptor.connectSelector)
  if (!button) throw new Error(`找不到 ${descriptor.label} 的连接按钮`)

  let modelControl: HTMLInputElement | HTMLSelectElement | null = null
  if (descriptor.modelSelector && profile.model) {
    modelControl = await waitFor<HTMLInputElement | HTMLSelectElement>(descriptor.modelSelector, 2500)
    if (!modelControl) throw new Error(`找不到 ${descriptor.label} 的模型字段`)
    if (modelControl instanceof HTMLSelectElement && ![...modelControl.options].some((option) => option.value === profile.model)) {
      onProgress('正在连接渠道并加载可用模型…')
      button.click()
      if (!await waitForValue(modelControl, profile.model)) throw new Error(`可用模型中没有「${profile.model}」，请检查模型 ID 或渠道权限`)
    }
    dispatchValue(modelControl, profile.model)
    if (descriptor.modelField) settings[descriptor.modelField] = profile.model
  }

  onProgress(profile.model ? `正在确认模型「${profile.model}」…` : '正在确认连接…')
  button.click()
  const connected = await waitForConnection(profile)
  if (modelControl && profile.model && modelControl.value !== profile.model) throw new Error(`模型写入被 SillyTavern 覆盖（当前：${modelControl.value || 'NONE'}）`)
  return connected
}

let modelQueue: Promise<void> = Promise.resolve()
export function fetchModels(profile: Pick<ApiProfile, 'mainApi' | 'source' | 'url' | 'key' | 'secretId'>): Promise<string[]> {
  const result = modelQueue.then(() => fetchModelsTransaction(profile))
  modelQueue = result.then(() => undefined, () => undefined)
  return result
}

async function fetchModelsTransaction(profile: Pick<ApiProfile, 'mainApi' | 'source' | 'url' | 'key' | 'secretId'>): Promise<string[]> {
  const st = getST(); if (!st) throw new Error('未检测到 SillyTavern 运行时')
  const descriptor = getSource(profile.mainApi, profile.source)
  if (!descriptor.supportsModels) throw new Error('该来源不支持自动获取模型，请手动填写')
  const current = await readConnection()
  const temporary: ApiProfile = { version: 2, id: 'temporary', name: 'temporary', model: '', settings: {}, secretMode: 'stored', ...profile }
  await writeSecret(st, temporary)
  try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch('/api/backends/chat-completions/status', { method: 'POST', headers: st.getRequestHeaders?.() ?? { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_completion_source: profile.source, custom_url: profile.url }), signal: controller.signal })
      if (!response.ok) throw new Error(`模型列表请求失败（HTTP ${response.status}）`)
      return parseModelList(await response.json())
    } finally { clearTimeout(timer) }
  } finally {
    if (current?.key) await writeSecret(st, { ...temporary, mainApi: current.mainApi as ApiProfile['mainApi'], source: current.source, url: current.url, key: current.key, secretId: current.secretId })
  }
}
