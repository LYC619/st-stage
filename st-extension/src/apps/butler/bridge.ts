/** Butler's narrow, privacy-preserving SillyTavern integration boundary. */

import {
  inspectExtensionModule,
  inspectPowerUserModule,
  parseFoundExtension,
  summarizeExtensionManifest,
  type ExtensionContractResult,
  type ExtensionManifestSummary,
} from './st-contract'

/** 管家所需的 ST context 最小切面（字段可能随版本缺失，全部可选） */
interface ButlerSTContext {
  powerUserSettings?: Record<string, unknown>
  saveSettingsDebounced?: () => void
  reloadCurrentChat?: () => unknown
  isMobile?: () => boolean
  extensionSettings?: Record<string, unknown>
  chat?: unknown[]
  chatId?: unknown
  characterId?: unknown
  groupId?: unknown
}

function getST(): ButlerSTContext | undefined {
  try {
    return window.SillyTavern?.getContext() as unknown as ButlerSTContext | undefined
  } catch {
    return undefined
  }
}

/** 管家会读写的全部 power_user 性能字段（同时是快照的形状） */
export interface PerfSnapshot {
  fast_ui_mode: boolean
  reduced_motion: boolean
  noShadows: boolean
  smooth_streaming: boolean
  stream_fade_in: boolean
  streaming_fps: number
  chat_truncation: number
}

export interface FieldCapability {
  available: boolean
  reason?: string
}

export type PerfCapabilities = { [K in keyof PerfSnapshot]: FieldCapability }

export interface PerfReadState {
  status: 'unavailable' | 'partial' | 'ready'
  snapshot: Partial<PerfSnapshot>
  capabilities: PerfCapabilities
  reason?: string
}

export type CapabilityValue<T> =
  | { available: true; value: T }
  | { available: false; reason: string }

const PERF_FIELDS = {
  fast_ui_mode: 'boolean',
  reduced_motion: 'boolean',
  noShadows: 'boolean',
  smooth_streaming: 'boolean',
  stream_fade_in: 'boolean',
  streaming_fps: 'number',
  chat_truncation: 'number',
} as const satisfies Record<keyof PerfSnapshot, 'boolean' | 'number'>

function unavailableCapabilities(reason: string): PerfCapabilities {
  return Object.fromEntries(
    Object.keys(PERF_FIELDS).map((key) => [key, { available: false, reason }]),
  ) as unknown as PerfCapabilities
}

/** Read every field without substituting values that ST did not expose. */
export function readPerfState(): PerfReadState {
  const pu = getST()?.powerUserSettings
  if (!pu) {
    const reason = '未检测到 SillyTavern power_user 设置'
    return { status: 'unavailable', snapshot: {}, capabilities: unavailableCapabilities(reason), reason }
  }
  const snapshot: Partial<PerfSnapshot> = {}
  const capabilities = {} as PerfCapabilities
  for (const [rawKey, expected] of Object.entries(PERF_FIELDS)) {
    const key = rawKey as keyof PerfSnapshot
    const value = pu[key]
    const valid = expected === 'boolean'
      ? typeof value === 'boolean'
      : typeof value === 'number' && Number.isFinite(value)
    if (valid) {
      Object.assign(snapshot, { [key]: value })
      capabilities[key] = { available: true }
    } else {
      capabilities[key] = { available: false, reason: '字段缺失或类型无效' }
    }
  }
  const complete = Object.values(capabilities).every((capability) => capability.available)
  return { status: complete ? 'ready' : 'partial', snapshot, capabilities }
}

/** Compatibility for the pre-Task-8 UI: incomplete state is not editable there. */
export function readPerf(): PerfSnapshot | null {
  const result = readPerfState()
  return result.status === 'ready' ? result.snapshot as PerfSnapshot : null
}

export function readMobileState(): CapabilityValue<boolean> {
  const st = getST()
  if (typeof st?.isMobile !== 'function') {
    return { available: false, reason: '未检测到 SillyTavern 移动端判断接口' }
  }
  try {
    const value: unknown = st.isMobile()
    return typeof value === 'boolean'
      ? { available: true, value }
      : { available: false, reason: 'SillyTavern 移动端判断返回格式无效' }
  } catch {
    return { available: false, reason: 'SillyTavern 移动端判断失败' }
  }
}

/** Compatibility wrapper for the pre-Task-8 UI. */
export function isMobile(): boolean {
  const result = readMobileState()
  return result.available ? result.value : false
}

