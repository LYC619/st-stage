/**
 * 「变量」App — MVU 楼层变量可视化 / 编辑器：
 * 把当前对话「最后一层」的消息作用域变量（message-scope variables）拍平成树状卡片，
 * 支持查看、类型感知编辑、删除、新增，并在 MVU 变量真正更新时精准自动刷新。
 *
 * 接口面已按 MVU 框架真实源码（reference/MVU/MagVarUpdate-beta/src）核实：
 * - 全局对象 `Mvu` 挂在 window.parent（顶层窗口 parent===window），先 await waitGlobalInitialized('Mvu')。
 * - getMvuData(scope) 同步返回**整包** MvuData：{ stat_data, display_data, delta_data, schema, ... }。
 *   真实变量在 stat_data 子树；display_data/delta_data 已 deprecated，是派生展示数据。
 * - 写入官方路径：getMvuData → 直接改 data.stat_data → await replaceMvuData(data, scope)。
 *   **不用 deprecated 的 setMvuVariable**（它要求 path 已存在→不能新增，且不更新 display/delta）。
 * - 删除只动 stat_data；display/delta 由 MVU 每轮重算，无需三处同删。
 * - VWD 描述二元组 [值, "描述"]：判定 length===2 && typeof [1]==='string' && !Array.isArray([0])
 *   （对齐 variable_def.ts:isValueWithDescription + update_variables 的降误判规则）。编辑值时保留描述。
 * - 精准刷新：监听 MVU 事件 `mag_variable_update_ended`（Mvu.events.VARIABLE_UPDATE_ENDED），
 *   经酒馆助手 eventEmit 路由到 SillyTavern eventSource；文档里的 AFTER_UPDATE 不存在，勿用。
 *
 * 降级：MVU 不可用 → 酒馆助手 getVariables/updateVariablesWith（同样操作 stat_data 子树）。
 *      两者都没有（Web 模拟器）→ 只读提示。
 *
 * 交互纪律：任何写入完成后统一重读刷新，不靠改当前 DOM 制造「看起来成功」。
 * 安全：所有变量键/值一律 textContent，绝不拼 innerHTML。
 */

import type { PhoneApp, PhoneAppContext } from '../../../core/phone-registry'
import { el, appButton } from './widgets'

// —— MVU / 酒馆助手 / ST 全局运行时类型（字段随版本可能缺失，全部可选） —— //

interface MvuScope {
  type: 'message'
  message_id: number | 'latest'
}

interface MvuData {
  stat_data?: Record<string, unknown>
  display_data?: Record<string, unknown>
  delta_data?: Record<string, unknown>
  [k: string]: unknown
}

interface MvuApi {
  getMvuData?: (scope: MvuScope) => MvuData | Promise<MvuData>
  replaceMvuData?: (data: MvuData, scope: MvuScope) => unknown
  /** 事件名枚举（variable_events）：VARIABLE_UPDATE_ENDED = 'mag_variable_update_ended' 等 */
  events?: Record<string, string>
}

interface TavernHelperApi {
  getLastMessageId?: () => number
  getVariables?: (scope: MvuScope) => Record<string, unknown> | Promise<Record<string, unknown>>
  replaceVariables?: (vars: Record<string, unknown>, scope: MvuScope) => unknown
  updateVariablesWith?: (
    updater: (vars: Record<string, unknown>) => Record<string, unknown>,
    scope: MvuScope,
  ) => unknown
}

/** 事件订阅所需的 ST context 最小切面 */
interface VarSTContext {
  eventSource?: {
    on: (event: string, handler: (...args: unknown[]) => void) => void
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void
  }
  eventTypes?: Record<string, string>
  chat?: Array<unknown>
}

function getMvu(): MvuApi | undefined {
  // Mvu 挂在 window.parent（楼层 iframe 场景）；主窗口顶层 parent===window
  const w = window as unknown as { Mvu?: MvuApi; parent?: { Mvu?: MvuApi } }
  return w.parent?.Mvu ?? w.Mvu
}

function getHelper(): TavernHelperApi | undefined {
  const w = window as unknown as { TavernHelper?: TavernHelperApi; parent?: { TavernHelper?: TavernHelperApi } }
  return w.parent?.TavernHelper ?? w.TavernHelper
}

