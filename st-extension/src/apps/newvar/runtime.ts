/**
 * 「新变量」运行时（编排层，独立于 App UI，随扩展启动常驻）：
 *   AI 回复（MESSAGE_RECEIVED）→ parseUpdateBlock 提取 <UpdateVariable>
 *   → applyOps（schema 门禁：拒未定义路径/非法值、数值越界 clip）
 *   → 状态快照写入该楼 message.extra[NEWVAR_EXTRA_KEY]（逐楼一份，随 chat 文件持久化）
 *   → 重建注入文本，经命名注入通道（adapter.injectChannel('newvar', ...)）注入下一轮 prompt。
 *
 * 存储选型：message.extra 而非楼层变量/chatMetadata——纯 ST 原生字段（插图等功能同款），
 * 不依赖 TavernHelper/MVU，且与 MVU App 的 stat_data 彻底隔离（两 App 独立决定）。
 *
 * 与立绘链路的关系：注入走独立通道（st-stage::newvar 槽位），解析是对 eventSource 的
 * 独立订阅——立绘的 injectPrompt / onMessageReceived 完全不动。
 *
 * Web 模拟器降级：无 SillyTavern 全局 → 不订阅事件、状态=schema 默认值、注入走预览通道；
 * App UI 据 isSTAvailable() 显示只读提示。
 */

import type { PluginSettings } from '../../../../core/types'
import { setNested, deleteNested } from '../path-utils'
import { initStateFromSchema, parseUpdateBlock, applyOps, buildInjection } from './engine'
import { NEWVAR_APP_ID, NEWVAR_EXTRA_KEY, normalizeNewvarData, type NewvarData } from './config'
import type { ApplyLogEntry } from './types'

interface ChatMessage {
  mes: string
  is_user: boolean
  extra?: Record<string, unknown>
}

interface NewvarSTContext {
  chat?: ChatMessage[]
  eventSource?: {
    on: (event: string, handler: (...args: unknown[]) => void) => void
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void
  }
  eventTypes?: Record<string, string>
  saveChatDebounced?: () => void
  saveChat?: () => unknown
}

/** 最近一次解析报告（调试面板用） */
export interface ParseReport {
  messageId: number
  found: boolean
  error?: string
  log: ApplyLogEntry[]
}

export interface NewvarRuntimeDeps {
  getSettings(): PluginSettings
  /** 经命名注入通道下发（入口处绑定 channel='newvar'）；空串=清除 */
  inject(prompt: string, depth?: number): void
}

export interface NewvarRuntime {
  start(): void
  dispose(): void
  isSTAvailable(): boolean
  /** 当前配置（每次从 settings.apps.newvar 归一化读取） */
  getData(): NewvarData
  /** 当前状态：从末楼向前找最近快照；没有则按 schema 默认值 */
  getCurrentState(): Record<string, unknown>
  /** 供 delta 高亮：当前快照楼层之前最近的一份快照 */
  getPrevState(): Record<string, unknown> | null
  /** 手动改/增一条变量（写入末楼快照 + 重注入） */
  setVariable(path: string, value: unknown): void
  /** 手动删一条变量 */
  deleteVariable(path: string): void
  /** App 改完配置（setAppData）后调用：重注入 + 通知订阅者 */
  onConfigChanged(): void
  /** 当前应注入的文本（预览用；未启用/无变量定义时为空串） */
  buildPreview(): string
  getLastParse(): ParseReport | null
  /** 订阅状态/解析变化（App UI 刷新用），返回退订函数 */
  subscribe(listener: () => void): () => void
}

