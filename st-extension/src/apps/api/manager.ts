/**
 * 「API 站点管理」全屏弹窗（复用 so-manager 样式体系，同变量设计弹窗）：
 * - 站点列表：卡片行点击编辑、使用中标记、✕ 删除（确认）
 * - 编辑表单：名称/URL/Key/模型 + 从接口获取模型列表（覆盖层选择器）
 *   + 「附加参数」折叠区（ST 原生三项：包括主体参数/排除主体参数/包含请求标头）
 * - 「读取当前连接」：把 ST 当前 URL/模型/附加参数填入草稿（Key 出于安全读不回，需手填）
 *
 * 手机「API」页只做快速切换；增删改与拉模型这类深操作全部收进本弹窗（手机页精简原则）。
 */

import { el, appButton, textRow, textareaRow, foldSection } from '../widgets'
import {
  type ApiAppData,
  type ProfileDraft,
  emptyDraft,
  upsertProfile,
  findActiveProfile,
  findUrlDuplicate,
  moveProfile,
  normalizeUrl,
} from './core'
import { readConnection, fetchModels } from './bridge'

export interface ApiManagerDeps {
  getData(): ApiAppData
  /** 持久化（外部走 saveSettingsOnly，不触发立绘刷新） */
  setData(next: ApiAppData): void
  /** 弹窗关闭后回调（入口用它重新展开手机并回「API」页） */
  onClosed?: () => void
}

export interface ApiManager {
  open(): void
  close(): void
  isOpen(): boolean
}

