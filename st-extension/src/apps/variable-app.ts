/**
 * 「变量」App — MVU 楼层变量可视化 / 编辑器：
 * 把当前对话「最后一层」的消息作用域变量（message-scope variables）拍平成树状卡片，
 * 支持查看、编辑、删除、新增，并在消息事件时自动刷新。
 *
 * 数据通道（双路径，主备）：
 * - 主：MVU 框架（window.Mvu）。只用 4 个全局 API：
 *     getMvuData({type:'message',message_id}) 读 → { stat_data, display_data, delta_data }
 *     setMvuVariable(data, path, value, opts)  改内存对象
 *     replaceMvuData(data, {type,message_id}) 提交（不调 = 没写）
 *     globalThis.waitGlobalInitialized('Mvu') 等初始化（首开时序）
 * - 备：酒馆助手（window.TavernHelper）的 getVariables / replaceVariables。
 * - 两者都没有（如 Web 模拟器）→ 只读提示。
 *
 * 三个必须带走的坑（来自玉子手机的踩坑经验）：
 * 1. 首开时序：MVU 初始化时机不确定，不能「读到空就当空」。区分 ready/empty/error/unavailable，
 *    读结果带 meta（是否等过初始化、重试次数、等待前后可用性）用于排障。
 * 2. tuple 描述补偿：MVU 叶子常是 [值, "描述"] 二元组，UI 只显示值；写回时 setMvuVariable
 *    可能抹掉描述，需手动把 [新值, 旧描述] 补回去。
 * 3. 三处同删：删除变量要同时删 stat_data / display_data / delta_data，否则残留幽灵数据。
 *
 * 交互纪律：任何写入完成后统一重读数据刷新（load()），不允许只改当前 DOM 卡片制造「看起来成功」。
 * 安全：所有变量键/值一律 textContent，绝不拼 innerHTML（变量内容可能含 HTML）。
 */

import type { PhoneApp, PhoneAppContext } from '../../../core/phone-registry'
import { el, appButton } from './widgets'

// —— ST / MVU / TavernHelper 全局运行时类型（字段随版本可能缺失，全部可选） —— //

interface MvuScope {
  type: 'message'
  message_id: number
}

interface MvuData {
  stat_data?: Record<string, unknown>
  display_data?: Record<string, unknown>
  delta_data?: Record<string, unknown>
}

interface MvuApi {
  getMvuData?: (scope: MvuScope) => MvuData | Promise<MvuData>
  setMvuVariable?: (data: MvuData, path: string, value: unknown, opts?: { reason?: string }) => unknown
  replaceMvuData?: (data: MvuData, scope: MvuScope) => unknown
}

interface TavernHelperApi {
  getLastMessageId?: () => number
  getVariables?: (scope: MvuScope) => Record<string, unknown> | Promise<Record<string, unknown>>
  replaceVariables?: (vars: Record<string, unknown>, scope: MvuScope) => unknown
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
  return (window as unknown as { Mvu?: MvuApi }).Mvu
}

function getHelper(): TavernHelperApi | undefined {
  return (window as unknown as { TavernHelper?: TavernHelperApi }).TavernHelper
}

function getST(): VarSTContext | undefined {
  try {
    return window.SillyTavern?.getContext() as unknown as VarSTContext | undefined
  } catch {
    return undefined
  }
}

