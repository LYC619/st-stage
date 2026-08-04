/**
 * 「变量设计」全屏弹窗（复用图库管理的 so-manager 样式体系）：
 * - 模板库：内置四套 + 用户自定义模板，卡片网格布局（PC 一行多张，窄屏自动单列）；
 *   「替换/追加」导入；可把当前定义保存为自定义模板（换卡复用）、删除自定义模板
 * - 变量定义：PC 双栏（左列表 / 右编辑表单，点谁编辑谁），窄屏自动上下堆叠 + 滚动到表单；
 *   字段：路径/类型/默认值/描述/范围/枚举/更新规则(check)/对 AI 隐藏
 * - 生成设置（输出格式/注入深度）、注入预览、解析日志
 *
 * 设计弹窗而非手机屏内编辑（用户实测反馈）：设计变量时不需要读正文，全屏表单对新手友好。
 * 布局全部走响应式 CSS（.nv-* @media），同一份 DOM 兼容 PC 与移动端。
 */

import { el, appButton, toggleRow, selectRow, numberRow, textRow, textareaRow, foldSection } from '../widgets'
import { formatValue } from '../variable-tree'
import { isSafePath } from '../path-utils'
import type { NewvarData, CustomTemplate } from './config'
import type { ParseReport } from './runtime'
import type { VariableDefinition, VarType } from './types'
import { NEWVAR_TEMPLATES, type NewvarTemplate } from './templates'

export interface NewvarDesignerDeps {
  getData(): NewvarData
  /** 持久化配置（外部负责 saveSettingsOnly + runtime.onConfigChanged） */
  setData(next: NewvarData): void
  buildPreview(): string
  getLastParse(): ParseReport | null
  /** 弹窗关闭后回调（入口用它重新展开手机并回「新变量」页） */
  onClosed?: () => void
}

export interface NewvarDesigner {
  open(): void
  close(): void
  isOpen(): boolean
}

/** 编辑表单草稿（全部按文本暂存，保存时按类型解析） */
interface DefDraft {
  key: string
  type: VarType
  defaultText: string
  description: string
  rangeText: string
  enumText: string
  updateRule: string
  hidden: boolean
}

const TYPE_LABELS: Record<VarType, string> = { number: '数字', string: '文本', boolean: '布尔', enum: '枚举' }

function draftFromDef(def: VariableDefinition): DefDraft {
  return {
    key: def.key,
    type: def.type,
    defaultText: formatValue(def.default),
    description: def.description,
    rangeText: def.range ? `${def.range[0]}~${def.range[1]}` : '',
    enumText: (def.enum ?? []).join(', '),
    updateRule: def.updateRule ?? '',
    hidden: def.hidden === true,
  }
}

function emptyDraft(): DefDraft {
  return {
    key: '',
    type: 'number',
    defaultText: '0',
    description: '',
    rangeText: '',
    enumText: '',
    updateRule: '',
    hidden: false,
  }
}

/** 草稿 → 定义；失败返回错误消息 */
function draftToDef(draft: DefDraft): { def?: VariableDefinition; error?: string } {
  const key = draft.key.trim()
  if (!key) return { error: '请填写变量路径。' }
  if (!isSafePath(key)) return { error: '变量路径不能包含 __proto__、prototype 或 constructor。' }
  const def: VariableDefinition = { key, type: draft.type, default: undefined, description: draft.description.trim() }
  if (draft.hidden) def.hidden = true
  if (draft.updateRule.trim()) def.updateRule = draft.updateRule.trim()

  if (draft.type === 'number') {
    const range = parseRange(draft.rangeText)
    if (range === false) return { error: '范围格式应为「最小~最大」，如 0~100。' }
    if (range) def.range = range
    const n = Number(draft.defaultText.trim())
    let dflt = Number.isFinite(n) ? n : 0
    if (def.range) dflt = Math.min(def.range[1], Math.max(def.range[0], dflt))
    def.default = dflt
  } else if (draft.type === 'boolean') {
    def.default = draft.defaultText.trim() === 'true'
  } else if (draft.type === 'enum') {
    const options = draft.enumText
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter((s) => s !== '')
    if (options.length === 0) return { error: '枚举类型至少需要一个选项（逗号分隔）。' }
    def.enum = options
    def.default = options.includes(draft.defaultText.trim()) ? draft.defaultText.trim() : options[0]
  } else {
    def.default = draft.defaultText
  }
  return { def }
}

