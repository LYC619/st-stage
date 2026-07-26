/**
 * 「新变量」App — 内置轻量变量追踪（UI 层）：
 * - 开关/格式/注入深度配置（存 ctx appData，经 runtime.onConfigChanged 生效）
 * - 变量状态面板：复用共享 variable-tree 视图（isMvu:false），delta 高亮 + 手动编辑
 * - 变量定义器（schema）：GUI 增删改变量（类型/默认值/范围/枚举/隐藏）
 * - 注入预览：当前会注入给 AI 的完整文本
 * - 解析日志：最近一次 <UpdateVariable> 的逐条 接受/修正/拒绝 结果
 *
 * 引擎/存储/事件都在 newvar/runtime（随扩展常驻）；本文件只是它的控制台。
 * 分区渲染：runtime 通知只刷新状态/预览/日志区，配置与 schema 表单不受影响（保住输入草稿）。
 */

import type { PhoneApp, PhoneAppContext } from '../../../core/phone-registry'
import { el, appButton, toggleRow, selectRow, numberRow, textRow, foldSection } from './widgets'
import { createVariableTreeView, computeDelta, formatValue, type VariableTreeModel } from './variable-tree'
import type { NewvarRuntime } from './newvar/runtime'
import type { NewvarData } from './newvar/config'
import type { VariableDefinition, VarType } from './newvar/types'

export interface NewvarAppDeps {
  runtime: NewvarRuntime
}

/** schema 编辑表单草稿（全部按文本暂存，保存时按类型解析） */
interface DefDraft {
  key: string
  type: VarType
  defaultText: string
  description: string
  rangeText: string
  enumText: string
  hidden: boolean
}

function draftFromDef(def: VariableDefinition): DefDraft {
  return {
    key: def.key,
    type: def.type,
    defaultText: formatValue(def.default),
    description: def.description,
    rangeText: def.range ? `${def.range[0]}~${def.range[1]}` : '',
    enumText: (def.enum ?? []).join(', '),
    hidden: def.hidden === true,
  }
}

function emptyDraft(): DefDraft {
  return { key: '', type: 'number', defaultText: '0', description: '', rangeText: '', enumText: '', hidden: false }
}