function isMvuAvailable(): boolean {
  return typeof getMvu()?.getMvuData === 'function'
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
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

/** 等 MVU 初始化：waitGlobalInitialized('Mvu') 与超时竞速，都不阻塞太久 */
async function waitForMvuInitialized(timeoutMs: number): Promise<void> {
  const waitFn = (globalThis as unknown as { waitGlobalInitialized?: (name: string) => Promise<unknown> })
    .waitGlobalInitialized
  if (typeof waitFn !== 'function') return
  await Promise.race([
    Promise.resolve(waitFn('Mvu')).catch(() => undefined),
    delay(timeoutMs),
  ])
}

/** 反复读 getMvuData，直到 stat_data 有键或用尽超时——治「首开读到空壳」 */
async function readMvuDataWithRetry(
  scope: MvuScope,
  timeoutMs: number,
  intervalMs: number,
): Promise<{ data: MvuData; attempts: number }> {
  const mvu = getMvu()
  const start = Date.now()
  let attempts = 0
  let data: MvuData
  for (;;) {
    attempts++
    data = (await Promise.resolve(mvu!.getMvuData!(scope))) ?? {}
    const stat = data.stat_data
    if (stat && Object.keys(stat).length > 0) return { data, attempts }
    if (Date.now() - start >= timeoutMs) return { data, attempts }
    await delay(intervalMs)
  }
}

type ReadStatus = 'ready' | 'empty' | 'error' | 'unavailable'

interface ReadResult {
  status: ReadStatus
  /** 归一化后的变量对象（MVU 的 stat_data 或酒馆助手 vars） */
  data: Record<string, unknown>
  isMvu: boolean
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

async function readHelperVars(scope: MvuScope): Promise<Record<string, unknown> | null> {
  const helper = getHelper()
  if (typeof helper?.getVariables !== 'function') return null
  const vars = await Promise.resolve(helper.getVariables(scope))
  return vars && typeof vars === 'object' ? vars : {}
}

async function readVariables(scope: MvuScope): Promise<ReadResult> {
  const meta: ReadResult['meta'] = {
    source: 'none',
    waitedMvu: false,
    attempts: 0,
    mvuInitiallyAvailable: isMvuAvailable(),
    mvuAvailableAfterWait: false,
  }
  if (scope.message_id < 0) {
    return { status: 'empty', data: {}, isMvu: false, messageId: scope.message_id, meta }
  }

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
        return { status: 'ready', data: stat, isMvu: true, messageId: scope.message_id, meta }
      }
      // MVU 读到空 → 尝试酒馆助手兜底
      const helperVars = await readHelperVars(scope).catch(() => null)
      if (helperVars && Object.keys(helperVars).length > 0) {
        meta.source = 'tavern-helper'
        return { status: 'ready', data: helperVars, isMvu: false, messageId: scope.message_id, meta }
      }
      return { status: 'empty', data: {}, isMvu: true, messageId: scope.message_id, meta }
    } catch (err) {
      const helperVars = await readHelperVars(scope).catch(() => null)
      if (helperVars && Object.keys(helperVars).length > 0) {
        meta.source = 'tavern-helper'
        return { status: 'ready', data: helperVars, isMvu: false, messageId: scope.message_id, meta }
      }
      return {
        status: 'error',
        data: {},
        isMvu: false,
        messageId: scope.message_id,
        meta,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  // 无 MVU → 只能走酒馆助手
  const helperVars = await readHelperVars(scope).catch(() => null)
  if (helperVars) {
    meta.source = Object.keys(helperVars).length > 0 ? 'tavern-helper' : 'none'
    return {
      status: Object.keys(helperVars).length > 0 ? 'ready' : 'empty',
      data: helperVars,
      isMvu: false,
      messageId: scope.message_id,
      meta,
    }
  }
  return { status: 'unavailable', data: {}, isMvu: false, messageId: scope.message_id, meta }
}

// —— 嵌套路径工具（点号路径，纯 JS，不依赖 lodash） —— //

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
    if (next == null || typeof next !== 'object' || Array.isArray(next)) {
      cur[seg] = {}
    }
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
  if (cur != null && typeof cur === 'object') {
    delete (cur as Record<string, unknown>)[segs[segs.length - 1]]
  }
}

// —— 写入通道 —— //

async function writeHelper(scope: MvuScope, mutate: (vars: Record<string, unknown>) => void): Promise<void> {
  const helper = getHelper()
  if (typeof helper?.getVariables === 'function' && typeof helper?.replaceVariables === 'function') {
    const vars = ((await Promise.resolve(helper.getVariables(scope))) as Record<string, unknown>) ?? {}
    mutate(vars)
    await Promise.resolve(helper.replaceVariables(vars, scope))
    return
  }
  throw new Error('无可用的变量写入通道（MVU / 酒馆助手均不可用）')
}

/** 改 / 增 同一条路径（增就是往不存在的路径写）。带 tuple 描述补偿。 */
async function setFloorVariable(scope: MvuScope, path: string, value: unknown): Promise<void> {
  const mvu = getMvu()
  if (typeof mvu?.getMvuData === 'function' && typeof mvu?.replaceMvuData === 'function') {
    const data = ((await Promise.resolve(mvu.getMvuData(scope))) as MvuData) ?? {}
    if (!data.stat_data) data.stat_data = {}
    const stat = data.stat_data
    const oldLeaf = getNested(stat, path)
    const oldDesc =
      Array.isArray(oldLeaf) && oldLeaf.length >= 2 && typeof oldLeaf[1] === 'string' ? oldLeaf[1] : undefined

    if (typeof mvu.setMvuVariable === 'function') {
      await Promise.resolve(mvu.setMvuVariable(data, path, value, { reason: 'st-stage 变量管理器手动编辑' }))
    } else {
      setNested(stat, path, value)
    }

    // 描述补偿：MVU 可能把 [值,"描述"] 抹成裸值，若原来有描述且现在丢了，补回 [新值, 旧描述]
    if (oldDesc !== undefined) {
      const cur = getNested(data.stat_data, path)
      if (!Array.isArray(cur)) setNested(data.stat_data, path, [value, oldDesc])
    }

    await Promise.resolve(mvu.replaceMvuData(data, scope))
    return
  }
  await writeHelper(scope, (vars) => setNested(vars, path, value))
}

/** 删除一条路径：MVU 三处同删（stat/display/delta），否则留幽灵数据 */
async function deleteFloorVariable(scope: MvuScope, path: string): Promise<void> {
  const mvu = getMvu()
  if (typeof mvu?.getMvuData === 'function' && typeof mvu?.replaceMvuData === 'function') {
    const data = ((await Promise.resolve(mvu.getMvuData(scope))) as MvuData) ?? {}
    if (data.stat_data) deleteNested(data.stat_data, path)
    if (data.display_data) deleteNested(data.display_data, path)
    if (data.delta_data) deleteNested(data.delta_data, path)
    await Promise.resolve(mvu.replaceMvuData(data, scope))
    return
  }
  await writeHelper(scope, (vars) => deleteNested(vars, path))
}

// —— 值类型与展示 —— //

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * MVU 约定的「描述二元组」叶子：[当前值, "描述"]。
 * 判据：长度 2 的数组、第二项是字符串、第一项是原始值（非对象）——避免把真实的二元数据数组误判。
 */
function isTupleLeaf(v: unknown): v is [unknown, string] {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[1] === 'string' &&
    (v[0] === null || typeof v[0] !== 'object')
  )
}