function getST(): VarSTContext | undefined {
  try {
    return window.SillyTavern?.getContext() as unknown as VarSTContext | undefined
  } catch {
    return undefined
  }
}

function isMvuAvailable(): boolean {
  const mvu = getMvu()
  return typeof mvu?.getMvuData === 'function' && typeof mvu?.replaceMvuData === 'function'
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// —— 值判定与嵌套路径工具（点号路径，纯 JS） —— //

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * MVU 的「描述二元组」叶子 ValueWithDescription：[当前值, "描述"]。
 * 判据对齐源码 isValueWithDescription + 降误判规则：长度 2、第二项字符串、第一项不是数组。
 * 本质歧义（可能是真实的 [任意值, 字符串] 数据），无法 100% 区分——保守判定。
 */
function isTupleLeaf(v: unknown): v is [unknown, string] {
  return Array.isArray(v) && v.length === 2 && typeof v[1] === 'string' && !Array.isArray(v[0])
}

function splitPath(path: string): string[] {
  return path.split('.').filter((seg) => seg.length > 0)
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj
  for (const seg of splitPath(path)) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

function setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segs = splitPath(path)
  if (segs.length === 0) return
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]
    const next = cur[seg]
    if (next == null || typeof next !== 'object' || Array.isArray(next)) cur[seg] = {}
    cur = cur[seg] as Record<string, unknown>
  }
  cur[segs[segs.length - 1]] = value
}

function deleteNested(obj: Record<string, unknown>, path: string): void {
  const segs = splitPath(path)
  if (segs.length === 0) return
  let cur: unknown = obj
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur == null || typeof cur !== 'object') return
    cur = (cur as Record<string, unknown>)[segs[i]]
  }
  if (cur != null && typeof cur === 'object') delete (cur as Record<string, unknown>)[segs[segs.length - 1]]
}

/** 把 message 变量包归一化到「变量根」：有 stat_data 子树就用它（MVU 结构），否则视为扁平 */
function extractStatRoot(wrapper: Record<string, unknown>): { root: Record<string, unknown>; wrapped: boolean } {
  if (isPlainObject(wrapper.stat_data)) return { root: wrapper.stat_data, wrapped: true }
  return { root: wrapper, wrapped: false }
}

// —— 读取通道 —— //

/** 当前对话最后一层的 message_id（变量按楼层作用域，取最新层） */
function getLastMessageId(st: VarSTContext | undefined): number {
  const helper = getHelper()
  if (typeof helper?.getLastMessageId === 'function') {
    try {
      const id = helper.getLastMessageId()
      if (Number.isInteger(id) && id >= 0) return id
    } catch {
      // 忽略，走 chat 回退
    }
  }
  const chat = st?.chat
  if (Array.isArray(chat) && chat.length > 0) return chat.length - 1
  return -1
}

/** 等 MVU 初始化：waitGlobalInitialized('Mvu') 与超时竞速 */
async function waitForMvuInitialized(timeoutMs: number): Promise<void> {
  const w = window as unknown as {
    waitGlobalInitialized?: (name: string) => Promise<unknown>
    parent?: { waitGlobalInitialized?: (name: string) => Promise<unknown> }
  }
  const waitFn = w.parent?.waitGlobalInitialized ?? w.waitGlobalInitialized
  if (typeof waitFn !== 'function') return
  await Promise.race([Promise.resolve(waitFn('Mvu')).catch(() => undefined), delay(timeoutMs)])
}

/** 反复读 getMvuData，直到 stat_data 有键或用尽超时——治「首开读到空壳」 */
async function readMvuDataWithRetry(
  scope: MvuScope,
  timeoutMs: number,
  intervalMs: number,
): Promise<{ data: MvuData; attempts: number }> {
  const mvu = getMvu()!
  const start = Date.now()
  let attempts = 0
  let data: MvuData
  for (;;) {
    attempts++
    data = (await Promise.resolve(mvu.getMvuData!(scope))) ?? {}
    const stat = data.stat_data
    if (stat && Object.keys(stat).length > 0) return { data, attempts }
    if (Date.now() - start >= timeoutMs) return { data, attempts }
    await delay(intervalMs)
  }
}

type ReadStatus = 'ready' | 'empty' | 'error' | 'unavailable'

