/**
 * 「MVU」App — MVU 楼层变量可视化 / 编辑器（数据层）。
 * 视图（树/叶子/编辑/delta 高亮）在共享的 ./variable-tree；本文件只管 MVU 数据的读写与事件。
 *
 * 接口面已按 MVU 框架真实源码（reference/MVU/MagVarUpdate-beta/src）核实：
 * - 全局对象 `Mvu` 挂在 window.parent（顶层窗口 parent===window），先 await waitGlobalInitialized('Mvu')。
 * - getMvuData(scope) 同步返回**整包** MvuData：{ stat_data, display_data, delta_data, schema, ... }。
 *   真实变量在 stat_data 子树；display_data/delta_data 已 deprecated，是派生展示数据。
 * - 写入官方路径：getMvuData → 直接改 data.stat_data → await replaceMvuData(data, scope)。
 *   **不用 deprecated 的 setMvuVariable**（要求 path 已存在→不能新增，且不更新 display/delta）。
 * - 删除只动 stat_data；display/delta 由 MVU 每轮重算，无需三处同删。
 * - 精准刷新：监听 MVU 事件 `mag_variable_update_ended`（Mvu.events.VARIABLE_UPDATE_ENDED），
 *   经酒馆助手 eventEmit 路由到 SillyTavern eventSource；文档里的 AFTER_UPDATE 不存在，勿用。
 * - 变化高亮：读当前楼与上一楼各一份 stat_data，deep-diff（见 variable-tree.computeDelta）。
 *
 * 降级：MVU 不可用 → 酒馆助手 getVariables/updateVariablesWith（同样操作 stat_data 子树）。
 *      两者都没有（Web 模拟器）→ 只读提示。
 * 交互纪律：任何写入完成后统一重读刷新，不靠改当前 DOM 制造「看起来成功」。
 */

import type { PhoneApp, PhoneAppContext } from '../../../core/phone-registry'
import {
  createVariableTreeView,
  computeDelta,
  extractStatRootFrom,
  getNested,
  setNested,
  deleteNested,
  isPlainObject,
  isTupleLeaf,
  type DeltaInfo,
  type VariableTreeModel,
  type VariableTreeView,
} from './variable-tree'

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

interface VarSTContext {
  eventSource?: {
    on: (event: string, handler: (...args: unknown[]) => void) => void
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void
  }
  eventTypes?: Record<string, string>
  chat?: Array<unknown>
}

function getMvu(): MvuApi | undefined {
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

// —— 读取通道 —— //

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
  data: Record<string, unknown>
  isMvu: boolean
  wrapped: boolean
  messageId: number
  meta: { source: 'mvu' | 'tavern-helper' | 'none'; waitedMvu: boolean }
  error?: string
}

async function readHelperWrapper(scope: MvuScope): Promise<Record<string, unknown> | null> {
  const helper = getHelper()
  if (typeof helper?.getVariables !== 'function') return null
  const vars = await Promise.resolve(helper.getVariables(scope))
  return vars && typeof vars === 'object' ? vars : {}
}

/** 读某楼层的 stat 根（供 delta 对比；best-effort，失败返回 null） */
async function readStatRootAt(messageId: number): Promise<Record<string, unknown> | null> {
  if (messageId < 0) return null
  const scope: MvuScope = { type: 'message', message_id: messageId }
  try {
    if (isMvuAvailable()) {
      const data = ((await Promise.resolve(getMvu()!.getMvuData!(scope))) as MvuData) ?? {}
      return isPlainObject(data.stat_data) ? data.stat_data : null
    }
    const wrapper = await readHelperWrapper(scope)
    return wrapper ? extractStatRootFrom(wrapper).root : null
  } catch {
    return null
  }
}

/**
 * 从 fromId 向前回溯，找最近一个有变量的楼层（用户楼层通常没有变量，
 * 固定取「上一楼」会让 delta 恒为空）。maxScan 限制回溯范围。
 */
async function findPrevStatRoot(fromId: number, maxScan = 20): Promise<Record<string, unknown> | null> {
  const stop = Math.max(0, fromId - maxScan + 1)
  for (let id = fromId; id >= stop; id--) {
    const root = await readStatRootAt(id)
    if (root && Object.keys(root).length > 0) return root
  }
  return null
}