/** 草稿 → 定义；返回 null 时给出错误消息 */
function draftToDef(draft: DefDraft): { def?: VariableDefinition; error?: string } {
  const key = draft.key.trim()
  if (!key) return { error: '请填写变量路径。' }
  const def: VariableDefinition = { key, type: draft.type, default: undefined, description: draft.description.trim() }
  if (draft.hidden) def.hidden = true

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

const TYPE_LABELS: Record<VarType, string> = { number: '数字', string: '文本', boolean: '布尔', enum: '枚举' }

export function newvarApp(deps: NewvarAppDeps): PhoneApp {
  let unsub: (() => void) | null = null

  return {
    id: 'newvar',
    name: '新变量',
    icon: '🧮',
    order: 5,
    mount(container, ctx) {
      unsub?.()
      unsub = mountApp(container, ctx, deps.runtime)
    },
    unmount() {
      unsub?.()
      unsub = null
    },
  }
}

function mountApp(container: HTMLElement, ctx: PhoneAppContext, runtime: NewvarRuntime): () => void {
  // 分区容器：各区独立重渲染
  const cfgBox = el('div', 'nv-box')
  const stateBox = el('div', 'nv-box')
  const schemaWrap = el('div', 'nv-box')
  const previewBox = el('div', 'nv-box')
  const logBox = el('div', 'nv-box')
  container.append(cfgBox, stateBox, schemaWrap, previewBox, logBox)

  // schema 编辑表单状态（跨渲染保留草稿）
  let formDraft: DefDraft | null = null
  let editingIndex: number | null = null

  function data(): NewvarData {
    return runtime.getData()
  }

  function saveData(next: NewvarData): void {
    ctx.setAppData<NewvarData>(next)
    runtime.onConfigChanged() // 触发重注入 + 通知（状态/预览/日志区随之刷新）
  }

  // —— 配置区 —— //

  function renderCfg(): void {
    cfgBox.textContent = ''
    const d = data()
    const section = el('div', 'so-app-section')
    const title = el('div', 'so-app-title')
    title.textContent = '内置变量追踪'
    const desc = el('div', 'so-app-desc')
    desc.textContent =
      '不依赖 MVU/酒馆助手：定义变量后自动向 AI 注入当前状态与更新规则，解析回复中的 <UpdateVariable> 并逐楼保存快照。任何角色卡都能用。'
    section.append(
      title,
      desc,
      toggleRow('启用（注入 + 解析）', d.enabled, (v) => {
        saveData({ ...data(), enabled: v })
        renderCfg()
      }),
      selectRow(
        '输出格式',
        d.format,
        [
          { value: 'json_patch', label: 'JSON Patch（推荐）' },
          { value: 'lodash_set', label: '_.set（老版 MVU 兼容）' },
        ],
        (v) => saveData({ ...data(), format: v === 'lodash_set' ? 'lodash_set' : 'json_patch' }),
      ),
      numberRow('注入深度（距末尾楼层数）', d.injectionDepth, 0, 20, (v) =>
        saveData({ ...data(), injectionDepth: v }),
      ),
    )
    cfgBox.append(section)
  }

  // —— 状态面板（复用共享变量树） —— //

  const tree = createVariableTreeView(stateBox, {
    getModel: buildTreeModel,
    commitSet: (path, value) => runtime.setVariable(path, value),
    commitDelete: (path) => runtime.deleteVariable(path),
    requestRefresh: () => renderVolatile(),
  })

  function buildTreeModel(): VariableTreeModel {
    const st = runtime.isSTAvailable()
    const d = data()
    const state = runtime.getCurrentState()
    return {
      data: state,
      isMvu: false,
      delta: computeDelta(state, runtime.getPrevState(), false),
      status: st ? 'ready' : 'unavailable',
      statusText: st ? `内置追踪 · ${d.enabled ? '已启用' : '未启用'}` : '内置追踪 · 模拟器',
      emptyText: '暂无变量。启用追踪并在下方定义变量，AI 回复后这里会显示逐楼状态。',
      noticeText: st
        ? undefined
        : '未检测到 SillyTavern：模拟器中仅可编辑变量定义与预览注入文本，状态快照在 ST 内才会产生。',
      canWrite: st,
      addHint: '手动新增只写入当前楼的状态快照（不会加进变量定义）。路径用点号分层。',
    }
  }

  // —— 变量定义器 —— //

  function renderSchema(): void {
    schemaWrap.textContent = ''
    const d = data()
    const fold = foldSection(`变量定义（${d.schema.variables.length}）`, d.schema.variables.length === 0)

    for (let i = 0; i < d.schema.variables.length; i++) {
      fold.body.append(buildDefRow(d.schema.variables[i], i))
    }

    if (formDraft) {
      fold.body.append(buildDefForm())
    } else {
      fold.body.append(
        appButton('＋ 添加变量定义', () => {
          formDraft = emptyDraft()
          editingIndex = null
          renderSchema()
        }),
      )
    }
    schemaWrap.append(fold.box)
  }

  function buildDefRow(def: VariableDefinition, index: number): HTMLElement {
    const card = el('div', 'vm-leaf')
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
    main.setAttribute('role', 'button')
    main.tabIndex = 0
    const edit = () => {
      formDraft = draftFromDef(def)
      editingIndex = index
      renderSchema()
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
      const cur = data()
      const variables = cur.schema.variables.filter((_, i) => i !== index)
      if (editingIndex === index) {
        formDraft = null
        editingIndex = null
      }
      saveData({ ...cur, schema: { ...cur.schema, variables } })
      renderSchema()
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
      textRow('路径（点号分层）', draft.key, '如 状态.体力', (v) => (draft.key = v)),
      selectRow(
        '类型',
        draft.type,
        (Object.keys(TYPE_LABELS) as VarType[]).map((t) => ({ value: t, label: TYPE_LABELS[t] })),
        (v) => {
          draft.type = v as VarType
          renderSchema() // 类型切换重建表单（范围/枚举行按类型显隐）
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
    wrap.append(toggleRow('对 AI 隐藏（内部计算用）', draft.hidden, (v) => (draft.hidden = v)), err)

    const actions = el('div', 'vm-actions')
    const save = el('button', 'menu_button vm-act')
    save.textContent = '保存定义'
    save.addEventListener('click', () => {
      const r = draftToDef(draft)
      if (!r.def) {
        err.textContent = r.error ?? '输入无效。'
        err.hidden = false
        return
      }
      const cur = data()
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
      saveData({ ...cur, schema: { ...cur.schema, variables } })
      renderSchema()
    })
    const cancel = el('button', 'menu_button vm-act vm-act-ghost')
    cancel.textContent = '取消'
    cancel.addEventListener('click', () => {
      formDraft = null
      editingIndex = null
      renderSchema()
    })
    actions.append(save, cancel)
    wrap.append(actions)
    return wrap
  }

  // —— 注入预览 + 解析日志 —— //

  function renderPreview(): void {
    previewBox.textContent = ''
    const fold = foldSection('注入预览')
    const text = runtime.buildPreview()
    if (text) {
      const pre = el('div', 'nv-pre')
      pre.textContent = text
      fold.body.append(pre)
    } else {
      const desc = el('div', 'so-app-desc')
      desc.textContent = '（未启用或未定义任何变量时不注入。）'
      fold.body.append(desc)
    }
    previewBox.append(fold.box)
  }

  const LOG_ICONS: Record<string, string> = { accepted: '✅', corrected: '⚠️', rejected: '❌', removed: '🗑️' }

  function renderLog(): void {
    logBox.textContent = ''
    const fold = foldSection('解析日志')
    const report = runtime.getLastParse()
    if (!report) {
      const desc = el('div', 'so-app-desc')
      desc.textContent = '尚无解析记录。AI 回复包含 <UpdateVariable> 块时，这里显示逐条接受/修正/拒绝结果。'
      fold.body.append(desc)
    } else {
      const head = el('div', 'so-app-desc')
      head.textContent = `楼层 #${report.messageId}${report.error ? ` · 解析出错：${report.error}` : ''}`
      fold.body.append(head)
      for (const entry of report.log) {
        const line = el('div', 'so-app-desc nv-log-line')
        line.textContent = `${LOG_ICONS[entry.status] ?? '·'} ${entry.path}${entry.detail ? ` — ${entry.detail}` : ''}`
        fold.body.append(line)
      }
    }
    logBox.append(fold.box)
  }

  /** 易变区（状态树/预览/日志）：runtime 每次通知都刷新；编辑变量值时暂缓 */
  function renderVolatile(): void {
    if (!tree.isEditing()) tree.render()
    renderPreview()
    renderLog()
  }

  renderCfg()
  tree.render()
  renderSchema()
  renderPreview()
  renderLog()

  const offRuntime = runtime.subscribe(renderVolatile)
  return () => offRuntime()
}
