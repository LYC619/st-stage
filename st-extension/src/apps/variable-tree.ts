/**
 * 共享变量树视图（两个 App 复用）：把一个嵌套变量对象渲染成可折叠分组 + 叶子卡片，
 * 支持类型感知内联编辑、删除、新增，以及相邻状态 deep-diff 的变化高亮（绿涨红跌）。
 *
 * 设计：视图只认「模型 + 回调」，不认数据来源。
 * - 「MVU」App 的数据层来自 window.Mvu；「新变量」App 的数据层来自自建解析器。
 *   两者各写一个数据层，构造 VariableTreeModel 喂给本视图即可。
 * - 视图内部持有 editingPath（纯 UI 态）；数据层每次重读后调 view.resetEditing() + view.render()。
 * - 写入是「发射即忘」：视图调 handlers.commitSet/commitDelete，由数据层负责写入 + 重读 + 重渲染。
 *
 * 安全：所有键/值一律 textContent，绝不拼 innerHTML。
 */

import { el, appButton } from './widgets'
import { splitPath, getNested, setNested, deleteNested } from './path-utils'

// 路径工具从 path-utils 引入并转出，历史依赖方（mvu-app 等）仍从本模块导入
export { splitPath, getNested, setNested, deleteNested }

// —— 通用值判定（两 App 共用） —— //

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * 描述二元组叶子 [值, "描述"]（MVU 的 ValueWithDescription）。
 * 判据对齐 MVU 源码 + 降误判规则：长度 2、第二项字符串、第一项不是数组。本质歧义，保守判定。
 */
export function isTupleLeaf(v: unknown): v is [unknown, string] {
  return Array.isArray(v) && v.length === 2 && typeof v[1] === 'string' && !Array.isArray(v[0])
}

/** 把 message 变量包归一化到「变量根」：有 stat_data 子树就用它（MVU 结构），否则视为扁平 */
export function extractStatRootFrom(wrapper: Record<string, unknown>): {
  root: Record<string, unknown>
  wrapped: boolean
} {
  if (isPlainObject(wrapper.stat_data)) return { root: wrapper.stat_data, wrapped: true }
  return { root: wrapper, wrapped: false }
}

// —— 值展示与编辑控件 —— //

