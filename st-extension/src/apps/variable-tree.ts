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

import { t } from '../../../core/i18n'
import { captureVariableFocus, variableButton } from './newvar/ui-focus'

import { el, appButton } from './widgets'
import { splitPath, getNested, setNested, deleteNested } from './path-utils'

// 路径工具从 path-utils 引入并转出，历史依赖方（mvu-app 等）仍从本模块导入
export { splitPath, getNested, setNested, deleteNested }

import {
  computeDelta,
  editKind,
  extractStatRootFrom,
  formatValue,
  isPlainObject,
  isTupleLeaf,
  parseInputValue,
  valueTypeLabel,
  type DeltaInfo,
  type VariableEditDefinition,
  type VariableTreeCommitResult,
} from './variable-delta'

export {
  computeDelta,
  extractStatRootFrom,
  formatValue,
  isPlainObject,
  isTupleLeaf,
  parseInputValue,
  valueTypeLabel,
  type DeltaInfo,
  type VariableEditDefinition,
  type VariableTreeCommitResult,
}
// —— 视图模型 + 回调契约 —— //

export interface VariableTreeModel {
  /** 归一化后的变量根对象（要展示/编辑的嵌套结构） */
  data: Record<string, unknown>
  /** 可选叶子定义；提供后使用定义驱动的编辑控件，新变量 App 使用 */
  definitions?: VariableEditDefinition[]
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
  /** 是否显示手动新增区；默认显示 */
  allowAdd?: boolean
  /** 新增区提示文案 */
  addHint: string
}

export interface VariableTreeHandlers {
  getModel(): VariableTreeModel
  /** 提交「改/增」：发射即忘，数据层负责写入 + 重读 + 重渲染 */
  commitSet(path: string, value: unknown): void | VariableTreeCommitResult
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
  let focusRequest: { path: string; editor?: HTMLElement } | null = null
  // 分组展开状态跨渲染保留（进入编辑/自动刷新会整树重渲染，不记就会折叠回默认——用户实测反馈）
  const groupOpen = new Map<string, boolean>()
  let addOpen = false