/** 视觉类字段生效：applyPowerUserSettings 只能从 power-user.js 模块拿（同 URL 同实例） */
async function applyVisuals(): Promise<void> {
  try {
    // 用变量作说明符：esbuild 不解析、保留为浏览器原生动态 import
    const modUrl = '/scripts/power-user.js'
    const contract = inspectPowerUserModule(await import(modUrl))
    if (!contract.available) throw new Error(contract.reason)
    contract.applyPowerUserSettings()
  } catch (err) {
    console.warn('[st-stage] 管家：applyPowerUserSettings 不可用，视觉项将在刷新页面后生效', err)
  }
}

/** reduced_motion 不在 applyPowerUserSettings 覆盖范围内，复刻其核心动作 */
function applyReducedMotion(on: boolean): void {
  const jq = (window as unknown as { jQuery?: { fx?: { off?: boolean } } }).jQuery
  if (jq?.fx) jq.fx.off = on
}

async function reloadChatSafe(st: ButlerSTContext): Promise<void> {
  try {
    await Promise.resolve(st.reloadCurrentChat?.())
  } catch (err) {
    console.warn('[st-stage] 管家：重载当前对话失败，消息加载数将在切换对话后生效', err)
  }
}

/**
 * 写一组性能字段并按字段类别走各自的生效路径：
 * reduced_motion → jQuery.fx；fast_ui_mode/noShadows → applyPowerUserSettings；
 * 全部 → saveSettingsDebounced；chat_truncation 有实际变化 → reloadCurrentChat。
 * 无 ST 运行时静默跳过（调用方界面上本就不该出现写入口）。
 */
export async function writePerf(fields: Partial<PerfSnapshot>): Promise<void> {
  const st = getST()
  const pu = st?.powerUserSettings
  if (!st || !pu) return
  const prevTrunc = typeof pu.chat_truncation === 'number' && Number.isFinite(pu.chat_truncation)
    ? pu.chat_truncation
    : undefined
  Object.assign(pu, fields)
  if (fields.reduced_motion !== undefined) applyReducedMotion(fields.reduced_motion)
  if (fields.fast_ui_mode !== undefined || fields.noShadows !== undefined) await applyVisuals()
  st.saveSettingsDebounced?.()
  if (fields.chat_truncation !== undefined && fields.chat_truncation !== prevTrunc) {
    await reloadChatSafe(st)
  }
}

/** 体检读数（无 ST 时 quickReplySets 为 null、禁用数为 0） */
export interface PerfHealth {
  disabledExtensions: number
  /** Quick Reply 集合数；QR 扩展数据缺失时为 null（不展示该行） */
  quickReplySets: number | null
}

export interface PerfHealthState {
  disabledExtensions: CapabilityValue<number>
  quickReplySets: CapabilityValue<number>
}

export function readHealthState(): PerfHealthState {
  const ext = getST()?.extensionSettings
  if (!ext) {
    const reason = '未检测到 SillyTavern 扩展设置'
    return {
      disabledExtensions: { available: false, reason },
      quickReplySets: { available: false, reason },
    }
  }
  const disabled = ext['disabledExtensions']
  const qr = ext['quickReply'] as { config?: { setList?: unknown[] } } | undefined
  return {
    disabledExtensions: Array.isArray(disabled)
      ? { available: true, value: disabled.length }
      : { available: false, reason: '禁用扩展清单缺失或格式无效' },
    quickReplySets: Array.isArray(qr?.config?.setList)
      ? { available: true, value: qr.config.setList.length }
      : { available: false, reason: 'Quick Reply 设置缺失或格式无效' },
  }
}

/** Compatibility wrapper for the pre-Task-8 UI. */
export function readHealth(): PerfHealth {
  const result = readHealthState()
  return {
    disabledExtensions: result.disabledExtensions.available ? result.disabledExtensions.value : 0,
    quickReplySets: result.quickReplySets.available ? result.quickReplySets.value : null,
  }
}

export interface ChatSummary {
  chatKey: string
  messageCount: number
  userMessageCount: number
  assistantMessageCount: number
}

export interface DomSummary {
  renderedMessageCount: number
  chatNodeCount: number
}

export interface PageSummary {
  chat: CapabilityValue<ChatSummary>
  dom: CapabilityValue<DomSummary>
}

function scalarId(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : 'unknown'
}