/** 供编辑框预填与叶子展示：字符串原样，对象/数组 JSON 化，其余 String() */
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

/** 解析编辑框输入为实际值：null/true/false/数字/JSON 数组或对象，其余按字符串 */
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

function valueTypeLabel(v: unknown, tuple: boolean): string {
  const inner = tuple ? (v as [unknown, string])[0] : v
  if (inner === null) return 'null'
  if (Array.isArray(inner)) return `数组[${inner.length}]`
  if (typeof inner === 'object') return '对象'
  return typeof inner === 'number' ? '数字' : typeof inner === 'boolean' ? '布尔' : '文本'
}

// —— 页面实例（含 render token 防过期、事件自动刷新） —— //

const EVENT_KEYS = ['MESSAGE_RECEIVED', 'MESSAGE_EDITED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'CHAT_CHANGED']
const EVENT_FALLBACK: Record<string, string> = {
  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_SWIPED: 'message_swiped',
  MESSAGE_DELETED: 'message_deleted',
  CHAT_CHANGED: 'chat_id_changed',
}

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
  let pendingRefresh = false // 编辑期间来了事件 → 结束编辑后补刷
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
    const result = await readVariables({ type: 'message', message_id: messageId })
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
    for (const key of EVENT_KEYS) {
      const name = st?.eventTypes?.[key] ?? EVENT_FALLBACK[key]
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
    const floorText = r.messageId >= 0 ? `楼层 #${r.messageId}` : '无对话'
    status.textContent = `来源：${sourceLabel(r)} · ${floorText}`
    line.append(status)
    const refreshBtn = el('button', 'menu_button vm-refresh')
    refreshBtn.setAttribute('role', 'button')
    refreshBtn.textContent = '刷新'
    refreshBtn.addEventListener('click', () => void load())
    line.append(refreshBtn)
    head.append(line)
    container.append(head)

    if (r.status === 'unavailable') {
      const note = el('div', 'so-app-section')
      const d = el('div', 'so-app-desc')
      d.textContent =
        '未检测到 MVU 框架或酒馆助手（Web 模拟器中仅可查看本说明）。在 SillyTavern 内、且安装了 MVU/酒馆助手时才能读写楼层变量。'
      note.append(d)
      container.append(note)
      return
    }

    if (r.status === 'error') {
      const note = el('div', 'so-app-section')
      const d = el('div', 'so-app-desc')
      d.textContent = `读取变量出错：${r.error ?? '未知错误'}。可点「刷新」重试。`
      note.append(d)
      container.append(note)
    }

    const keys = Object.keys(r.data)
    if (keys.length === 0) {
      const note = el('div', 'so-app-section')
      const d = el('div', 'so-app-desc')
      d.textContent =
        r.status === 'empty'
          ? r.meta.waitedMvu
            ? '当前楼层暂无变量（已等待 MVU 初始化）。有变量的楼层刷新后会显示在这里。'
            : '当前楼层暂无变量。'
          : '当前楼层暂无变量。'
      note.append(d)
      container.append(note)
    } else {
      // 变量树
      const tree = el('div', 'vm-tree')
      for (const key of keys) {
        renderNode(tree, key, r.data[key], key, r.isMvu, 0)
      }
      container.append(tree)
    }

    // 底部：新增变量
    container.append(buildAddSection(r))
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
      // 分组（可折叠）
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

    // 点主体 → 编辑
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

    // 右侧删除
    const del = el('button', 'vm-del')
    del.setAttribute('aria-label', '删除变量')
    del.title = '删除该变量'
    del.textContent = '✕'
    del.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!window.confirm(`删除变量「${path}」？此操作不可撤销。`)) return
      void runWrite(() => deleteFloorVariable(currentScope(), path))
    })

    card.append(main, del)
    parent.append(card)
  }

  function buildEditForm(key: string, value: unknown, path: string, tuple: boolean): HTMLElement {
    const wrap = el('div', 'vm-leaf vm-editing')
    const title = el('div', 'so-app-title vm-edit-title')
    title.textContent = key
    wrap.append(title)

    if (tuple) {
      const desc = el('div', 'vm-desc')
      desc.textContent = `描述：${(value as [unknown, string])[1]}（保留不变，仅编辑值）`
      wrap.append(desc)
    }

    const ta = document.createElement('textarea')
    ta.className = 'text_pole so-app-input vm-edit-input'
    ta.rows = 3
    ta.value = formatValue(tuple ? (value as [unknown, string])[0] : value)
    wrap.append(ta)

    const actions = el('div', 'vm-actions')
    const save = el('button', 'menu_button vm-act')
    save.textContent = '保存'
    save.addEventListener('click', () => {
      const parsed = parseInputValue(ta.value)
      void runWrite(() => setFloorVariable(currentScope(), path, parsed))
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
    // 进入编辑后聚焦
    setTimeout(() => ta.focus(), 0)
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
        void runWrite(() => setFloorVariable(currentScope(), path, parsed))
      }),
    )

    box.append(summary, body)
    return box
  }

  function currentScope(): MvuScope {
    return { type: 'message', message_id: lastResult?.messageId ?? getLastMessageId(getST()) }
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