/** 深拷贝模板定义（JSON 足够：定义可序列化；避开老移动端没有的 structuredClone） */
function cloneDefs(defs: VariableDefinition[]): VariableDefinition[] {
  return JSON.parse(JSON.stringify(defs)) as VariableDefinition[]
}

/** "0~100" → [0,100]；空串 → null；非法 → false */
function parseRange(text: string): [number, number] | null | false {
  const t = text.trim()
  if (!t) return null
  const m = /^(-?\d+(?:\.\d+)?)\s*~\s*(-?\d+(?:\.\d+)?)$/.exec(t)
  if (!m) return false
  const min = Number(m[1])
  const max = Number(m[2])
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return false
  return [min, max]
}

export function createNewvarDesigner(deps: NewvarDesignerDeps): NewvarDesigner {
  let backdrop: HTMLElement | null = null
  let body: HTMLElement | null = null
  let formDraft: DefDraft | null = null
  let editingIndex: number | null = null
  /** 本次渲染后把编辑表单滚进视野（窄屏堆叠布局下点列表要能看到表单） */
  let scrollToEditor = false

  function applyBackdropSize(): void {
    if (!backdrop) return
    backdrop.style.left = '0'
    backdrop.style.top = '0'
    backdrop.style.width = `${window.innerWidth}px`
    backdrop.style.height = `${window.innerHeight}px`
  }

  function onEscape(e: KeyboardEvent): void {
    if (e.key === 'Escape') close()
  }

  function open(): void {
    if (backdrop) {
      render()
      return
    }
    formDraft = null
    editingIndex = null
    backdrop = el('div', 'so-manager-backdrop')
    document.addEventListener('keydown', onEscape)
    window.addEventListener('resize', applyBackdropSize)
    applyBackdropSize()

    const dialog = el('div', 'so-manager')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-label', '变量设计')

    const header = el('div', 'so-manager-header')
    const title = el('div', 'so-manager-title')
    title.textContent = '变量设计'
    const closeBtn = el('div', 'menu_button so-manager-close')
    closeBtn.textContent = '✕'
    closeBtn.title = '关闭'
    closeBtn.setAttribute('role', 'button')
    closeBtn.tabIndex = 0
    closeBtn.addEventListener('click', close)
    closeBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        close()
      }
    })
    header.append(title, closeBtn)

    body = el('div', 'so-manager-body')
    dialog.append(header, body)
    backdrop.append(dialog)
    document.body.append(backdrop)
    render()
  }

  function close(): void {
    if (!backdrop) return
    document.removeEventListener('keydown', onEscape)
    window.removeEventListener('resize', applyBackdropSize)
    backdrop.remove()
    backdrop = null
    body = null
    formDraft = null
    editingIndex = null
    deps.onClosed?.()
  }

  function save(next: NewvarData): void {
    deps.setData(next)
    render()
  }

  // —— 渲染 —— //

  function render(): void {
    if (!body) return
    try {
      body.textContent = ''
      body.append(
        buildTemplateSection(),
        buildDefsSection(),
        buildSettingsSection(),
        buildPreviewSection(),
        buildLogSection(),
      )
      if (scrollToEditor) {
        scrollToEditor = false
        body.querySelector('.nv-defs-editor')?.scrollIntoView({ block: 'nearest' })
      }
    } catch (err) {
      console.error('[st-stage] 变量设计弹窗渲染失败', err)
    }
  }

  function section(titleText: string): { box: HTMLElement } {
    const box = el('div', 'so-section')
    const title = el('div', 'so-section-title')
    title.textContent = titleText
    box.append(title)
    return { box }
  }

  function descLine(parent: HTMLElement, text: string): void {
    const d = el('div', 'so-app-desc')
    d.textContent = text
    parent.append(d)
  }

  // ① 模板库（卡片网格：内置 + 自定义；保存当前定义为模板）
  function buildTemplateSection(): HTMLElement {
    const data = deps.getData()
    const { box } = section('模板库（一键起步）')
    descLine(box, '「替换」清空现有定义后导入；「追加」跳过重名路径合并。导入的规则都已写好，可再逐条微调。')

    const grid = el('div', 'nv-tpl-grid')
    for (const tpl of NEWVAR_TEMPLATES) grid.append(buildTemplateCard(tpl, null))
    for (const tpl of data.customTemplates) grid.append(buildTemplateCard(tpl, tpl.id))
    box.append(grid)

    // 保存当前定义为自定义模板
    const saveRow = el('div', 'nv-tpl-save')
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.className = 'text_pole so-app-input'
    nameInput.placeholder = '模板名（如 我的恋爱系统）'
    nameInput.autocomplete = 'off'
    const saveBtn = el('button', 'menu_button vm-act')
    saveBtn.textContent = '把当前定义存为模板'
    saveBtn.addEventListener('click', () => {
      const cur = deps.getData()
      const name = nameInput.value.trim()
      if (!name) {
        window.alert('请先填写模板名。')
        return
      }
      if (cur.schema.variables.length === 0) {
        window.alert('当前没有任何变量定义，无法保存为模板。')
        return
      }
      const tpl: CustomTemplate = {
        id: `custom-${Date.now().toString(36)}`,
        name,
        description: `自定义 · ${cur.schema.variables.length} 项`,
        variables: cloneDefs(cur.schema.variables),
      }
      save({ ...cur, customTemplates: [...cur.customTemplates, tpl] })
    })
    saveRow.append(nameInput, saveBtn)
    box.append(saveRow)
    return box
  }

  function buildTemplateCard(tpl: NewvarTemplate | CustomTemplate, customId: string | null): HTMLElement {
    const card = el('div', 'nv-tpl-card')
    const name = el('div', 'vm-key')
    name.textContent = `${tpl.name}（${tpl.variables.length} 项）`
    const desc = el('div', 'vm-desc nv-tpl-desc')
    desc.textContent = tpl.description
    card.append(name, desc)

    const builtIn = customId === null ? (tpl as NewvarTemplate) : null
    const parameterInputs = new Map<string, HTMLInputElement>()
    for (const parameter of builtIn?.parameters ?? []) {
      const row = el('label', 'so-app-toggle')
      const label = document.createElement('span')
      label.textContent = parameter.label
      const input = document.createElement('input')
      input.type = 'text'
      input.className = 'text_pole so-app-input'
      input.value = parameter.default
      input.autocomplete = 'off'
      row.append(label, input)
      card.append(row)
      parameterInputs.set(parameter.key, input)
    }

    const resolveVariables = (): VariableDefinition[] | null => {
      if (!builtIn?.instantiate) return tpl.variables
      const parameters = Object.fromEntries([...parameterInputs].map(([key, input]) => [key, input.value.trim()]))
      const names = Object.values(parameters)
      if (names.some((value) => value === '')) {
        window.alert('请填写所有模板角色名。')
        return null
      }
      if (new Set(names).size !== names.length) {
        window.alert('模板角色名不能重复。')
        return null
      }
      if (names.some((value) => value.includes('.') || !isSafePath(`角色.${value}.变量`))) {
        window.alert('角色名不能包含点号或危险路径字段。')
        return null
      }
      return builtIn.instantiate(parameters)
    }

    const actions = el('div', 'nv-tpl-actions')
    const replaceBtn = el('button', 'menu_button vm-act')
    replaceBtn.textContent = '替换'
    replaceBtn.addEventListener('click', () => {
      const variables = resolveVariables()
      if (!variables) return
      const cur = deps.getData()
      if (
        cur.schema.variables.length > 0 &&
        !window.confirm(`用「${tpl.name}」替换现有 ${cur.schema.variables.length} 条定义？（楼层快照不受影响）`)
      ) {
        return
      }
      formDraft = null
      editingIndex = null
      save({ ...cur, schema: { ...cur.schema, name: tpl.name, variables: cloneDefs(variables) } })
    })
    const appendBtn = el('button', 'menu_button vm-act vm-act-ghost')
    appendBtn.textContent = '追加'
    appendBtn.addEventListener('click', () => {
      const variables = resolveVariables()
      if (!variables) return
      const cur = deps.getData()
      const existing = new Set(cur.schema.variables.map((v) => v.key))
      const added = variables.filter((v) => !existing.has(v.key))
      if (added.length === 0) {
        window.alert('该模板的变量路径都已存在，没有可追加的项。')
        return
      }
      save({ ...cur, schema: { ...cur.schema, variables: [...cur.schema.variables, ...cloneDefs(added)] } })
    })
    actions.append(replaceBtn, appendBtn)

    if (customId) {
      const delBtn = el('button', 'menu_button vm-act vm-act-ghost nv-tpl-del')
      delBtn.textContent = '删除'
      delBtn.addEventListener('click', () => {
        if (!window.confirm(`删除自定义模板「${tpl.name}」？`)) return
        const cur = deps.getData()
        save({ ...cur, customTemplates: cur.customTemplates.filter((t) => t.id !== customId) })
      })
      actions.append(delBtn)
    }
    card.append(actions)
    return card
  }

  // ② 变量定义：PC 双栏（左列表右编辑），窄屏自动堆叠
  function buildDefsSection(): HTMLElement {
    const data = deps.getData()
    const { box } = section(`变量定义（${data.schema.variables.length}）`)

    const layout = el('div', 'nv-defs-layout')
    const list = el('div', 'nv-defs-list')
    const editor = el('div', 'nv-defs-editor')

    if (data.schema.variables.length === 0) {
      descLine(list, '还没有变量。从上方模板一键导入，或点右侧「添加变量」逐条定义。')
    }
    for (let i = 0; i < data.schema.variables.length; i++) {
      list.append(buildDefRow(data.schema.variables[i], i))
    }

    if (formDraft) {
      editor.append(buildDefForm())
    } else {
      const hint = el('div', 'so-app-desc')
      hint.textContent = '点击左侧变量进行编辑，或新建：'
      editor.append(
        hint,
        appButton('＋ 添加变量', () => {
          formDraft = emptyDraft()
          editingIndex = null
          scrollToEditor = true
          render()
        }),
      )
    }

    layout.append(list, editor)
    box.append(layout)
    return box
  }

  function buildDefRow(def: VariableDefinition, index: number): HTMLElement {
    const selected = editingIndex === index
    const card = el('div', `vm-leaf${selected ? ' nv-def-selected' : ''}`)
    const main = el('div', 'vm-leaf-main')
    const keyEl = el('span', 'vm-key')
    keyEl.textContent = def.key
    const meta = el('span', 'vm-val')
    const parts = [TYPE_LABELS[def.type], `默认 ${formatValue(def.default)}`]
    if (def.range) parts.push(`范围 ${def.range[0]}~${def.range[1]}`)
    if (def.enum) parts.push(`枚举 ${def.enum.join('/')}`)
    if (def.hidden) parts.push('对 AI 隐藏')
    meta.textContent = parts.join(' · ')
    main.append(keyEl, meta)
    if (def.description) {
      const desc = el('div', 'vm-desc')
      desc.textContent = def.description
      main.append(desc)
    }
    if (def.updateRule) {
      const rule = el('div', 'vm-desc')
      rule.textContent = `规则：${def.updateRule.split('\n').join('；')}`
      main.append(rule)
    }
    main.setAttribute('role', 'button')
    main.tabIndex = 0
    const edit = () => {
      formDraft = draftFromDef(def)
      editingIndex = index
      scrollToEditor = true
      render()
    }
    main.addEventListener('click', edit)
    main.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        edit()
      }
    })

    const del = el('button', 'vm-del')
    del.setAttribute('aria-label', '删除定义')
    del.title = '删除该变量定义'
    del.textContent = '✕'
    del.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!window.confirm(`删除变量定义「${def.key}」？（已保存的楼层快照不受影响）`)) return
      const cur = deps.getData()
      if (editingIndex === index) {
        formDraft = null
        editingIndex = null
      }
      save({ ...cur, schema: { ...cur.schema, variables: cur.schema.variables.filter((_, i) => i !== index) } })
    })

    card.append(main, del)
    return card
  }

  function buildDefForm(): HTMLElement {
    const draft = formDraft!
    const wrap = el('div', 'vm-leaf vm-editing')
    const title = el('div', 'so-app-title vm-edit-title')
    title.textContent = editingIndex === null ? '新变量定义' : `编辑：${draft.key || '（未命名）'}`
    wrap.append(title)

    const err = el('div', 'so-app-desc vm-add-err')
    err.hidden = true

    wrap.append(
      textRow('路径（点号分层）', draft.key, '如 状态.体力 / 角色.小雪.好感度', (v) => (draft.key = v)),
      selectRow(
        '类型',
        draft.type,
        (Object.keys(TYPE_LABELS) as VarType[]).map((t) => ({ value: t, label: TYPE_LABELS[t] })),
        (v) => {
          draft.type = v as VarType
          render() // 类型切换重建表单（范围/枚举行按类型显隐）
        },
      ),
      textRow('默认值', draft.defaultText, draft.type === 'boolean' ? 'true / false' : '', (v) => (draft.defaultText = v)),
      textRow('描述（给 AI 看）', draft.description, '如 角色对用户的好感', (v) => (draft.description = v)),
    )
    if (draft.type === 'number') {
      wrap.append(textRow('范围（可空）', draft.rangeText, '如 0~100，越界自动修正', (v) => (draft.rangeText = v)))
    }
    if (draft.type === 'enum') {
      wrap.append(textRow('枚举选项（逗号分隔）', draft.enumText, '如 开心, 平静, 烦躁', (v) => (draft.enumText = v)))
    }
    wrap.append(
      textareaRow(
        '更新规则（每行一条，注入给 AI）',
        draft.updateRule,
        '如：正面互动 +1~3\n重大事件 ±5~10\n禁止无缘由跳变',
        (v) => (draft.updateRule = v),
      ),
      toggleRow('对 AI 隐藏（内部计算用）', draft.hidden, (v) => (draft.hidden = v)),
      err,
    )

    const actions = el('div', 'vm-actions')
    const saveBtn = el('button', 'menu_button vm-act')
    saveBtn.textContent = '保存定义'
    saveBtn.addEventListener('click', () => {
      const r = draftToDef(draft)
      if (!r.def) {
        err.textContent = r.error ?? '输入无效。'
        err.hidden = false
        return
      }
      const cur = deps.getData()
      const dup = cur.schema.variables.findIndex((v, i) => v.key === r.def!.key && i !== editingIndex)
      if (dup >= 0) {
        err.textContent = `路径「${r.def.key}」已有定义。`
        err.hidden = false
        return
      }
      const variables = [...cur.schema.variables]
      if (editingIndex !== null && editingIndex < variables.length) variables[editingIndex] = r.def
      else variables.push(r.def)
      formDraft = null
      editingIndex = null
      save({ ...cur, schema: { ...cur.schema, variables } })
    })
    const cancel = el('button', 'menu_button vm-act vm-act-ghost')
    cancel.textContent = '取消'
    cancel.addEventListener('click', () => {
      formDraft = null
      editingIndex = null
      render()
    })
    actions.append(saveBtn, cancel)
    wrap.append(actions)
    return wrap
  }

  // ③ 生成设置
  function buildSettingsSection(): HTMLElement {
    const data = deps.getData()
    const { box } = section('生成设置')
    box.append(
      selectRow(
        '输出格式',
        data.format,
        [
          { value: 'json_patch', label: 'JSON Patch（推荐）' },
          { value: 'lodash_set', label: '_.set（老版 MVU 兼容）' },
        ],
        (v) => save({ ...deps.getData(), format: v === 'lodash_set' ? 'lodash_set' : 'json_patch' }),
      ),
      numberRow('注入深度（距末尾楼层数）', data.injectionDepth, 0, 20, (v) =>
        save({ ...deps.getData(), injectionDepth: v }),
      ),
    )
    return box
  }

  // ④ 注入预览
  function buildPreviewSection(): HTMLElement {
    const fold = foldSection('注入预览')
    const text = deps.buildPreview()
    if (text) {
      const pre = el('div', 'nv-pre')
      pre.textContent = text
      fold.body.append(pre)
    } else {
      descLine(fold.body, '（未启用或未定义任何变量时不注入。启用开关在手机「新变量」页。）')
    }
    const wrap = el('div', 'so-section')
    wrap.append(fold.box)
    return wrap
  }

  // ⑤ 解析日志
  function buildLogSection(): HTMLElement {
    const fold = foldSection('解析日志')
    const report = deps.getLastParse()
    if (!report) {
      descLine(fold.body, '尚无解析记录。AI 回复包含 <UpdateVariable> 块时，这里显示逐条接受/修正/拒绝结果。')
    } else {
      descLine(fold.body, `楼层 #${report.messageId}${report.error ? ` · 解析出错：${report.error}` : ''}`)
      const icons: Record<string, string> = { accepted: '✅', corrected: '⚠️', rejected: '❌', removed: '🗑️' }
      for (const entry of report.log) {
        const line = el('div', 'so-app-desc nv-log-line')
        line.textContent = `${icons[entry.status] ?? '·'} ${entry.path}${entry.detail ? ` — ${entry.detail}` : ''}`
        fold.body.append(line)
      }
    }
    const wrap = el('div', 'so-section')
    wrap.append(fold.box)
    return wrap
  }

  return { open, close, isOpen: () => backdrop !== null }
}