async function readVariables(scope: MvuScope, messageId: number): Promise<ReadResult> {
  const meta: ReadResult['meta'] = { source: 'none', waitedMvu: false }
  const base = { isMvu: false, wrapped: true, messageId, meta }
  if (messageId < 0) return { status: 'empty', data: {}, ...base }

  if (!isMvuAvailable()) {
    await waitForMvuInitialized(1200)
    meta.waitedMvu = true
  }

  if (isMvuAvailable()) {
    try {
      const { data } = await readMvuDataWithRetry(scope, 1200, 120)
      const stat = data.stat_data ?? {}
      if (Object.keys(stat).length > 0) {
        meta.source = 'mvu'
        return { status: 'ready', data: stat, isMvu: true, wrapped: true, messageId, meta }
      }
      const fb = await readHelperFallback(scope, messageId, meta)
      if (fb) return fb
      return { status: 'empty', data: {}, isMvu: true, wrapped: true, messageId, meta }
    } catch (err) {
      const fb = await readHelperFallback(scope, messageId, meta)
      if (fb) return fb
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

  const wrapper = await readHelperWrapper(scope).catch(() => null)
  if (wrapper) {
    const { root, wrapped } = extractStatRootFrom(wrapper)
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

async function readHelperFallback(
  scope: MvuScope,
  messageId: number,
  meta: ReadResult['meta'],
): Promise<ReadResult | null> {
  const wrapper = await readHelperWrapper(scope).catch(() => null)
  if (!wrapper) return null
  const { root, wrapped } = extractStatRootFrom(wrapper)
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

async function setFloorVariable(scope: MvuScope, wrapped: boolean, path: string, value: unknown): Promise<void> {
  const mvu = getMvu()
  if (isMvuAvailable()) {
    const wrapper = ((await Promise.resolve(mvu!.getMvuData!(scope))) as MvuData) ?? {}
    applySet(wrapper, true, path, value)
    await Promise.resolve(mvu!.replaceMvuData!(wrapper, scope))
    return
  }
  await writeHelper(scope, (vars) => applySet(vars, wrapped, path, value))
}

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

// —— 页面实例（render token 防过期 + MVU 精准事件自动刷新） —— //

interface Instance {
  start(): void
  dispose(): void
}

// 直接访问全局 MVU/酒馆助手/ST context，不经 PhoneAppContext；ctx 保留供将来持久化 UI 偏好
function createInstance(container: HTMLElement, _ctx: PhoneAppContext): Instance {
  let disposed = false
  let seq = 0
  let lastResult: ReadResult | null = null
  let delta: Map<string, DeltaInfo> = new Map()
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  const unsubs: Array<() => void> = []

  const view: VariableTreeView = createVariableTreeView(container, {
    getModel: () => buildModel(),
    commitSet: (path, value) => void runWrite(() => setFloorVariable(currentScope(), currentWrapped(), path, value)),
    commitDelete: (path) => void runWrite(() => deleteFloorVariable(currentScope(), currentWrapped(), path)),
    requestRefresh: () => void load(),
  })

  function currentScope(): MvuScope {
    return { type: 'message', message_id: lastResult?.messageId ?? getLastMessageId(getST()) }
  }
  function currentWrapped(): boolean {
    return lastResult?.wrapped ?? true
  }

  function sourceLabel(r: ReadResult): string {
    if (r.meta.source === 'mvu') return 'MVU'
    if (r.meta.source === 'tavern-helper') return '酒馆助手'
    return '—'
  }

  function buildModel(): VariableTreeModel {
    const r = lastResult
    if (!r) {
      return {
        data: {},
        isMvu: true,
        delta: new Map(),
        status: 'empty',
        statusText: '正在读取…',
        emptyText: '正在读取楼层变量…',
        canWrite: false,
        addHint: '',
      }
    }
    const canWrite = r.status !== 'unavailable'
    let noticeText: string | undefined
    if (r.status === 'unavailable') {
      noticeText =
        '未检测到 MVU 框架或酒馆助手（Web 模拟器中仅可查看本说明）。在 SillyTavern 内、且安装了 MVU/酒馆助手时才能读写楼层变量。'
    } else if (r.status === 'error') {
      noticeText = `读取变量出错：${r.error ?? '未知错误'}。可点「刷新」重试。`
    }
    return {
      data: r.data,
      isMvu: r.isMvu,
      delta,
      status: r.status,
      statusText: `来源：${sourceLabel(r)} · ${r.messageId >= 0 ? `楼层 #${r.messageId}` : '无对话'}`,
      emptyText:
        r.status === 'empty' && r.meta.waitedMvu
          ? '当前楼层暂无变量（已等待 MVU 初始化）。有变量的楼层刷新后会显示在这里。'
          : '当前楼层暂无变量。',
      noticeText,
      canWrite,
      addHint: canWrite
        ? '正常情况下变量由 MVU 框架按角色卡规则维护，无需手动新增；这里仅用于修补卡片缺失的变量或调试（卡的更新规则里没有的路径，AI 不会主动维护）。路径点号分层，值支持 数字/true/false/null/JSON/文本。'
        : '当前环境不可写入变量。',
    }
  }

  function isStale(token: number): boolean {
    return disposed || token !== seq || !container.isConnected
  }

  async function load(): Promise<void> {
    const token = ++seq
    view.resetEditing()
    if (!lastResult) view.render() // 首次显示「正在读取」
    const st = getST()
    const messageId = getLastMessageId(st)
    const result = await readVariables({ type: 'message', message_id: messageId }, messageId)
    if (isStale(token)) return
    // 变化高亮：向前回溯最近一个有变量的楼层做 deep-diff（best-effort）
    let nextDelta = new Map<string, DeltaInfo>()
    if (result.status === 'ready' && messageId > 0) {
      const prev = await findPrevStatRoot(messageId - 1)
      if (isStale(token)) return
      nextDelta = computeDelta(result.data, prev, result.isMvu)
    }
    lastResult = result
    delta = nextDelta
    view.render()
  }

  function scheduleRefresh(): void {
    if (disposed || view.isEditing()) return // 编辑期间不打断用户输入
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      if (!disposed && !view.isEditing()) void load()
    }, 300)
  }

  function subscribeEvents(): void {
    const st = getST()
    const es = st?.eventSource
    if (!es) return
    const mvu = getMvu()
    const names = new Set<string>([
      mvu?.events?.VARIABLE_UPDATE_ENDED ?? 'mag_variable_update_ended',
      mvu?.events?.VARIABLE_INITIALIZED ?? 'mag_variable_initialized',
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

export function mvuApp(): PhoneApp {
  let inst: Instance | null = null
  return {
    id: 'mvu',
    name: 'MVU',
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
