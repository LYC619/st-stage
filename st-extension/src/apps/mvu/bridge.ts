/**
 * 「MVU」App 的数据交互层：Mvu / 酒馆助手 / ST 全局的全部耦合收敛在此，UI 层不碰。
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
 *
 * 降级：MVU 不可用 → 酒馆助手 getVariables/updateVariablesWith（同样操作 stat_data 子树）。
 *      两者都没有（Web 模拟器）→ readVariables 返回 unavailable。
 */

import { extractStatRootFrom, getNested, setNested, deleteNested, isPlainObject, isTupleLeaf } from '../variable-tree'

// —— MVU / 酒馆助手 / ST 全局运行时类型（字段随版本可能缺失，全部可选） —— //

export interface MvuScope {
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

export function getLastMessageId(): number {
  const helper = getHelper()
  if (typeof helper?.getLastMessageId === 'function') {
    try {
      const id = helper.getLastMessageId()
      if (Number.isInteger(id) && id >= 0) return id
    } catch {
      // 忽略，走 chat 回退
    }
  }
  const chat = getST()?.chat
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

export type ReadStatus = 'ready' | 'empty' | 'error' | 'unavailable'

export interface ReadResult {
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
export async function findPrevStatRoot(fromId: number, maxScan = 20): Promise<Record<string, unknown> | null> {
  const stop = Math.max(0, fromId - maxScan + 1)
  for (let id = fromId; id >= stop; id--) {
    const root = await readStatRootAt(id)
    if (root && Object.keys(root).length > 0) return root
  }
  return null
}

export async function readVariables(scope: MvuScope, messageId: number): Promise<ReadResult> {
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

export async function setFloorVariable(scope: MvuScope, wrapped: boolean, path: string, value: unknown): Promise<void> {
  const mvu = getMvu()
  if (isMvuAvailable()) {
    const wrapper = ((await Promise.resolve(mvu!.getMvuData!(scope))) as MvuData) ?? {}
    applySet(wrapper, true, path, value)
    await Promise.resolve(mvu!.replaceMvuData!(wrapper, scope))
    return
  }
  await writeHelper(scope, (vars) => applySet(vars, wrapped, path, value))
}

export async function deleteFloorVariable(scope: MvuScope, wrapped: boolean, path: string): Promise<void> {
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

// —— 事件订阅 —— //

/**
 * 订阅「楼层变量可能变了」的全部事件（MVU 更新结束/初始化 + 切换对话/swipe/删楼），
 * 返回合并退订函数。无 ST eventSource（模拟器/旧版）返回空退订。
 */
export function subscribeVarEvents(handler: () => void): () => void {
  const st = getST()
  const es = st?.eventSource
  if (!es) return () => {}
  const mvu = getMvu()
  const names = new Set<string>([
    mvu?.events?.VARIABLE_UPDATE_ENDED ?? 'mag_variable_update_ended',
    mvu?.events?.VARIABLE_INITIALIZED ?? 'mag_variable_initialized',
    st?.eventTypes?.CHAT_CHANGED ?? 'chat_id_changed',
    st?.eventTypes?.MESSAGE_SWIPED ?? 'message_swiped',
    st?.eventTypes?.MESSAGE_DELETED ?? 'message_deleted',
  ])
  const offs: Array<() => void> = []
  for (const name of names) {
    if (!name) continue
    const h = () => handler()
    es.on(name, h)
    offs.push(() => {
      try {
        es.removeListener(name, h)
      } catch {
        // 退订失败不阻塞
      }
    })
  }
  return () => {
    for (const off of offs) off()
  }
}