/** 供叶子展示与 JSON 编辑预填：字符串原样，对象/数组 JSON 化，其余 String() */
export function formatValue(v: unknown): string {
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
export function parseInputValue(raw: string): unknown {
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

function editKind(v: unknown): EditKind {
  if (typeof v === 'boolean') return 'boolean'
  if (v !== null && typeof v === 'object') return 'json'
  return 'text'
}

export function valueTypeLabel(v: unknown, tuple: boolean): string {
  const inner = tuple ? (v as [unknown, string])[0] : v
  if (inner === null) return 'null'
  if (Array.isArray(inner)) return `数组[${inner.length}]`
  if (typeof inner === 'object') return '对象'
  return typeof inner === 'number' ? '数字' : typeof inner === 'boolean' ? '布尔' : '文本'
}

// —— 变化高亮（相邻状态 deep-diff） —— //

export interface DeltaInfo {
  kind: 'inc' | 'dec' | 'changed' | 'added'
  diff?: number
}

function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * 对比 current 与 prev 两份变量对象，产出「路径 → 变化」映射，供叶子徽标显示。
 * 数值变化给增量；其余值变化给 changed；prev 中不存在给 added。prev 为 null 则无高亮。
 */
export function computeDelta(
  current: Record<string, unknown>,
  prev: Record<string, unknown> | null,
  isMvu: boolean,
): Map<string, DeltaInfo> {
  const delta = new Map<string, DeltaInfo>()
  if (!prev) return delta
  const walk = (obj: Record<string, unknown>, prefix: string): void => {
    for (const key of Object.keys(obj)) {
      const val = obj[key]
      const path = prefix ? `${prefix}.${key}` : key
      const tuple = isMvu && isTupleLeaf(val)
      if (!tuple && isPlainObject(val) && Object.keys(val).length > 0) {
        walk(val, path)
        continue
      }
      const curLeaf = tuple ? (val as [unknown, string])[0] : val
      const prevRaw = getNested(prev, path)
      if (prevRaw === undefined) {
        delta.set(path, { kind: 'added' })
        continue
      }
      const prevLeaf = isMvu && isTupleLeaf(prevRaw) ? prevRaw[0] : prevRaw
      if (typeof curLeaf === 'number' && typeof prevLeaf === 'number') {
        if (curLeaf !== prevLeaf) delta.set(path, { kind: curLeaf > prevLeaf ? 'inc' : 'dec', diff: curLeaf - prevLeaf })
      } else if (!jsonEqual(curLeaf, prevLeaf)) {
        delta.set(path, { kind: 'changed' })
      }
    }
  }
  walk(current, '')
  return delta
}

// —— 视图模型 + 回调契约 —— //

export interface VariableTreeModel {
  /** 归一化后的变量根对象（要展示/编辑的嵌套结构） */
  data: Record<string, unknown>
  /** 是否把 [值,"描述"] 当描述二元组（MVU 语义）；「新变量」传 false */
  isMvu: boolean
  /** 变化高亮映射（computeDelta 产出） */
  delta: Map<string, DeltaInfo>
  status: 'ready' | 'empty' | 'error' | 'unavailable'
  /** 顶栏状态文案，如「来源：MVU · 楼层 #5」 */
  statusText: string
  /** 数据为空时的说明 */
  emptyText: string
  /** unavailable/error 时的整段提示（有则覆盖树，只显示它） */
  noticeText?: string
  /** 是否允许写入（Web 模拟器等环境为 false） */
  canWrite: boolean
  /** 新增区提示文案 */
  addHint: string
}

export interface VariableTreeHandlers {
  getModel(): VariableTreeModel
  /** 提交「改/增」：发射即忘，数据层负责写入 + 重读 + 重渲染 */
  commitSet(path: string, value: unknown): void
  commitDelete(path: string): void
  requestRefresh(): void
}

export interface VariableTreeView {
  render(): void
  /** 数据层每次重读后调用，清掉编辑态 */
  resetEditing(): void
  /** 是否正处于某个叶子的编辑态（数据层据此在编辑期间跳过自动刷新，避免打断输入） */
  isEditing(): boolean
}

export function createVariableTreeView(container: HTMLElement, handlers: VariableTreeHandlers): VariableTreeView {
  let editingPath: string | null = null
  // 分组展开状态跨渲染保留（进入编辑/自动刷新会整树重渲染，不记就会折叠回默认——用户实测反馈）
  const groupOpen = new Map<string, boolean>()
  let addOpen = false

  function render(): void {
    const model = handlers.getModel()
    container.textContent = ''

    // 顶栏：状态 + 刷新
    const head = el('div', 'so-app-section vm-head')
    const line = el('div', 'vm-statusrow')
    const status = el('div', 'so-app-desc vm-status')
    status.textContent = model.statusText
    const refreshBtn = el('button', 'menu_button vm-refresh')
    refreshBtn.setAttribute('role', 'button')
    refreshBtn.textContent = '刷新'
    refreshBtn.addEventListener('click', () => handlers.requestRefresh())
    line.append(status, refreshBtn)
    head.append(line)
    container.append(head)

    if (model.noticeText) {
      appendNotice(model.noticeText)
      if (model.status === 'unavailable') return
    }

    const keys = Object.keys(model.data)
    if (keys.length === 0) {
      appendNotice(model.emptyText)
    } else {
      const tree = el('div', 'vm-tree')
      for (const key of keys) renderNode(model, tree, key, model.data[key], key, 0)
      container.append(tree)
    }

    container.append(buildAddSection(model))
  }

  function appendNotice(text: string): void {
    const note = el('div', 'so-app-section')
    const d = el('div', 'so-app-desc')
    d.textContent = text
    note.append(d)
    container.append(note)
  }

  function renderNode(
    model: VariableTreeModel,
    parent: HTMLElement,
    key: string,
    value: unknown,
    path: string,
    depth: number,
  ): void {
    const tuple = model.isMvu && isTupleLeaf(value)
    if (!tuple && isPlainObject(value) && Object.keys(value).length > 0) {
      const details = document.createElement('details')
      details.className = 'so-app-fold vm-group'
      details.open = groupOpen.get(path) ?? depth < 1
      // toggle 只在用户点击后触发（插入前赋值不触发），记录真实操作
      details.addEventListener('toggle', () => groupOpen.set(path, details.open))
      const summary = document.createElement('summary')
      summary.className = 'so-app-title vm-group-title'
      summary.textContent = `${key}（${Object.keys(value).length}）`
      const body = el('div', 'so-app-fold-body vm-group-body')
      for (const childKey of Object.keys(value)) {
        renderNode(model, body, childKey, (value as Record<string, unknown>)[childKey], `${path}.${childKey}`, depth + 1)
      }
      details.append(summary, body)
      parent.append(details)
      return
    }
    renderLeaf(model, parent, key, value, path, tuple)
  }

  function renderLeaf(
    model: VariableTreeModel,
    parent: HTMLElement,
    key: string,
    value: unknown,
    path: string,
    tuple: boolean,
  ): void {
    if (editingPath === path) {
      parent.append(buildEditForm(model, key, value, path, tuple))
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

    const d = model.delta.get(path)
    if (d) main.append(buildDeltaBadge(d))

    if (tuple) {
      const desc = el('div', 'vm-desc')
      desc.textContent = (value as [unknown, string])[1]
      main.append(desc)
    }

    if (model.canWrite) {
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
    }

    card.append(main)

    if (model.canWrite) {
      const del = el('button', 'vm-del')
      del.setAttribute('aria-label', '删除变量')
      del.title = '删除该变量'
      del.textContent = '✕'
      del.addEventListener('click', (e) => {
        e.stopPropagation()
        if (!window.confirm(`删除变量「${path}」？此操作不可撤销。`)) return
        editingPath = null
        handlers.commitDelete(path)
      })
      card.append(del)
    }

    parent.append(card)
  }

  function buildDeltaBadge(d: DeltaInfo): HTMLElement {
    const badge = el('span', `vm-badge vm-badge-${d.kind}`)
    if (d.kind === 'inc' || d.kind === 'dec') {
      const n = d.diff ?? 0
      // 浮点差值舍到两位，避免 0.1+0.2 类的长尾（+0.30000000000000004）
      const shown = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
      badge.textContent = `${n > 0 ? '+' : ''}${shown}`
    } else {
      badge.textContent = d.kind === 'added' ? '新' : '改'
    }
    return badge
  }

  function buildEditForm(
    model: VariableTreeModel,
    key: string,
    value: unknown,
    path: string,
    tuple: boolean,
  ): HTMLElement {
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
      editingPath = null
      handlers.commitSet(path, r.value)
    })
    const cancel = el('button', 'menu_button vm-act vm-act-ghost')
    cancel.textContent = '取消'
    cancel.addEventListener('click', () => {
      editingPath = null
      render()
    })
    actions.append(save, cancel)
    wrap.append(actions)
    return wrap
  }

  function buildAddSection(model: VariableTreeModel): HTMLElement {
    const box = document.createElement('details')
    box.className = 'so-app-fold so-app-section'
    box.open = addOpen
    box.addEventListener('toggle', () => (addOpen = box.open))
    const summary = document.createElement('summary')
    summary.className = 'so-app-title'
    summary.textContent = '＋ 新增变量'
    const body = el('div', 'so-app-fold-body')

    const hint = el('div', 'so-app-desc')
    hint.textContent = model.addHint
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
        if (!model.canWrite) {
          err.textContent = '当前环境不可写入变量。'
          err.hidden = false
          return
        }
        handlers.commitSet(path, parseInputValue(valInput.value))
      }),
    )

    box.append(summary, body)
    return box
  }

  return {
    render,
    resetEditing() {
      editingPath = null
    },
    isEditing() {
      return editingPath !== null
    },
  }
}
