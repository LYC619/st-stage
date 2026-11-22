/**
 * 「变量设计」全屏弹窗（复用图库管理的 so-manager 样式体系）：
 * - 模板库：内置模板 + 用户自定义模板，卡片网格布局（PC 一行多张，窄屏自动单列）；
 *   「替换/追加」导入；可把当前定义保存为自定义模板（换卡复用）、删除自定义模板
 * - 变量定义：PC 双栏（左列表 / 右编辑表单，点谁编辑谁），窄屏自动上下堆叠 + 滚动到表单；
 *   字段：路径/类型/默认值/描述/范围/枚举/更新规则(check)/对 AI 隐藏
 * - 生成设置（输出格式/注入深度）、注入预览、解析日志
 *
 * 设计弹窗而非手机屏内编辑（用户实测反馈）：设计变量时不需要读正文，全屏表单对新手友好。
 * 布局全部走响应式 CSS（.nv-* @media），同一份 DOM 兼容 PC 与移动端。
 */

import { manageDialogFocus } from '../../../../core/dialog-focus'
import { fixedViewport, observeFixedViewport } from '../../../../core/fixed-viewport'
import { captureVariableFocus, variableButton } from './ui-focus'
import { t } from '../../../../core/i18n'

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

function typeLabels(): Record<VarType, string> {
  return {
    number: t('variableDesigner.number', '数字'),
    string: t('variableDesigner.string', '文本'),
    boolean: t('variableDesigner.boolean', '开关（是/否）'),
    enum: t('variableDesigner.enum', '固定选项'),
  }
}