export function createApiManager(deps: ApiManagerDeps): ApiManager {
  let backdrop: HTMLElement | null = null
  let dialog: HTMLElement | null = null
  let body: HTMLElement | null = null
  let picker: HTMLElement | null = null
  let draft: ProfileDraft | null = null
  let editingId: string | null = null
  /** 表单顶部提示（保存错误 / 读取当前的说明），渲染后展示一次 */
  let formNotice = ''
  let scrollToEditor = false

  function applyBackdropSize(): void {
    if (!backdrop) return
    backdrop.style.left = '0'
    backdrop.style.top = '0'
    backdrop.style.width = `${window.innerWidth}px`
    backdrop.style.height = `${window.innerHeight}px`
  }

  function onEscape(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return
    if (picker) closePicker()
    else close()
  }

  function open(): void {
    if (backdrop) {
      render()
      return
    }
    draft = null
    editingId = null
    formNotice = ''
    backdrop = el('div', 'so-manager-backdrop')
    document.addEventListener('keydown', onEscape)
    window.addEventListener('resize', applyBackdropSize)
    applyBackdropSize()

    dialog = el('div', 'so-manager')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-label', 'API 站点管理')

    const header = el('div', 'so-manager-header')
    const title = el('div', 'so-manager-title')
    title.textContent = 'API 站点管理'
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
    dialog = null
    body = null
    picker = null
    draft = null
    editingId = null
    deps.onClosed?.()
  }

  function save(next: ApiAppData): void {
    deps.setData(next)
    render()
  }

  // —— 渲染 —— //

  function render(): void {
    if (!body) return
    try {
      body.textContent = ''
      body.append(buildListSection(), buildEditorSection(), buildNoteSection())
      if (scrollToEditor) {
        scrollToEditor = false
        body.querySelector('.stapi-editor')?.scrollIntoView({ block: 'nearest' })
      }
    } catch (err) {
      console.error('[st-stage] API 站点管理弹窗渲染失败', err)
    }
  }

  function section(titleText: string): HTMLElement {
    const box = el('div', 'so-section')
    const title = el('div', 'so-section-title')
    title.textContent = titleText
    box.append(title)
    return box
  }

  function descLine(parent: HTMLElement, text: string): void {
    const d = el('div', 'so-app-desc')
    d.textContent = text
    parent.append(d)
  }

  // ① 站点列表
  function buildListSection(): HTMLElement {
    const data = deps.getData()
    const box = section(`站点（${data.profiles.length}）`)
    const conn = readConnection()
    const activeId = findActiveProfile(data.profiles, conn?.url ?? '', conn?.model ?? '')?.id

    if (data.profiles.length === 0) {
      descLine(box, '列表还是空的。点下方「＋ 添加站点」，或先在 ST 里连好一个接口再用「导入当前连接」一键录入。')
    } else {
      descLine(box, '列表顺序即手机页顺序，常用的用 ↑ 排前面。')
    }
    for (const p of data.profiles) {
      const row = el('div', `vm-leaf${editingId === p.id ? ' nv-def-selected' : ''}`)
      const main = el('div', 'vm-leaf-main')
      const name = el('span', 'vm-key')
      name.textContent = p.id === activeId ? `${p.name} · 使用中` : p.name
      const meta = el('span', 'vm-val')
      const parts = [p.url]
      if (p.model) parts.push(p.model)
      parts.push(p.key ? '已配 Key' : '缺 Key')
      if (p.includeBody.trim() || p.excludeBody.trim() || p.includeHeaders.trim()) parts.push('附加参数 ✓')
      meta.textContent = parts.join(' · ')
      main.append(name, meta)
      main.setAttribute('role', 'button')
      main.tabIndex = 0
      const edit = () => {
        draft = {
          name: p.name,
          url: p.url,
          key: p.key,
          model: p.model,
          includeBody: p.includeBody,
          excludeBody: p.excludeBody,
          includeHeaders: p.includeHeaders,
        }
        editingId = p.id
        formNotice = ''
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

      const moveBtn = (label: string, delta: -1 | 1) => {
        const btn = el('button', 'vm-del stapi-move')
        btn.setAttribute('aria-label', delta < 0 ? '上移' : '下移')
        btn.title = delta < 0 ? '上移（列表顺序即手机页顺序）' : '下移'
        btn.textContent = label
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          save({ profiles: moveProfile(deps.getData().profiles, p.id, delta) })
        })
        return btn
      }

      const del = el('button', 'vm-del')
      del.setAttribute('aria-label', '删除站点')
      del.title = '删除该站点'
      del.textContent = '✕'
      del.addEventListener('click', (e) => {
        e.stopPropagation()
        if (!window.confirm(`删除站点「${p.name}」？（不影响 ST 当前连接）`)) return
        if (editingId === p.id) {
          draft = null
          editingId = null
        }
        save({ profiles: deps.getData().profiles.filter((x) => x.id !== p.id) })
      })
      row.append(main, moveBtn('↑', -1), moveBtn('↓', 1), del)
      box.append(row)
    }

    box.append(
      appButton('＋ 添加站点', () => {
        draft = emptyDraft()
        editingId = null
        formNotice = ''
        scrollToEditor = true
        render()
      }),
    )
    return box
  }

  // ② 编辑表单
  function buildEditorSection(): HTMLElement {
    const box = section(!draft ? '站点编辑' : editingId === null ? '新增站点' : `编辑：${draft.name || '（未命名）'}`)
    box.classList.add('stapi-editor')
    if (!draft) {
      descLine(box, '点击上方站点进行编辑，或「＋ 添加站点」新建。')
      return box
    }
    const d = draft

    const notice = el('div', 'so-app-desc vm-add-err')
    notice.textContent = formNotice
    notice.hidden = formNotice === ''
    formNotice = ''
    box.append(notice)

    const showNotice = (text: string) => {
      notice.textContent = text
      notice.hidden = false
    }

    box.append(
      textRow('站点名称', d.name, '起个好认的名字，如：主力中转', (v) => (d.name = v)),
      textRow('接口地址 URL', d.url, '形如 https://example.com/v1', (v) => (d.url = v)),
      textRow('API Key', d.key, '只存在你本机的 ST 设置里（明文），公用设备慎用', (v) => (d.key = v.trim()), 'password'),
      textRow('模型 ID（可空）', d.model, '留空则切换时沿用 ST 当前模型', (v) => (d.model = v)),
      appButton('从站点拉取模型列表', () => {
        const url = normalizeUrl(d.url)
        if (!url) {
          showNotice('先把接口地址 URL 填上，才能拉模型。')
          return
        }
        openPicker(url, d.key, (m) => {
          d.model = m
          render()
        })
      }),
    )

    // 附加参数：与 ST「附加参数」弹窗同款三项，per 站点保存、切换时一并写入
    const extra = foldSection(
      '附加参数（可选，随站点一起切换）',
      Boolean(d.includeBody.trim() || d.excludeBody.trim() || d.includeHeaders.trim()),
    )
    const extraDesc = el('div', 'so-app-desc')
    extraDesc.textContent = '对应 ST 连接面板的「附加参数」，YAML 格式原样透传；切换到本站点时自动写入，无需再去 ST 里手改。'
    extra.body.append(
      extraDesc,
      textareaRow('包括主体参数（YAML 对象）', d.includeBody, '写进每次请求主体的参数，一行一条：\ntop_k: 20\nrepetition_penalty: 1.1', (v) => (d.includeBody = v)),
      textareaRow('排除主体参数（每行一个）', d.excludeBody, '不想让 ST 发出去的参数名，一行一个：\ntop_p', (v) => (d.excludeBody = v)),
      textareaRow('包含请求标头（YAML 对象）', d.includeHeaders, '随请求附带的自定义 Header：\nX-My-Header: 某值', (v) => (d.includeHeaders = v)),
    )
    box.append(extra.box)

    const actions = el('div', 'vm-actions')
    const saveBtn = el('button', 'menu_button vm-act')
    saveBtn.textContent = editingId === null ? '保存站点' : '保存修改'
    saveBtn.addEventListener('click', () => {
      const cur = deps.getData().profiles
      // 同 URL 多配置合法（同一网关不同模型/Key），但大概率是手误——保存前提示一次
      const urlDup = findUrlDuplicate(cur, d.url, editingId)
      if (
        urlDup &&
        !window.confirm(
          `站点「${urlDup.name}」已经在用这个地址了。\n同地址多配置是允许的（比如同一网关配不同模型），确定再存一份吗？`,
        )
      ) {
        return
      }
      const r = upsertProfile(cur, d, editingId)
      if ('error' in r) {
        showNotice(r.error)
        return
      }
      draft = null
      editingId = null
      save({ profiles: r.profiles })
    })
    const cancel = el('button', 'menu_button vm-act vm-act-ghost')
    cancel.textContent = '取消'
    cancel.addEventListener('click', () => {
      draft = null
      editingId = null
      render()
    })
    const readCur = el('button', 'menu_button vm-act vm-act-ghost')
    readCur.textContent = '导入当前连接'
    readCur.title = '把 ST 正在使用的 URL/模型/附加参数填进表单（Key 读不回，需手填）'
    readCur.addEventListener('click', () => {
      const conn = readConnection()
      if (!conn) {
        showNotice('未检测到 SillyTavern 运行时，导入不了。')
        return
      }
      d.url = conn.url
      d.model = conn.model
      d.includeBody = conn.includeBody
      d.excludeBody = conn.excludeBody
      d.includeHeaders = conn.includeHeaders
      formNotice = '已导入当前 URL/模型/附加参数；Key 出于安全读不回来，请手动补上。'
      render()
    })
    actions.append(saveBtn, cancel, readCur)
    box.append(actions)
    return box
  }

  // ③ 底部说明
  function buildNoteSection(): HTMLElement {
    const box = section('说明')
    descLine(box, 'Key 随 ST 设置明文保存在你自己的设备上（扩展设置的通用机制），公用设备上请谨慎。')
    descLine(box, '切换在手机「API」页进行：点站点行 → 写入 Key、切到自定义(OpenAI 兼容)接口、写附加参数 → 自动连接。')
    return box
  }

  // —— 模型选择覆盖层 —— //

  function closePicker(): void {
    picker?.remove()
    picker = null
  }

  function openPicker(url: string, key: string, onPick: (model: string) => void): void {
    if (!dialog) return
    closePicker()
    picker = el('div', 'stapi-picker')
    const box = el('div', 'stapi-picker-box')

    const head = el('div', 'stapi-picker-head')
    const title = el('div', 'so-section-title')
    title.textContent = '选择模型'
    const closeBtn = el('button', 'menu_button vm-act vm-act-ghost')
    closeBtn.textContent = '✕'
    closeBtn.setAttribute('aria-label', '关闭')
    closeBtn.addEventListener('click', closePicker)
    head.append(title, closeBtn)

    const filter = document.createElement('input')
    filter.type = 'text'
    filter.className = 'text_pole so-app-input'
    filter.placeholder = '输入关键字筛选'
    filter.autocomplete = 'off'

    const list = el('div', 'stapi-picker-list')
    const loading = el('div', 'so-app-desc')
    loading.textContent = '正在向站点请求模型列表…'
    list.append(loading)

    box.append(head, filter, list)
    picker.append(box)
    // 点覆盖层空白处关闭（事件仅在弹窗 dialog 内部，不会冒泡影响 ST）
    picker.addEventListener('click', (e) => {
      if (e.target === picker) closePicker()
    })
    dialog.append(picker)

    // 还原 Key 的兜底：当前生效站点已保存的 Key（刷新页面后可见输入框是空的）
    const restoreKey = findActiveProfile(deps.getData().profiles, readConnection()?.url ?? '')?.key ?? ''

    fetchModels(url, key, restoreKey)
      .then((models) => {
        if (!picker) return
        const renderList = (kw: string) => {
          list.textContent = ''
          const f = kw.trim().toLowerCase()
          const subset = models.filter((m) => m.toLowerCase().includes(f))
          if (subset.length === 0) {
            const empty = el('div', 'so-app-desc')
            empty.textContent = '没有筛到匹配的模型'
            list.append(empty)
            return
          }
          for (const m of subset) {
            const item = el('div', 'stapi-picker-item')
            item.textContent = m
            item.setAttribute('role', 'button')
            item.tabIndex = 0
            const pick = () => {
              closePicker()
              onPick(m)
            }
            item.addEventListener('click', pick)
            item.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                pick()
              }
            })
            list.append(item)
          }
        }
        renderList('')
        filter.addEventListener('input', () => renderList(filter.value))
        filter.focus()
      })
      .catch((err: unknown) => {
        if (!picker) return
        list.textContent = ''
        const fail = el('div', 'so-app-desc')
        fail.textContent = `拉取失败：${err instanceof Error ? err.message : String(err)}`
        list.append(fail)
      })
  }

  return { open, close, isOpen: () => backdrop !== null }
}