/** Stable non-cryptographic digest used only to compare whether the conversation changed. */
function comparisonDigest(value: string): string {
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index))
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return hash.toString(16).padStart(16, '0')
}

function chatKey(st: ButlerSTContext): string {
  const conversation = scalarId(st.chatId)
  const identity = typeof st.groupId === 'string' || typeof st.groupId === 'number'
    ? `group:${st.groupId}:${conversation}`
    : `character:${scalarId(st.characterId)}:${conversation}`
  return `chat:${comparisonDigest(identity)}`
}

export function readPageSummary(): PageSummary {
  const st = getST()
  const chat = st?.chat
  const chatSummary: CapabilityValue<ChatSummary> = Array.isArray(chat)
    ? {
        available: true,
        value: {
          chatKey: chatKey(st ?? {}),
          messageCount: chat.length,
          userMessageCount: chat.filter((message) => (
            typeof message === 'object' && message !== null && (message as { is_user?: unknown }).is_user === true
          )).length,
          assistantMessageCount: chat.filter((message) => (
            typeof message === 'object'
            && message !== null
            && (message as { is_user?: unknown }).is_user === false
            && (message as { is_system?: unknown }).is_system !== true
          )).length,
        },
      }
    : { available: false, reason: '聊天摘要不可用' }

  const root = typeof document === 'undefined' ? null : document.querySelector('#chat')
  const dom: CapabilityValue<DomSummary> = root
    ? {
        available: true,
        value: {
          renderedMessageCount: root.querySelectorAll('.mes').length,
          chatNodeCount: root.querySelectorAll('*').length + 1,
        },
      }
    : { available: false, reason: '未找到 #chat DOM' }
  return { chat: chatSummary, dom }
}

export interface ResourceTimingInput {
  name: string
  initiatorType?: string
  transferSize?: number
  duration?: number
}

export interface ResourceTimingGroup {
  key: string
  count: number
  transferSize: number
  durationMs: number
}

function resourceGroupKey(url: URL, initiatorType: string | undefined): string | null {
  const marker = '/scripts/extensions/'
  const markerIndex = url.pathname.indexOf(marker)
  if (markerIndex >= 0) {
    const segments = url.pathname.slice(markerIndex + marker.length).split('/').filter(Boolean)
    if (segments.length < 2) return null
    const extensionName = segments[0] === 'third-party' && segments.length >= 3
      ? `third-party/${segments[1]}`
      : segments[0]
    return `extension:${extensionName}`
  }
  const kinds: Record<string, string> = {
    img: 'image',
    image: 'image',
    script: 'script',
    link: 'stylesheet',
    css: 'stylesheet',
    font: 'font',
    audio: 'media',
    video: 'media',
    iframe: 'document',
    fetch: 'fetch',
    xmlhttprequest: 'fetch',
  }
  const kind = typeof initiatorType === 'string'
    ? kinds[initiatorType.toLowerCase()] ?? 'other'
    : 'other'
  return `resource:${kind}`
}

function evidenceNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

/** Aggregate resource evidence without returning complete URLs, queries, or fragments. */
export function groupResourceTimings(entries: ResourceTimingInput[]): ResourceTimingGroup[] {
  const groups = new Map<string, ResourceTimingGroup>()
  for (const entry of entries) {
    let url: URL
    try {
      url = new URL(entry.name)
    } catch {
      continue
    }
    const key = resourceGroupKey(url, entry.initiatorType)
    if (!key) continue
    const current = groups.get(key) ?? { key, count: 0, transferSize: 0, durationMs: 0 }
    current.count += 1
    current.transferSize += evidenceNumber(entry.transferSize)
    current.durationMs += evidenceNumber(entry.duration)
    groups.set(key, current)
  }
  return [...groups.values()]
}

export interface ExtensionInventoryItem {
  name: string
  type: string
  configuredEnabled: boolean
  isSelf: boolean
  manifest: ExtensionManifestSummary | null
}

export type ExtensionInventoryResult =
  | {
      status: 'ready'
      governance: ExtensionContractResult['governance']
      disabledExtensions: string[]
      extensions: ExtensionInventoryItem[]
    }
  | {
      status: 'unavailable'
      reason: string
      governance: { writable: false; reason: string }
      disabledExtensions: []
      extensions: []
    }

export type FindExtensionResult =
  | { ok: true; extension: { name: string; configuredEnabled: boolean } }
  | { ok: false; code: 'api-unavailable' | 'not-found' | 'invalid-response' | 'api-error'; error: string }

