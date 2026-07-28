/**
 * 「MVU」App — MVU 楼层变量可视化 / 编辑器（页面实例层）。
 * 视图（树/叶子/编辑/delta 高亮）在共享的 ./variable-tree；
 * Mvu / 酒馆助手 / ST 的全部数据耦合在 ./mvu/bridge（接口面的源码核实说明也在那里）。
 * 本文件只管：render token 防过期、模型组装、写入后的统一重读刷新、事件驱动的自动刷新。
 *
 * 交互纪律：任何写入完成后统一重读刷新，不靠改当前 DOM 制造「看起来成功」。
 * 变化高亮：读当前楼与向前回溯最近有变量的一楼各一份 stat_data，deep-diff（variable-tree.computeDelta）。
 */

import type { PhoneApp, PhoneAppContext } from '../../../core/phone-registry'
import {
  createVariableTreeView,
  computeDelta,
  type DeltaInfo,
  type VariableTreeModel,
  type VariableTreeView,
} from './variable-tree'
import {
  getLastMessageId,
  readVariables,
  findPrevStatRoot,
  setFloorVariable,
  deleteFloorVariable,
  subscribeVarEvents,
  type MvuScope,
  type ReadResult,
} from './mvu/bridge'

// —— 页面实例（render token 防过期 + MVU 精准事件自动刷新） —— //

interface Instance {
  start(): void
  dispose(): void
}

// 数据读写全走 ./mvu/bridge，不经 PhoneAppContext；ctx 保留供将来持久化 UI 偏好
function createInstance(container: HTMLElement, _ctx: PhoneAppContext): Instance {
  let disposed = false
  let seq = 0
  let lastResult: ReadResult | null = null
  let delta: Map<string, DeltaInfo> = new Map()
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let offEvents: (() => void) | null = null

  const view: VariableTreeView = createVariableTreeView(container, {
    getModel: () => buildModel(),
    commitSet: (path, value) => void runWrite(() => setFloorVariable(currentScope(), currentWrapped(), path, value)),
    commitDelete: (path) => void runWrite(() => deleteFloorVariable(currentScope(), currentWrapped(), path)),
    requestRefresh: () => void load(),
  })

  function currentScope(): MvuScope {
    return { type: 'message', message_id: lastResult?.messageId ?? getLastMessageId() }
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
    const messageId = getLastMessageId()
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
      offEvents = subscribeVarEvents(() => scheduleRefresh())
      void load()
    },
    dispose() {
      disposed = true
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = null
      offEvents?.()
      offEvents = null
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