interface ReadResult {
  status: ReadStatus
  /** 归一化后的变量根对象（MVU/助手的 stat_data 子树，或扁平变量对象） */
  data: Record<string, unknown>
  isMvu: boolean
  /** 变量是否在 stat_data 子树下（决定写入路径前缀） */
  wrapped: boolean
  messageId: number
  meta: {
    source: 'mvu' | 'tavern-helper' | 'none'
    waitedMvu: boolean
    attempts: number
    mvuInitiallyAvailable: boolean
    mvuAvailableAfterWait: boolean
  }
  error?: string
}

async function readHelperWrapper(scope: MvuScope): Promise<Record<string, unknown> | null> {
  const helper = getHelper()
  if (typeof helper?.getVariables !== 'function') return null
  const vars = await Promise.resolve(helper.getVariables(scope))
  return vars && typeof vars === 'object' ? vars : {}
}

async function readVariables(scope: MvuScope, messageId: number): Promise<ReadResult> {
  const meta: ReadResult['meta'] = {
    source: 'none',
    waitedMvu: false,
    attempts: 0,
    mvuInitiallyAvailable: isMvuAvailable(),
    mvuAvailableAfterWait: false,
  }
  const base = { isMvu: false, wrapped: true, messageId, meta }
  if (messageId < 0) return { status: 'empty', data: {}, ...base }

  if (!isMvuAvailable()) {
    await waitForMvuInitialized(1200)
    meta.waitedMvu = true
  }
  meta.mvuAvailableAfterWait = isMvuAvailable()

  if (isMvuAvailable()) {
    try {
      const { data, attempts } = await readMvuDataWithRetry(scope, 1200, 120)
      meta.attempts = attempts
      const stat = data.stat_data ?? {}
      if (Object.keys(stat).length > 0) {
        meta.source = 'mvu'
        return { status: 'ready', data: stat, isMvu: true, wrapped: true, messageId, meta }
      }
      // MVU 读到空 → 酒馆助手兜底
      const helperFallback = await readHelperFallback(scope, messageId, meta)
      if (helperFallback) return helperFallback
      return { status: 'empty', data: {}, isMvu: true, wrapped: true, messageId, meta }
    } catch (err) {
      const helperFallback = await readHelperFallback(scope, messageId, meta)
      if (helperFallback) return helperFallback
      return {
        status: 'error',
        data: {},
        isMvu: false,
        wrapped: true,
        messageId,
        meta,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  // 无 MVU → 只能走酒馆助手
  const wrapper = await readHelperWrapper(scope).catch(() => null)
  if (wrapper) {
    const { root, wrapped } = extractStatRoot(wrapper)
    meta.source = Object.keys(root).length > 0 ? 'tavern-helper' : 'none'
    return {
      status: Object.keys(root).length > 0 ? 'ready' : 'empty',
      data: root,
      isMvu: false,
      wrapped,
      messageId,
      meta,
    }
  }
  return { status: 'unavailable', data: {}, isMvu: false, wrapped: true, messageId, meta }
}

/** MVU 读到空/报错时尝试酒馆助手，命中返回 ready 结果，否则 null */
async function readHelperFallback(
  scope: MvuScope,
  messageId: number,
  meta: ReadResult['meta'],
): Promise<ReadResult | null> {
  const wrapper = await readHelperWrapper(scope).catch(() => null)
  if (!wrapper) return null
  const { root, wrapped } = extractStatRoot(wrapper)
  if (Object.keys(root).length === 0) return null
  meta.source = 'tavern-helper'
  return { status: 'ready', data: root, isMvu: false, wrapped, messageId, meta }
}

// —— 写入通道 —— //

function fullPath(wrapped: boolean, path: string): string {
  return wrapped ? `stat_data.${path}` : path
}

/** 在变量包上应用一次「改/增」：带 VWD 描述保留 */
function applySet(container: Record<string, unknown>, wrapped: boolean, path: string, value: unknown): void {
  const fp = fullPath(wrapped, path)
  const old = getNested(container, fp)
  const final = isTupleLeaf(old) ? [value, old[1]] : value
  setNested(container, fp, final)
}

/** 改 / 增 同一条路径（官方路径：getMvuData → 改 stat_data → replaceMvuData） */
async function setFloorVariable(scope: MvuScope, wrapped: boolean, path: string, value: unknown): Promise<void> {
  const mvu = getMvu()
  if (isMvuAvailable()) {
    const wrapper = ((await Promise.resolve(mvu!.getMvuData!(scope))) as MvuData) ?? {}
    applySet(wrapper, true, path, value) // MVU 数据恒为 stat_data 子树
    await Promise.resolve(mvu!.replaceMvuData!(wrapper, scope))
    return
  }
  await writeHelper(scope, (vars) => applySet(vars, wrapped, path, value))
}

/** 删除一条路径：只动 stat_data（display/delta 为 MVU 派生数据，会自然重算） */
async function deleteFloorVariable(scope: MvuScope, wrapped: boolean, path: string): Promise<void> {
  const mvu = getMvu()
  if (isMvuAvailable()) {
    const wrapper = ((await Promise.resolve(mvu!.getMvuData!(scope))) as MvuData) ?? {}
    deleteNested(wrapper, fullPath(true, path))
    await Promise.resolve(mvu!.replaceMvuData!(wrapper, scope))
    return
  }
  await writeHelper(scope, (vars) => deleteNested(vars, fullPath(wrapped, path)))
}

/** 酒馆助手降级写：优先原子的 updateVariablesWith，否则 getVariables + replaceVariables */
async function writeHelper(scope: MvuScope, mutate: (vars: Record<string, unknown>) => void): Promise<void> {
  const helper = getHelper()
  if (typeof helper?.updateVariablesWith === 'function') {
    await Promise.resolve(
      helper.updateVariablesWith((vars) => {
        const v = isPlainObject(vars) ? vars : {}
        mutate(v)
        return v
      }, scope),
    )
    return
  }
  if (typeof helper?.getVariables === 'function' && typeof helper?.replaceVariables === 'function') {
    const vars = ((await Promise.resolve(helper.getVariables(scope))) as Record<string, unknown>) ?? {}
    mutate(vars)
    await Promise.resolve(helper.replaceVariables(vars, scope))
    return
  }
  throw new Error('无可用的变量写入通道（MVU / 酒馆助手均不可用）')
}

// —— 值展示与编辑控件类型 —— //

/** 供叶子展示与 JSON 编辑预填：字符串原样，对象/数组 JSON 化，其余 String() */
function formatValue(v: unknown): string {
  if (typeof v === 'string') return v
  if (v === null) return 'null'
  if (v === undefined) return ''
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

/** 解析文本输入为实际值：null/true/false/数字/JSON 数组或对象，其余按字符串 */
function parseInputValue(raw: string): unknown {
  const t = raw.trim()
  if (t === 'null') return null
  if (t === 'true') return true
  if (t === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return JSON.parse(t)
    } catch {
      // 非法 JSON → 当普通字符串
    }
  }
  return raw
}

type EditKind = 'boolean' | 'json' | 'text'

/** 按当前值类型选编辑控件：布尔→开关、对象/数组→JSON、其余→文本 */
function editKind(v: unknown): EditKind {
  if (typeof v === 'boolean') return 'boolean'
  if (v !== null && typeof v === 'object') return 'json'
  return 'text'
}

function valueTypeLabel(v: unknown, tuple: boolean): string {
  const inner = tuple ? (v as [unknown, string])[0] : v
  if (inner === null) return 'null'
  if (Array.isArray(inner)) return `数组[${inner.length}]`
  if (typeof inner === 'object') return '对象'
  return typeof inner === 'number' ? '数字' : typeof inner === 'boolean' ? '布尔' : '文本'
}

// —— 页面实例（render token 防过期 + MVU 精准事件自动刷新） —— //

interface Instance {
  start(): void
  dispose(): void
}

// 本 App 直接访问全局 MVU/酒馆助手/ST context，不经 PhoneAppContext；ctx 保留供将来持久化 UI 偏好
function createInstance(container: HTMLElement, _ctx: PhoneAppContext): Instance {
  let disposed = false
  let seq = 0 // render token：异步 load 完成后比对，过期结果丢弃
  let lastResult: ReadResult | null = null
  let editingPath: string | null = null // 正在编辑的叶子路径（纯 UI 状态，不触发数据重读）
  let pendingRefresh = false
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  const unsubs: Array<() => void> = []

  function isStale(token: number): boolean {
    return disposed || token !== seq || !container.isConnected
  }

  async function load(): Promise<void> {
    const token = ++seq
    editingPath = null
    const st = getST()
    const messageId = getLastMessageId(st)
    renderLoading()
    const result = await readVariables({ type: 'message', message_id: messageId }, messageId)
    if (isStale(token)) return
    lastResult = result
    render()
  }

  function scheduleRefresh(): void {
    if (disposed) return
    if (editingPath !== null) {
      pendingRefresh = true // 别打断用户正在输入的编辑框
      return
    }
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      if (!disposed && editingPath === null) void load()
    }, 300)
  }

  function subscribeEvents(): void {
    const st = getST()
    const es = st?.eventSource
    if (!es) return
    const mvu = getMvu()
    // MVU 变量真正更新的精准信号（经酒馆助手 eventEmit 路由到 SillyTavern eventSource）
    const names = new Set<string>([
      mvu?.events?.VARIABLE_UPDATE_ENDED ?? 'mag_variable_update_ended',
      mvu?.events?.VARIABLE_INITIALIZED ?? 'mag_variable_initialized',
      // 楼层导航类：切对话 / 划动 / 删除消息会改变「最后一层」
      st?.eventTypes?.CHAT_CHANGED ?? 'chat_id_changed',
      st?.eventTypes?.MESSAGE_SWIPED ?? 'message_swiped',
      st?.eventTypes?.MESSAGE_DELETED ?? 'message_deleted',
    ])
    for (const name of names) {
      if (!name) continue
      const handler = () => scheduleRefresh()
      es.on(name, handler)
      unsubs.push(() => {
        try {
          es.removeListener(name, handler)
        } catch {
          // 退订失败不阻塞
        }
      })
    }
  }

  // —— 渲染 —— //

  function renderLoading(): void {
    if (lastResult) return // 已有内容就别闪 loading（自动刷新时保持画面）
    container.textContent = ''
    const section = el('div', 'so-app-section')
    const d = el('div', 'so-app-desc')
    d.textContent = '正在读取楼层变量…'
    section.append(d)
    container.append(section)
  }

  function sourceLabel(r: ReadResult): string {
    if (r.meta.source === 'mvu') return 'MVU'
    if (r.meta.source === 'tavern-helper') return '酒馆助手'
    return '—'
  }

  function currentScope(): MvuScope {
    return { type: 'message', message_id: lastResult?.messageId ?? getLastMessageId(getST()) }
  }

  function currentWrapped(): boolean {
    return lastResult?.wrapped ?? true
  }

  function render(): void {
    const r = lastResult
    if (!r) {
      renderLoading()
      return
    }
    container.textContent = ''

    // 顶部：状态 + 刷新
    const head = el('div', 'so-app-section vm-head')
    const line = el('div', 'vm-statusrow')
    const status = el('div', 'so-app-desc vm-status')
    status.textContent = `来源：${sourceLabel(r)} · ${r.messageId >= 0 ? `楼层 #${r.messageId}` : '无对话'}`
    line.append(status)
    const refreshBtn = el('button', 'menu_button vm-refresh')
    refreshBtn.setAttribute('role', 'button')
    refreshBtn.textContent = '刷新'
    refreshBtn.addEventListener('click', () => void load())
    line.append(refreshBtn)
    head.append(line)
    container.append(head)

    if (r.status === 'unavailable') {
      appendNotice(
        '未检测到 MVU 框架或酒馆助手（Web 模拟器中仅可查看本说明）。在 SillyTavern 内、且安装了 MVU/酒馆助手时才能读写楼层变量。',
      )
      return
    }
    if (r.status === 'error') {
      appendNotice(`读取变量出错：${r.error ?? '未知错误'}。可点「刷新」重试。`)
    }

    const keys = Object.keys(r.data)
    if (keys.length === 0) {
      appendNotice(
        r.status === 'empty' && r.meta.waitedMvu
          ? '当前楼层暂无变量（已等待 MVU 初始化）。有变量的楼层刷新后会显示在这里。'
          : '当前楼层暂无变量。',
      )
    } else {
      const tree = el('div', 'vm-tree')
      for (const key of keys) renderNode(tree, key, r.data[key], key, r.isMvu, 0)
      container.append(tree)
    }

    container.append(buildAddSection(r))
  }

  function appendNotice(text: string): void {
    const note = el('div', 'so-app-section')
    const d = el('div', 'so-app-desc')
    d.textContent = text
    note.append(d)
    container.append(note)
  }

  function renderNode(
    parent: HTMLElement,
    key: string,
    value: unknown,
    path: string,
    isMvu: boolean,
    depth: number,
  ): void {
    const tuple = isMvu && isTupleLeaf(value)
    if (!tuple && isPlainObject(value) && Object.keys(value).length > 0) {
      const details = document.createElement('details')
      details.className = 'so-app-fold vm-group'
      details.open = depth < 1
      const summary = document.createElement('summary')
      summary.className = 'so-app-title vm-group-title'
      summary.textContent = `${key}（${Object.keys(value).length}）`
      const body = el('div', 'so-app-fold-body vm-group-body')
      for (const childKey of Object.keys(value)) {
        renderNode(body, childKey, (value as Record<string, unknown>)[childKey], `${path}.${childKey}`, isMvu, depth + 1)
      }
      details.append(summary, body)
      parent.append(details)
      return
    }
    renderLeaf(parent, key, value, path, tuple)
  }

  function renderLeaf(parent: HTMLElement, key: string, value: unknown, path: string, tuple: boolean): void {
    if (editingPath === path) {
      parent.append(buildEditForm(key, value, path, tuple))
      return
    }
    const card = el('div', 'vm-leaf')
    const main = el('div', 'vm-leaf-main')
    const keyEl = el('span', 'vm-key')
    keyEl.textContent = key
    const valEl = el('span', 'vm-val')
    const shown = formatValue(tuple ? (value as [unknown, string])[0] : value)
    valEl.textContent = shown.length > 80 ? `${shown.slice(0, 80)}…` : shown
    valEl.title = `类型：${valueTypeLabel(value, tuple)}`
    main.append(keyEl, valEl)
    if (tuple) {
      const desc = el('div', 'vm-desc')
      desc.textContent = (value as [unknown, string])[1]
      main.append(desc)
    }

    main.setAttribute('role', 'button')
    main.tabIndex = 0
    const enterEdit = () => {
      editingPath = path
      render()
    }
    main.addEventListener('click', enterEdit)
    main.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        enterEdit()
      }
    })

    const del = el('button', 'vm-del')
    del.setAttribute('aria-label', '删除变量')
    del.title = '删除该变量'
    del.textContent = '✕'
    del.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!window.confirm(`删除变量「${path}」？此操作不可撤销。`)) return
      void runWrite(() => deleteFloorVariable(currentScope(), currentWrapped(), path))
    })

    card.append(main, del)
    parent.append(card)
  }

  function buildEditForm(key: string, value: unknown, path: string, tuple: boolean): HTMLElement {
    const inner = tuple ? (value as [unknown, string])[0] : value
    const kind = editKind(inner)
    const wrap = el('div', 'vm-leaf vm-editing')

    const title = el('div', 'so-app-title vm-edit-title')
    title.textContent = `${key} · ${valueTypeLabel(value, tuple)}`
    wrap.append(title)
    if (tuple) {
      const desc = el('div', 'vm-desc')
      desc.textContent = `描述：${(value as [unknown, string])[1]}（保留不变，仅编辑值）`
      wrap.append(desc)
    }

    const err = el('div', 'so-app-desc vm-add-err')
    err.hidden = true

    // 按类型给控件；readValue 统一返回 { ok, value?, msg? }
    let readValue: () => { ok: boolean; value?: unknown; msg?: string }
    if (kind === 'boolean') {
      const sel = document.createElement('select')
      sel.className = 'text_pole so-app-input vm-edit-input'
      for (const opt of [
        { v: 'true', t: '真（true）' },
        { v: 'false', t: '假（false）' },
      ]) {
        const o = document.createElement('option')
        o.value = opt.v
        o.textContent = opt.t
        if ((inner === true) === (opt.v === 'true')) o.selected = true
        sel.append(o)
      }
      wrap.append(sel)
      readValue = () => ({ ok: true, value: sel.value === 'true' })
    } else if (kind === 'json') {
      const ta = document.createElement('textarea')
      ta.className = 'text_pole so-app-input vm-edit-input'
      ta.rows = 5
      ta.value = formatValue(inner)
      wrap.append(ta)
      readValue = () => {
        try {
          return { ok: true, value: JSON.parse(ta.value) }
        } catch (e) {
          return { ok: false, msg: `JSON 格式错误：${e instanceof Error ? e.message : String(e)}` }
        }
      }
      setTimeout(() => ta.focus(), 0)
    } else {
      const input = document.createElement('input')
      input.type = 'text'
      input.className = 'text_pole so-app-input vm-edit-input'
      input.value = formatValue(inner)
      input.autocomplete = 'off'
      wrap.append(input)
      readValue = () => ({ ok: true, value: parseInputValue(input.value) })
      setTimeout(() => input.focus(), 0)
    }
    wrap.append(err)

    const actions = el('div', 'vm-actions')
    const save = el('button', 'menu_button vm-act')
    save.textContent = '保存'
    save.addEventListener('click', () => {
      const r = readValue()
      if (!r.ok) {
        err.textContent = r.msg ?? '输入无效。'
        err.hidden = false
        return
      }
      void runWrite(() => setFloorVariable(currentScope(), currentWrapped(), path, r.value))
    })
    const cancel = el('button', 'menu_button vm-act vm-act-ghost')
    cancel.textContent = '取消'
    cancel.addEventListener('click', () => {
      editingPath = null
      if (pendingRefresh) {
        pendingRefresh = false
        void load()
      } else {
        render()
      }
    })
    actions.append(save, cancel)
    wrap.append(actions)
    return wrap
  }

  function buildAddSection(r: ReadResult): HTMLElement {
    const box = document.createElement('details')
    box.className = 'so-app-fold so-app-section'
    const summary = document.createElement('summary')
    summary.className = 'so-app-title'
    summary.textContent = '＋ 新增变量'
    const body = el('div', 'so-app-fold-body')

    const canWrite = r.status !== 'unavailable'
    const hint = el('div', 'so-app-desc')
    hint.textContent = canWrite
      ? '路径用点号表示层级，如 角色.络络.好感度。值支持 数字 / true / false / null / JSON / 文本。'
      : '当前环境不可写入变量。'
    body.append(hint)

    const pathInput = document.createElement('input')
    pathInput.type = 'text'
    pathInput.className = 'text_pole so-app-input'
    pathInput.placeholder = '变量路径（如 状态.体力）'
    pathInput.autocomplete = 'off'
    const valInput = document.createElement('input')
    valInput.type = 'text'
    valInput.className = 'text_pole so-app-input'
    valInput.placeholder = '值（如 80 / 健康 / true）'
    valInput.autocomplete = 'off'
    body.append(pathInput, valInput)

    const err = el('div', 'so-app-desc vm-add-err')
    err.hidden = true
    body.append(err)

    body.append(
      appButton('添加', () => {
        const path = pathInput.value.trim()
        if (!path) {
          err.textContent = '请填写变量路径。'
          err.hidden = false
          return
        }
        if (!canWrite) {
          err.textContent = '当前环境不可写入变量。'
          err.hidden = false
          return
        }
        const parsed = parseInputValue(valInput.value)
        void runWrite(() => setFloorVariable(currentScope(), currentWrapped(), path, parsed))
      }),
    )

    box.append(summary, body)
    return box
  }

  /** 统一写入包装：写完必重读刷新；失败弹提示不炸页面 */
  async function runWrite(op: () => Promise<void>): Promise<void> {
    try {
      await op()
    } catch (err) {
      console.error('[st-stage] 变量写入失败', err)
      window.alert(`写入失败：${err instanceof Error ? err.message : String(err)}`)
    }
    if (!disposed) await load()
  }

  return {
    start() {
      subscribeEvents()
      void load()
    },
    dispose() {
      disposed = true
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = null
      for (const off of unsubs) off()
      unsubs.length = 0
    },
  }
}

export function variableApp(): PhoneApp {
  let inst: Instance | null = null
  return {
    id: 'variables',
    name: '变量',
    icon: '🔢',
    order: 4,
    mount(container, ctx) {
      inst?.dispose()
      inst = createInstance(container, ctx)
      inst.start()
    },
    unmount() {
      inst?.dispose()
      inst = null
    },
  }
}