export type ExtensionWriteResult =
  | { ok: true; name: string; configuredEnabled: boolean; reloadRequired: true }
  | { ok: false; code: 'api-unavailable' | 'read-only' | 'not-found' | 'protected' | 'api-error'; error: string }

type ModuleLoader = (specifier: string) => Promise<unknown>

export interface ButlerBridgeDependencies {
  loadModule?: ModuleLoader
}

async function defaultModuleLoader(specifier: string): Promise<unknown> {
  return import(specifier)
}

function isSelfExtension(name: string): boolean {
  return name === 'st-stage' || name === 'third-party/st-stage'
}

export function createButlerBridge(deps: ButlerBridgeDependencies = {}) {
  const loadModule = deps.loadModule ?? defaultModuleLoader
  let extensionContractPromise: Promise<ExtensionContractResult> | undefined

  const loadExtensionContract = (): Promise<ExtensionContractResult> => {
    extensionContractPromise ??= loadModule('/scripts/extensions.js')
      .then(inspectExtensionModule)
      .catch(() => {
        const reason = '无法加载 SillyTavern 扩展接口'
        return { status: 'unavailable', reason, governance: { writable: false, reason } }
      })
    return extensionContractPromise
  }

  const findExtension = async (name: string): Promise<FindExtensionResult> => {
    const contract = await loadExtensionContract()
    if (contract.status !== 'ready') {
      return { ok: false, code: 'api-unavailable', error: contract.reason }
    }
    try {
      const rawFound = contract.api.findExtension(name)
      if (rawFound === null) return { ok: false, code: 'not-found', error: '未找到扩展' }
      const found = parseFoundExtension(rawFound)
      if (!found) {
        return { ok: false, code: 'invalid-response', error: 'SillyTavern findExtension 返回格式无效' }
      }
      return { ok: true, extension: found }
    } catch {
      return { ok: false, code: 'api-error', error: 'SillyTavern 扩展接口调用失败' }
    }
  }

  return {
    readPageSummary,
    readMobileState,
    readHealthState,
    async readExtensions(): Promise<ExtensionInventoryResult> {
      const contract = await loadExtensionContract()
      if (contract.status !== 'ready') {
        return {
          status: 'unavailable',
          reason: contract.reason,
          governance: contract.governance,
          disabledExtensions: [],
          extensions: [],
        }
      }
      const disabled = contract.api.extensionSettings.disabledExtensions
      const extensions = contract.api.extensionNames.map((name): ExtensionInventoryItem => {
        let rawManifest: unknown
        try {
          rawManifest = contract.api.getExtensionManifest(name)
        } catch {
          rawManifest = null
        }
        return {
          name,
          type: contract.api.extensionTypes[name] ?? 'unknown',
          configuredEnabled: !disabled.includes(name),
          isSelf: isSelfExtension(name),
          manifest: summarizeExtensionManifest(rawManifest),
        }
      })
      return {
        status: 'ready',
        governance: contract.governance,
        disabledExtensions: [...disabled],
        extensions,
      }
    },
    findExtension,
    async setExtensionEnabled(name: string, enabled: boolean): Promise<ExtensionWriteResult> {
      const contract = await loadExtensionContract()
      if (contract.status !== 'ready') {
        return { ok: false, code: 'api-unavailable', error: contract.reason }
      }
      if (!contract.governance.writable || !contract.api.enableExtension || !contract.api.disableExtension) {
        return {
          ok: false,
          code: 'read-only',
          error: contract.governance.reason ?? 'SillyTavern 扩展治理当前只读',
        }
      }
      const found = await findExtension(name)
      if (!found.ok) {
        return found.code === 'not-found'
          ? { ok: false, code: 'not-found', error: found.error }
          : { ok: false, code: 'api-error', error: 'SillyTavern 扩展接口调用失败' }
      }
      if (!enabled && isSelfExtension(found.extension.name)) {
        return { ok: false, code: 'protected', error: '管家不能禁用 st-stage 自身' }
      }
      try {
        const toggle = enabled ? contract.api.enableExtension : contract.api.disableExtension
        await Promise.resolve(toggle(found.extension.name, false))
        return {
          ok: true,
          name: found.extension.name,
          configuredEnabled: enabled,
          reloadRequired: true,
        }
      } catch {
        return { ok: false, code: 'api-error', error: 'SillyTavern 扩展接口调用失败' }
      }
    },
  }
}