  function render(): void {
    const model = handlers.getModel()
    const restore = captureVariableFocus(container)
    // A write may finish after the user has moved elsewhere. Resolve ownership
    // before removing the old editor, which would itself move focus to body.
    const request = focusRequest
    focusRequest = null
    const active = document.activeElement
    const focusPath = request && (!request.editor || request.editor.contains(active)
      || (!request.editor.isConnected && active === document.body)) ? request.path : null
    container.textContent = ''

    // 顶栏：状态 + 刷新
    const head = el('div', 'so-app-section vm-head')
    const line = el('div', 'vm-statusrow')
    const status = el('div', 'so-app-desc vm-status')
    status.setAttribute('role', 'status')
    status.textContent = model.statusText
    const refreshBtn = variableButton('menu_button vm-refresh')
    refreshBtn.setAttribute('role', 'button')
    refreshBtn.textContent = t('variableTree.refresh', "刷新")
    refreshBtn.dataset.variableFocus = 'refresh'
    refreshBtn.addEventListener('click', () => handlers.requestRefresh())
    line.append(status, refreshBtn)
    head.append(line)
    container.append(head)

    if (model.noticeText) {
      appendNotice(model.noticeText)
      if (model.status === 'unavailable') {
        restore?.()
        return
      }
    }

    const keys = Object.keys(model.data)
    if (keys.length === 0) {
      appendNotice(model.emptyText)
    } else {
      const tree = el('div', 'vm-tree')
      for (const key of keys) renderNode(model, tree, key, model.data[key], key, 0)
      container.append(tree)
    }

    if (model.allowAdd !== false) container.append(buildAddSection(model))
    if (focusPath !== null) {
      const target = editingPath === focusPath
        ? container.querySelector<HTMLElement>('.vm-editing input, .vm-editing select, .vm-editing textarea')
        : [...container.querySelectorAll<HTMLElement>('.vm-leaf-main')]
          .find(node => node.dataset.variableFocus === `leaf:${focusPath}`)
      if (target) target.focus({ preventScroll: true })
      else restore?.()
    } else restore?.()
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
      summary.dataset.variableFocus = `group:${path}`
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
    main.dataset.variableFocus = `leaf:${path}`
    const keyEl = el('span', 'vm-key')
    keyEl.textContent = key
    const valEl = el('span', 'vm-val')
    const shown = formatValue(tuple ? (value as [unknown, string])[0] : value)
    valEl.textContent = shown.length > 80 ? `${shown.slice(0, 80)}…` : shown
    valEl.title = t('variableTree.type', "类型：{{type}}", { type: valueTypeLabel(value, tuple) })
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
        focusRequest = { path }
        render()
      }
      main.addEventListener('click', enterEdit)
      main.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          enterEdit()
        }
      })
    }

    card.append(main)

    if (model.canWrite) {
      const del = variableButton('vm-del')
      del.setAttribute('aria-label', t('variableTree.delete_path', '删除变量 {{path}}', { path }))
      del.dataset.variableFocus = `delete:${path}`
      del.title = t('variableTree.delete_title', "删除该变量")
      del.textContent = '✕'
      del.addEventListener('click', (e) => {
        e.stopPropagation()
        if (!window.confirm(t('variableTree.delete_confirm', "删除变量「{{path}}」？此操作不可撤销。", { path }))) return
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
      badge.textContent = d.kind === 'added' ? t('variableTree.added', "新") : t('variableTree.changed', "改")
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
    const definition = model.definitions?.find((item) => item.key === path)
    const kind = editKind(inner, definition)
    const wrap = el('div', 'vm-leaf vm-editing')

    const title = el('div', 'so-app-title vm-edit-title')
    title.textContent = `${key} · ${valueTypeLabel(value, tuple)}`
    wrap.append(title)
    if (tuple) {
      const desc = el('div', 'vm-desc')
      desc.textContent = t('variableTree.description', "描述：{{description}}（保留不变，仅编辑值）", { description: (value as [unknown, string])[1] })
      wrap.append(desc)
    }

    const err = el('div', 'so-app-desc vm-add-err')
    err.hidden = true
    err.setAttribute('role', 'alert')

    let readValue: () => { ok: boolean; value?: unknown; msg?: string }
    if (kind === 'boolean') {
      const row = el('label', 'so-app-toggle checkbox_label')
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.checked = inner === true
      const label = document.createElement('span')
      label.textContent = t('variableTree.true', "启用（true）")
      row.append(input, label)
      wrap.append(row)
      readValue = () => ({ ok: true, value: input.checked })
    } else if (kind === 'enum') {
      const select = document.createElement('select')
      select.className = 'text_pole so-app-input vm-edit-input'
      for (const value of definition?.enum ?? []) {
        const option = document.createElement('option')
        option.value = value
        option.textContent = value
        option.selected = value === inner
        select.append(option)
      }
      wrap.append(select)
      readValue = () => ({ ok: true, value: select.value })
    } else if (kind === 'number') {
      const input = document.createElement('input')
      input.type = 'number'
      input.step = 'any'
      input.className = 'text_pole so-app-input vm-edit-input'
      input.value = typeof inner === 'number' && Number.isFinite(inner) ? String(inner) : ''
      if (definition?.range) {
        input.min = String(definition.range[0])
        input.max = String(definition.range[1])
      }
      wrap.append(input)
      readValue = () => {
        if (input.value.trim() === '') return { ok: false, msg: t('variableTree.invalid_number', "请输入有效数字。") }
        const value = Number(input.value)
        return Number.isFinite(value) ? { ok: true, value } : { ok: false, msg: t('variableTree.invalid_number', "请输入有效数字。") }
      }
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
          return { ok: false, msg: t('variableTree.json_error', "JSON 格式错误：{{error}}", { error: e instanceof Error ? e.message : String(e) }) }
        }
      }
    } else {
      const input = document.createElement('input')
      input.type = 'text'
      input.className = 'text_pole so-app-input vm-edit-input'
      input.value = formatValue(inner)
      input.autocomplete = 'off'
      wrap.append(input)
      readValue = () => ({ ok: true, value: definition?.type === 'string' ? input.value : parseInputValue(input.value) })
    }
    const input = wrap.querySelector<HTMLElement>('input, select, textarea')
    input?.setAttribute('aria-label', t('variableTree.edit_value', '编辑 {{path}} 的值', { path }))
    if (input) input.dataset.variableFocus = `value:${path}`
    wrap.append(err)

    const actions = el('div', 'vm-actions')
    const save = variableButton('menu_button vm-act')
    save.textContent = t('variableTree.save', "保存")
    save.dataset.variableFocus = `save:${path}`
    save.addEventListener('click', () => {
      const r = readValue()
      if (!r.ok) {
        err.textContent = r.msg ?? t('variableTree.invalid', "输入无效。")
        err.hidden = false
        return
      }
      editingPath = null
      focusRequest = { path, editor: wrap }
      const committed = handlers.commitSet(path, r.value)
      if (committed && !committed.ok) {
        editingPath = path
        focusRequest = null
        err.textContent = committed.error
        err.hidden = false
      }
    })
    const cancel = variableButton('menu_button vm-act vm-act-ghost')
    cancel.textContent = t('variableTree.cancel', "取消")
    cancel.dataset.variableFocus = `cancel:${path}`
    cancel.addEventListener('click', () => {
      editingPath = null
      focusRequest = { path }
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
    summary.textContent = t('variableTree.add_variable', "＋ 新增变量")
    summary.dataset.variableFocus = 'add-section'
    const body = el('div', 'so-app-fold-body')

    const hint = el('div', 'so-app-desc')
    hint.textContent = model.addHint
    body.append(hint)

    const pathInput = document.createElement('input')
    pathInput.type = 'text'
    pathInput.className = 'text_pole so-app-input'
    pathInput.placeholder = t('variableTree.path_placeholder', "变量路径（如 状态.体力）")
    pathInput.setAttribute('aria-label', t('variableTree.path', '变量路径'))
    pathInput.dataset.variableFocus = 'new-path'
    pathInput.autocomplete = 'off'
    const valInput = document.createElement('input')
    valInput.type = 'text'
    valInput.className = 'text_pole so-app-input'
    valInput.placeholder = t('variableTree.value_placeholder', "值（如 80 / 健康 / true）")
    valInput.setAttribute('aria-label', t('variableTree.value', '变量值'))
    valInput.dataset.variableFocus = 'new-value'
    valInput.autocomplete = 'off'
    body.append(pathInput, valInput)

    const err = el('div', 'so-app-desc vm-add-err')
    err.hidden = true
    err.setAttribute('role', 'alert')
    body.append(err)

    body.append(
      appButton(t('variableTree.add', "添加"), () => {
        const path = pathInput.value.trim()
        if (!path) {
          err.textContent = t('variableTree.path_required', "请填写变量路径。")
          err.hidden = false
          return
        }
        if (!model.canWrite) {
          err.textContent = t('variableTree.cannot_write', "当前环境不可写入变量。")
          err.hidden = false
          return
        }
        const committed = handlers.commitSet(path, parseInputValue(valInput.value))
        if (committed && !committed.ok) {
          err.textContent = committed.error
          err.hidden = false
        }
      }),
    )

    box.append(summary, body)
    return box
  }

  return {
    render,
    resetEditing() {
      if (editingPath && container.contains(document.activeElement)) {
        focusRequest = { path: editingPath, editor: container.querySelector<HTMLElement>('.vm-editing') ?? undefined }
      }
      editingPath = null
    },
    isEditing() {
      return editingPath !== null
    },
  }
}