export function createNewvarRuntime(deps: NewvarRuntimeDeps): NewvarRuntime {
  let lastParse: ParseReport | null = null
  let warnedSave = false
  const listeners = new Set<() => void>()
  const unsubs: Array<() => void> = []

  function getST(): NewvarSTContext | undefined {
    try {
      return window.SillyTavern?.getContext() as unknown as NewvarSTContext | undefined
    } catch {
      return undefined
    }
  }

  function getData(): NewvarData {
    return normalizeNewvarData(deps.getSettings().apps[NEWVAR_APP_ID])
  }

  function notify(): void {
    for (const l of listeners) {
      try {
        l()
      } catch (err) {
        console.error('[st-stage] 新变量订阅回调出错', err)
      }
    }
  }

  // —— 快照读写（message.extra） —— //

  function floorSnapshot(msg: ChatMessage | undefined): Record<string, unknown> | null {
    const entry = msg?.extra?.[NEWVAR_EXTRA_KEY]
    if (!entry || typeof entry !== 'object') return null
    const stat = (entry as Record<string, unknown>).stat_data
    return stat && typeof stat === 'object' && !Array.isArray(stat) ? (stat as Record<string, unknown>) : null
  }

  function clone<T>(v: T): T {
    try {
      return JSON.parse(JSON.stringify(v)) as T
    } catch {
      return v
    }
  }

  /** 从 fromId 向前找最近一份快照；无则 null */
  function findSnapshotBefore(chat: ChatMessage[], fromId: number): Record<string, unknown> | null {
    for (let i = Math.min(fromId, chat.length - 1); i >= 0; i--) {
      const snap = floorSnapshot(chat[i])
      if (snap) return clone(snap)
    }
    return null
  }

  function getCurrentState(): Record<string, unknown> {
    const chat = getST()?.chat
    if (Array.isArray(chat)) {
      const snap = findSnapshotBefore(chat, chat.length - 1)
      if (snap) return snap
    }
    return initStateFromSchema(getData().schema)
  }

  function getPrevState(): Record<string, unknown> | null {
    const chat = getST()?.chat
    if (!Array.isArray(chat)) return null
    // 找到当前快照所在楼，再向前找上一份
    for (let i = chat.length - 1; i >= 0; i--) {
      if (floorSnapshot(chat[i])) return findSnapshotBefore(chat, i - 1)
    }
    return null
  }

  function writeSnapshot(st: NewvarSTContext, messageId: number, state: Record<string, unknown>): void {
    const msg = st.chat?.[messageId]
    if (!msg) return
    if (!msg.extra || typeof msg.extra !== 'object') msg.extra = {}
    msg.extra[NEWVAR_EXTRA_KEY] = { stat_data: state }
    saveChat(st)
  }

  function saveChat(st: NewvarSTContext): void {
    try {
      if (typeof st.saveChatDebounced === 'function') {
        st.saveChatDebounced()
      } else if (typeof st.saveChat === 'function') {
        void st.saveChat()
      } else if (!warnedSave) {
        warnedSave = true
        console.warn('[st-stage] 新变量：当前 ST 版本 context 无 saveChat，快照仅存内存（重载对话丢失）')
      }
    } catch (err) {
      console.warn('[st-stage] 新变量：保存对话失败', err)
    }
  }

  // —— 注入 —— //

  function buildPreview(): string {
    const data = getData()
    if (!data.enabled || data.schema.variables.length === 0) return ''
    return buildInjection(getCurrentState(), data.schema, data.format)
  }

  function reinject(): void {
    const data = getData()
    deps.inject(buildPreview(), data.injectionDepth)
  }

  // —— AI 消息解析 —— //

  function handleMessageReceived(...args: unknown[]): void {
    const data = getData()
    if (!data.enabled) return
    const st = getST()
    const chat = st?.chat
    if (!st || !Array.isArray(chat)) return
    const rawId = args[0]
    const idNum =
      typeof rawId === 'number' ? rawId : typeof rawId === 'string' && rawId.trim() !== '' ? Number(rawId) : NaN
    const messageId = Number.isInteger(idNum) && idNum >= 0 && idNum < chat.length ? idNum : chat.length - 1
    const msg = chat[messageId]
    if (!msg || msg.is_user || typeof msg.mes !== 'string') return

    const parsed = parseUpdateBlock(msg.mes, data.format)
    if (!parsed.found) return // 无变量块的普通回复：不覆盖解析记录
    if (parsed.error) {
      lastParse = { messageId, found: true, error: parsed.error, log: [] }
      notify()
      return
    }
    // 基态 = 本楼之前最近的快照（没有则 schema 默认值）——swipe/重roll 天然以上一楼为基
    const base = findSnapshotBefore(chat, messageId - 1) ?? initStateFromSchema(data.schema)
    const result = applyOps(base, parsed.ops, data.schema)
    writeSnapshot(st, messageId, result.state)
    lastParse = { messageId, found: true, log: result.log }
    reinject()
    notify()
  }

  // —— 手动编辑（写末楼快照） —— //

  function mutateCurrent(mutate: (state: Record<string, unknown>) => void): void {
    const st = getST()
    const chat = st?.chat
    if (!st || !Array.isArray(chat) || chat.length === 0) return
    const state = getCurrentState()
    mutate(state)
    writeSnapshot(st, chat.length - 1, state)
    reinject()
    notify()
  }

  // —— 生命周期 —— //

  function subscribeEvents(): void {
    const st = getST()
    const es = st?.eventSource
    if (!es) return
    const et = st?.eventTypes ?? {}
    const bind = (name: string | undefined, fallback: string, handler: (...args: unknown[]) => void): void => {
      const event = name ?? fallback
      es.on(event, handler)
      unsubs.push(() => {
        try {
          es.removeListener(event, handler)
        } catch {
          // 退订失败不阻塞
        }
      })
    }
    bind(et.MESSAGE_RECEIVED, 'message_received', handleMessageReceived)
    // 楼层导航/结构变化：状态视角变了 → 重注入 + 通知（不重解析；重解析编辑过的楼层留 Phase 2）
    const onNav = () => {
      reinject()
      notify()
    }
    bind(et.CHAT_CHANGED, 'chat_id_changed', onNav)
    bind(et.MESSAGE_SWIPED, 'message_swiped', onNav)
    bind(et.MESSAGE_DELETED, 'message_deleted', onNav)
  }

  return {
    start() {
      subscribeEvents()
      reinject()
    },
    dispose() {
      for (const off of unsubs) off()
      unsubs.length = 0
      listeners.clear()
    },
    isSTAvailable() {
      return Array.isArray(getST()?.chat)
    },
    getData,
    getCurrentState,
    getPrevState,
    setVariable(path, value) {
      mutateCurrent((state) => setNested(state, path, value))
    },
    deleteVariable(path) {
      mutateCurrent((state) => deleteNested(state, path))
    },
    onConfigChanged() {
      reinject()
      notify()
    },
    buildPreview,
    getLastParse: () => lastParse,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