/** Localize catalog metadata only; imported definitions and saved schema names stay intact. */
function templateDisplay(tpl: NewvarTemplate | CustomTemplate, customId: string | null): { name: string; description: string } {
  if (customId !== null) return {
    name: tpl.name,
    description: tpl.description === `自定义 · ${tpl.variables.length} 项`
      ? t('variableDesigner.custom_count', '自定义 · {{count}} 项', { count: tpl.variables.length })
      : tpl.description,
  }
  switch (tpl.id) {
    case 'romance-single': return {
      name: t('variableDesigner.templates_romance_single', '恋爱 · 单角色'),
      description: t('variableDesigner.templates_romance_single_description', '好感、关系阶段、心情、行动和完整日期时间；关系按明确阈值小步推进。'),
    }
    case 'romance-multi': return {
      name: t('variableDesigner.templates_romance_multi', '恋爱 · 多角色'),
      description: t('variableDesigner.templates_romance_multi_description', '为两个角色分别维护在场、好感、关系、状态、位置和穿着；导入前可直接填写角色名。'),
    }
    case 'rpg': return {
      name: t('variableDesigner.templates_rpg', 'RPG 冒险'),
      description: t('variableDesigner.templates_rpg_description', '生命、法力、金币、等级、身体状态、位置与完整日期时间。'),
    }
    case 'daily': return {
      name: t('variableDesigner.templates_daily', '日常陪伴'),
      description: t('variableDesigner.templates_daily_description', '好感、心情、体力、活动、地点与完整日期时间，适合慢节奏日常卡。'),
    }
    case 'survival-exploration': return {
      name: t('variableDesigner.templates_survival', '生存探索'),
      description: t('variableDesigner.templates_survival_description', '生命、饥饿、口渴、疲劳、体感温度、危险、地点与时间，适合荒野和末日探索。'),
    }
    case 'mystery-investigation': return {
      name: t('variableDesigner.templates_mystery', '悬疑调查'),
      description: t('variableDesigner.templates_mystery_description', '调查目标、线索摘要、嫌疑、紧迫度、阶段、地点与时间，适合推理和侦探剧情。'),
    }
    case 'quest-progression': return {
      name: t('variableDesigner.templates_quest', '任务推进'),
      description: t('variableDesigner.templates_quest_description', '目标、进度、阶段、阻碍、截止压力和完成状态，适合长期主线与委托。'),
    }
    default: return tpl
  }
}

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
  if (!key) return { error: t('variableDesigner.path_required', "请填写变量路径。") }
  if (!isSafePath(key)) return { error: t('variableDesigner.unsafe_path', "变量路径不能包含 __proto__、prototype 或 constructor。") }
  const def: VariableDefinition = { key, type: draft.type, default: undefined, description: draft.description.trim() }
  if (draft.hidden) def.hidden = true
  if (draft.updateRule.trim()) def.updateRule = draft.updateRule.trim()

  if (draft.type === 'number') {
    const range = parseRange(draft.rangeText)
    if (range === false) return { error: t('variableDesigner.invalid_range', "范围格式应为「最小~最大」，如 0~100。") }
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
    if (options.length === 0) return { error: t('variableDesigner.enum_required', "固定选项类型至少要填一个可选项（用逗号分隔）。") }
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
  let focus: ReturnType<typeof manageDialogFocus> | null = null
  let formDraft: DefDraft | null = null
  let editingIndex: number | null = null
  /** 本次渲染后把编辑表单滚进视野（窄屏堆叠布局下点列表要能看到表单） */
  let scrollToEditor = false

  let stopViewport: (() => void) | null = null
  function applyBackdropSize(): void {
    if (!backdrop) return
    const viewport = fixedViewport()
    backdrop.style.left = `${viewport.left}px`
    backdrop.style.top = `${viewport.top}px`
    backdrop.style.width = `${viewport.width}px`
    backdrop.style.height = `${viewport.height}px`
  }

  function open(): void {
    if (backdrop) {
      render()
      return
    }
    formDraft = null
    editingIndex = null
    backdrop = el('div', 'so-manager-backdrop')
    stopViewport = observeFixedViewport(applyBackdropSize)
    applyBackdropSize()

    const dialog = el('div', 'so-manager')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('aria-label', t('variableDesigner.title', "变量设计"))

    const header = el('div', 'so-manager-header')
    const title = el('div', 'so-manager-title')
    title.textContent = t('variableDesigner.title', "变量设计")
    const closeBtn = el('div', 'menu_button so-manager-close')
    closeBtn.textContent = '✕'
    closeBtn.title = t('variableDesigner.close', "关闭")
    closeBtn.setAttribute('aria-label', closeBtn.title)
    closeBtn.setAttribute('role', 'button')
    closeBtn.tabIndex = 0
    closeBtn.addEventListener('click', close)
    closeBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        close()
      }
    })
    header.append(title, closeBtn)

    body = el('div', 'so-manager-body')
    dialog.append(header, body)
    backdrop.append(dialog)
    document.body.append(backdrop)
    focus = manageDialogFocus(dialog, { onEscape: close, layer: backdrop })
    render()
    focus.focusInitial()
  }

  function close(): void {
    if (!backdrop) return
    const closingFocus = focus
    focus = null
    closingFocus?.dispose()
    stopViewport?.(); stopViewport = null
    backdrop.remove()
    backdrop = null
    body = null
    formDraft = null
    editingIndex = null
    deps.onClosed?.()
    closingFocus?.restoreFocus()
  }

  function save(next: NewvarData): void {
    deps.setData(next)
    render()
  }

  // —— 渲染 —— //

  function render(): void {
    if (!body) return
    const restore = captureVariableFocus(body)
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
        body.querySelector('.nv-defs-editor')?.scrollIntoView?.({ block: 'nearest' })
        body.querySelector<HTMLElement>('.nv-defs-editor input')?.focus({ preventScroll: true })
      } else if (restore && !restore()) {
        body.querySelector<HTMLElement>('.nv-defs-editor .so-app-btn')?.focus({ preventScroll: true })
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
    const { box } = section(t('variableDesigner.templates', "模板库（一键起步）"))
    descLine(box, t('variableDesigner.template_help', "「替换」清空现有定义后导入；「追加」跳过重名路径合并。导入的规则都已写好，可再逐条微调。"))

    const grid = el('div', 'nv-tpl-grid')
    for (const tpl of NEWVAR_TEMPLATES) grid.append(buildTemplateCard(tpl, null))
    for (const tpl of data.customTemplates) grid.append(buildTemplateCard(tpl, tpl.id))
    box.append(grid)

    // 保存当前定义为自定义模板
    const saveRow = el('div', 'nv-tpl-save')
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.className = 'text_pole so-app-input'
    nameInput.placeholder = t('variableDesigner.template_placeholder', "模板名（如 我的恋爱系统）")
    nameInput.autocomplete = 'off'
    nameInput.setAttribute('aria-label', t('variableDesigner.template_name', '模板名'))
    const saveBtn = variableButton('menu_button vm-act')
    saveBtn.textContent = t('variableDesigner.save_template', "把当前定义存为模板")
    saveBtn.dataset.variableFocus = 'save-template'
    saveBtn.addEventListener('click', () => {
      const cur = deps.getData()
      const name = nameInput.value.trim()
      if (!name) {
        window.alert(t('variableDesigner.template_name_required', "请先填写模板名。"))
        return
      }
      if (cur.schema.variables.length === 0) {
        window.alert(t('variableDesigner.template_empty', "当前没有任何变量定义，无法保存为模板。"))
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
    card.dataset.variableFocusScope = `template:${tpl.id}`
    card.setAttribute('role', 'group')
    card.setAttribute('aria-label', templateDisplay(tpl, customId).name)
    const name = el('div', 'vm-key')
    name.textContent = t('variableDesigner.template_count', "{{name}}（{{count}} 项）", { name: templateDisplay(tpl, customId).name, count: tpl.variables.length })
    const desc = el('div', 'vm-desc nv-tpl-desc')
    desc.textContent = templateDisplay(tpl, customId).description
    card.append(name, desc)

    const builtIn = customId === null ? (tpl as NewvarTemplate) : null
    const parameterInputs = new Map<string, HTMLInputElement>()
    for (const parameter of builtIn?.parameters ?? []) {
      const row = el('label', 'so-app-toggle')
      const label = document.createElement('span')
      label.textContent = parameter.key === 'roleA'
        ? t('variableDesigner.role_one', '角色 1 名称')
        : parameter.key === 'roleB' ? t('variableDesigner.role_two', '角色 2 名称') : parameter.label
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
        window.alert(t('variableDesigner.roles_required', "请填写所有模板角色名。"))
        return null
      }
      if (new Set(names).size !== names.length) {
        window.alert(t('variableDesigner.roles_duplicate', "模板角色名不能重复。"))
        return null
      }
      if (names.some((value) => value.includes('.') || !isSafePath(`角色.${value}.变量`))) {
        window.alert(t('variableDesigner.roles_unsafe', "角色名不能包含点号或危险路径字段。"))
        return null
      }
      return builtIn.instantiate(parameters)
    }

    const actions = el('div', 'nv-tpl-actions')
    const replaceBtn = variableButton('menu_button vm-act')
    replaceBtn.textContent = t('variableDesigner.replace', "替换")
    replaceBtn.dataset.variableFocus = `template:${tpl.id}:replace`
    replaceBtn.addEventListener('click', () => {
      const variables = resolveVariables()
      if (!variables) return
      const cur = deps.getData()
      if (
        cur.schema.variables.length > 0 &&
        !window.confirm(t('variableDesigner.replace_confirm', "用「{{name}}」替换现有的 {{count}} 条变量定义？（以前楼层记下的旧数值不会丢）", { name: templateDisplay(tpl, customId).name, count: cur.schema.variables.length }))
      ) {
        return
      }
      formDraft = null
      editingIndex = null
      save({ ...cur, schema: { ...cur.schema, name: tpl.name, variables: cloneDefs(variables) } })
    })
    const appendBtn = variableButton('menu_button vm-act vm-act-ghost')
    appendBtn.textContent = t('variableDesigner.append', "追加")
    appendBtn.dataset.variableFocus = `template:${tpl.id}:append`
    appendBtn.addEventListener('click', () => {
      const variables = resolveVariables()
      if (!variables) return
      const cur = deps.getData()
      const existing = new Set(cur.schema.variables.map((v) => v.key))
      const added = variables.filter((v) => !existing.has(v.key))
      if (added.length === 0) {
        window.alert(t('variableDesigner.no_new_paths', "该模板的变量路径都已存在，没有可追加的项。"))
        return
      }
      save({ ...cur, schema: { ...cur.schema, variables: [...cur.schema.variables, ...cloneDefs(added)] } })
    })
    actions.append(replaceBtn, appendBtn)

    if (customId) {
      const delBtn = variableButton('menu_button vm-act vm-act-ghost nv-tpl-del')
      delBtn.textContent = t('variableDesigner.delete', "删除")
      delBtn.addEventListener('click', () => {
        if (!window.confirm(t('variableDesigner.delete_template_confirm', "删除自定义模板「{{name}}」？", { name: tpl.name }))) return
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
    const { box } = section(t('variableDesigner.definitions', "变量定义（{{count}}）", { count: data.schema.variables.length }))

    const layout = el('div', 'nv-defs-layout')
    const list = el('div', 'nv-defs-list')
    const editor = el('div', 'nv-defs-editor')

    if (data.schema.variables.length === 0) {
      descLine(list, t('variableDesigner.no_definitions', "还没有变量。从上方模板一键导入，或点右侧「添加变量」逐条定义。"))
    }
    for (let i = 0; i < data.schema.variables.length; i++) {
      list.append(buildDefRow(data.schema.variables[i], i))
    }

    if (formDraft) {
      editor.append(buildDefForm())
    } else {
      const hint = el('div', 'so-app-desc')
      hint.textContent = t('variableDesigner.edit_hint', "点击左侧变量进行编辑，或新建：")
      editor.append(
        hint,
        appButton(t('variableDesigner.add', "＋ 添加变量"), () => {
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
    main.dataset.variableFocus = `definition:${def.key}`
    const keyEl = el('span', 'vm-key')
    keyEl.textContent = def.key
    const meta = el('span', 'vm-val')
    const parts = [typeLabels()[def.type], t('variableDesigner.default_summary', "默认 {{value}}", { value: formatValue(def.default) })]
    if (def.range) parts.push(t('variableDesigner.range_summary', "范围 {{min}}~{{max}}", { min: def.range[0], max: def.range[1] }))
    if (def.enum) parts.push(t('variableDesigner.enum_summary', "可选 {{options}}", { options: def.enum.join('/') }))
    if (def.hidden) parts.push(t('variableDesigner.hidden', "对 AI 隐藏"))
    meta.textContent = parts.join(' · ')
    main.append(keyEl, meta)
    if (def.description) {
      const desc = el('div', 'vm-desc')
      desc.textContent = def.description
      main.append(desc)
    }
    if (def.updateRule) {
      const rule = el('div', 'vm-desc')
      rule.textContent = t('variableDesigner.rules_summary', "规则：{{rules}}", { rules: def.updateRule.split('\n').join('；') })
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
        e.stopPropagation()
        edit()
      }
    })

    const del = variableButton('vm-del')
    del.setAttribute('aria-label', t('variableDesigner.delete_path', '删除定义 {{path}}', { path: def.key }))
    del.title = t('variableDesigner.delete_definition_title', "删除该变量定义")
    del.textContent = '✕'
    del.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!window.confirm(t('variableDesigner.delete_definition_confirm', "删除变量定义「{{path}}」？（以前楼层记下的旧数值不会丢）", { path: def.key }))) return
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
    title.textContent = editingIndex === null ? t('variableDesigner.new_definition', "新变量定义") : t('variableDesigner.edit', "编辑：{{path}}", { path: draft.key || t('variableDesigner.unnamed', '（未命名）') })
    wrap.append(title)

    const err = el('div', 'so-app-desc vm-add-err')
    err.hidden = true
    err.setAttribute('role', 'alert')

    wrap.append(
      textRow(t('variableDesigner.path', "路径（点号分层）"), draft.key, t('variableDesigner.path_example', "如 状态.体力 / 角色.小雪.好感度"), (v) => (draft.key = v)),
      selectRow(
        t('variableDesigner.type', "类型"),
        draft.type,
        (Object.keys(typeLabels()) as VarType[]).map((t) => ({ value: t, label: typeLabels()[t] })),
        (v) => {
          draft.type = v as VarType
          render() // 类型切换重建表单（范围/枚举行按类型显隐）
        },
      ),
      textRow(t('variableDesigner.default', "默认值"), draft.defaultText, draft.type === 'boolean' ? 'true / false' : '', (v) => (draft.defaultText = v)),
      textRow(t('variableDesigner.description', "描述（给 AI 看）"), draft.description, t('variableDesigner.description_example', "如 角色对用户的好感"), (v) => (draft.description = v)),
    )
    if (draft.type === 'number') {
      wrap.append(textRow(t('variableDesigner.range', "范围（可空）"), draft.rangeText, t('variableDesigner.range_example', "如 0~100，越界自动修正"), (v) => (draft.rangeText = v)))
    }
    if (draft.type === 'enum') {
      wrap.append(textRow(t('variableDesigner.enum_options', "可选值列表（逗号分隔）"), draft.enumText, t('variableDesigner.enum_example', "如 开心, 平静, 烦躁"), (v) => (draft.enumText = v)))
    }
    wrap.append(
      textareaRow(
        t('variableDesigner.rules', "更新规则（每行一条，注入给 AI）"),
        draft.updateRule,
        t('variableDesigner.rules_example', "如：正面互动 +1~3\n重大事件 ±5~10\n禁止无缘由跳变"),
        (v) => (draft.updateRule = v),
      ),
      toggleRow(t('variableDesigner.hidden_input', "对 AI 隐藏（内部计算用）"), draft.hidden, (v) => (draft.hidden = v)),
      err,
    )

    const actions = el('div', 'vm-actions')
    const saveBtn = variableButton('menu_button vm-act')
    saveBtn.textContent = t('variableDesigner.save_definition', "保存定义")
    saveBtn.addEventListener('click', () => {
      const r = draftToDef(draft)
      if (!r.def) {
        err.textContent = r.error ?? t('variableDesigner.invalid', "输入无效。")
        err.hidden = false
        return
      }
      const cur = deps.getData()
      const dup = cur.schema.variables.findIndex((v, i) => v.key === r.def!.key && i !== editingIndex)
      if (dup >= 0) {
        err.textContent = t('variableDesigner.duplicate_path', "路径「{{path}}」已有定义。", { path: r.def.key })
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
    const cancel = variableButton('menu_button vm-act vm-act-ghost')
    cancel.dataset.variableFocus = 'cancel-definition'
    cancel.textContent = t('variableDesigner.cancel', "取消")
    cancel.addEventListener('click', () => {
      formDraft = null
      editingIndex = null
      render()
    })
    saveBtn.dataset.variableFocus = 'save-definition'
    actions.append(saveBtn, cancel)
    wrap.append(actions)
    return wrap
  }

  // ③ 生成设置
  function buildSettingsSection(): HTMLElement {
    const data = deps.getData()
    const { box } = section(t('variableDesigner.settings', "生成设置"))
    box.append(
      selectRow(
        t('variableDesigner.format', "输出格式"),
        data.format,
        [
          { value: 'json_patch', label: t('variableDesigner.json_patch', "JSON Patch（推荐）") },
          { value: 'lodash_set', label: t('variableDesigner.lodash_set', "_.set 指令（兼容旧版 MVU 角色卡）") },
        ],
        (v) => save({ ...deps.getData(), format: v === 'lodash_set' ? 'lodash_set' : 'json_patch' }),
      ),
      numberRow(t('variableDesigner.depth', "提示词插入位置（距最新消息条数）"), data.injectionDepth, 0, 20, (v) =>
        save({ ...deps.getData(), injectionDepth: v }),
      ),
    )
    return box
  }

  // ④ 注入预览
  function buildPreviewSection(): HTMLElement {
    const fold = foldSection(t('variableDesigner.preview', "注入预览"))
    const text = deps.buildPreview()
    if (text) {
      const pre = el('div', 'nv-pre')
      pre.textContent = text
      fold.body.append(pre)
    } else {
      descLine(fold.body, t('variableDesigner.no_preview', "（未启用或未定义任何变量时不注入。启用开关在手机「新变量」页。）"))
    }
    const wrap = el('div', 'so-section')
    wrap.append(fold.box)
    return wrap
  }

  // ⑤ 解析日志
  function buildLogSection(): HTMLElement {
    const fold = foldSection(t('variableDesigner.log', "解析日志"))
    const report = deps.getLastParse()
    if (!report) {
      descLine(fold.body, t('variableDesigner.no_log', "尚无解析记录。AI 回复包含 <UpdateVariable> 块时，这里显示逐条接受/修正/拒绝结果。"))
    } else {
      descLine(fold.body, t('variableDesigner.message_log', "楼层 #{{id}}{{error}}", { id: report.messageId, error: report.error ? t('variableDesigner.parse_error', ' · 解析出错：{{error}}', { error: report.error }) : '' }))
      const icons: Record<string, string> = { accepted: '✅', corrected: '⚠️', rejected: '❌', removed: '🗑️' }
      const labels = {
        accepted: t('variableDesigner.log_accepted', '已接受'),
        corrected: t('variableDesigner.log_corrected', '已修正'),
        rejected: t('variableDesigner.log_rejected', '已拒绝'),
        removed: t('variableDesigner.log_removed', '已删除'),
      }
      for (const entry of report.log) {
        const line = el('div', 'so-app-desc nv-log-line')
        line.textContent = `${icons[entry.status] ?? '·'} ${labels[entry.status]} · ${entry.path}${entry.detail ? ` — ${entry.detail}` : ''}`
        fold.body.append(line)
      }
    }
    const wrap = el('div', 'so-section')
    wrap.append(fold.box)
    return wrap
  }

  return { open, close, isOpen: () => backdrop !== null }
}
