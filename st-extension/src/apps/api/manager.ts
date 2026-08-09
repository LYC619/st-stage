import { el, appButton, textRow, textareaRow, foldSection, selectRow } from '../widgets'
import { COMMON_CHAT_SOURCES, type ApiAppData, type ApiProfile, type MainApi, type ProfileDraft, emptyDraft, findActiveProfile, findUrlDuplicate, getSource, moveProfile, normalizeUrl, profileSummary, upsertProfile } from './core'
import { fetchModels, readConnection } from './bridge'

export interface ApiManagerDeps { getData(): ApiAppData; setData(next: ApiAppData): void; onClosed?: () => void }
export interface ApiManager { open(): void; close(): void; isOpen(): boolean }

const MAIN_API_OPTIONS = [
  { value: 'openai', label: '聊天补全（Chat Completion）' },
  { value: 'textgenerationwebui', label: '文本补全（Text Completion）' },
  { value: 'novel', label: 'NovelAI' }, { value: 'kobold', label: 'KoboldAI' }, { value: 'koboldhorde', label: 'KoboldAI Horde' },
]

export function createApiManager(deps: ApiManagerDeps): ApiManager {
  let backdrop: HTMLElement | null = null; let body: HTMLElement | null = null; let draft: ProfileDraft | null = null; let editingId: string | null = null; let notice = ''
  const section = (title: string) => { const box = el('div', 'so-section'); const heading = el('div', 'so-section-title'); heading.textContent = title; box.append(heading); return box }
  const desc = (box: HTMLElement, text: string) => { const line = el('div', 'so-app-desc'); line.textContent = text; box.append(line) }
  const save = (data: ApiAppData) => { deps.setData(data); render() }

  function open(): void {
    if (backdrop) return render()
    backdrop = el('div', 'so-manager-backdrop'); backdrop.style.inset = '0'
    const dialog = el('div', 'so-manager'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-label', 'API 连接档案管理')
    const header = el('div', 'so-manager-header'); const title = el('div', 'so-manager-title'); title.textContent = 'API 连接档案管理'
    const closeButton = el('button', 'menu_button so-manager-close'); closeButton.textContent = '关闭'; closeButton.addEventListener('click', close)
    header.append(title, closeButton); body = el('div', 'so-manager-body'); dialog.append(header, body); backdrop.append(dialog); document.body.append(backdrop); render()
  }
  function close(): void { backdrop?.remove(); backdrop = null; body = null; draft = null; editingId = null; deps.onClosed?.() }

  function edit(profile: ApiProfile): void {
    const { id: _id, version: _version, ...value } = profile; draft = { ...value, settings: { ...value.settings } }; editingId = profile.id; notice = ''; render()
  }

  function render(): void {
    if (!body) return
    body.textContent = ''; body.append(buildList(), buildEditor(), buildHelp())
  }

  function buildList(): HTMLElement {
    const data = deps.getData(); const box = section(`连接档案（${data.profiles.length}）`)
    if (!data.profiles.length) desc(box, '还没有档案。可新建，或导入 SillyTavern 当前连接。')
    void readConnection().then((connection) => {
      if (!connection || !body) return
      const active = findActiveProfile(data.profiles, connection)
      body.querySelector(`[data-profile-id="${active?.id ?? ''}"]`)?.classList.add('stapi-row-on')
    })
    for (const profile of data.profiles) {
      const row = el('div', 'vm-leaf'); row.dataset.profileId = profile.id
      const main = el('div', 'vm-leaf-main'); main.tabIndex = 0; main.setAttribute('role', 'button')
      const name = el('span', 'vm-key'); name.textContent = profile.name
      const meta = el('span', 'vm-val'); meta.textContent = profileSummary(profile).join(' · ')
      main.append(name, meta); main.addEventListener('click', () => edit(profile))
      const move = (label: string, delta: -1 | 1) => { const button = el('button', 'vm-del stapi-move'); button.textContent = label; button.addEventListener('click', () => save({ profiles: moveProfile(deps.getData().profiles, profile.id, delta) })); return button }
      const remove = el('button', 'vm-del'); remove.textContent = '删除'; remove.addEventListener('click', () => { if (window.confirm(`删除连接档案「${profile.name}」？`)) save({ profiles: deps.getData().profiles.filter((item) => item.id !== profile.id) }) })
      row.append(main, move('↑', -1), move('↓', 1), remove); box.append(row)
    }
    box.append(appButton('＋ 添加连接档案', () => { draft = emptyDraft(); editingId = null; notice = ''; render() }))
    return box
  }

  function buildEditor(): HTMLElement {
    const box = section(draft ? (editingId ? `编辑：${draft.name || '未命名'}` : '新增连接档案') : '档案编辑')
    if (!draft) { desc(box, '选择上方档案进行编辑，或添加一个新档案。'); return box }
    const d = draft; if (notice) { desc(box, notice); notice = '' }
    box.append(textRow('档案名称', d.name, '例如：主力 Claude', (value) => { d.name = value }))
    box.append(selectRow('API 大类', d.mainApi, MAIN_API_OPTIONS, (value) => { d.mainApi = value as MainApi; d.source = getSource(value, '').id; d.url = ''; d.model = ''; d.secretId = ''; render() }))
    if (d.mainApi === 'openai') {
      const sources = [...COMMON_CHAT_SOURCES]
      const currentSource = getSource(d.mainApi, d.source)
      if (!sources.some((item) => item.id === currentSource.id)) sources.push(currentSource)
      box.append(selectRow('来源', d.source, sources.map((item) => ({ value: item.id, label: item.label })), (value) => { d.source = value; d.url = ''; d.model = ''; d.secretId = ''; render() }))
    }
    const descriptor = getSource(d.mainApi, d.source)
    if (descriptor.urlField) box.append(textRow('接口地址 URL', d.url, 'https://example.com/v1', (value) => { d.url = value }))
    if (descriptor.secretKey) box.append(textRow('API Key', d.key, d.secretMode === 'unavailable' ? '当前 ST 不允许读取；留空可保留原值' : '明文保存在本扩展档案，并同步写入 ST 密钥库', (value) => { d.key = value.trim(); d.secretMode = value ? 'stored' : d.secretMode }, 'password'))
    if (descriptor.modelField || descriptor.supportsModels) box.append(textRow('模型 ID（可空）', d.model, '留空则沿用当前模型', (value) => { d.model = value }))
    if (descriptor.supportsModels) box.append(appButton('从接口获取模型', () => void loadModels(d)))
    const extra = foldSection('附加参数（自定义接口）', Object.values(d.settings).some(Boolean))
    extra.body.append(
      textareaRow('包括主体参数', String(d.settings.custom_include_body ?? ''), 'YAML 对象', (value) => { d.settings.custom_include_body = value }),
      textareaRow('排除主体参数', String(d.settings.custom_exclude_body ?? ''), '每行一个参数名', (value) => { d.settings.custom_exclude_body = value }),
      textareaRow('包含请求标头', String(d.settings.custom_include_headers ?? ''), 'YAML 对象', (value) => { d.settings.custom_include_headers = value }),
    )
    if (d.source === 'custom') box.append(extra.box)
    const actions = el('div', 'vm-actions')
    const saveButton = el('button', 'menu_button vm-act'); saveButton.textContent = editingId ? '保存修改' : '保存档案'; saveButton.addEventListener('click', () => {
      const duplicate = findUrlDuplicate(deps.getData().profiles, d.url, editingId)
      if (duplicate && !window.confirm(`「${duplicate.name}」使用相同 URL，仍要保存吗？`)) return
      const result = upsertProfile(deps.getData().profiles, d, editingId)
      if ('error' in result) { notice = result.error; return render() }
      draft = null; editingId = null; save({ profiles: result.profiles })
    })
    const importButton = el('button', 'menu_button vm-act vm-act-ghost'); importButton.textContent = '导入当前连接'; importButton.addEventListener('click', () => void importCurrent())
    const cancel = el('button', 'menu_button vm-act vm-act-ghost'); cancel.textContent = '取消'; cancel.addEventListener('click', () => { draft = null; editingId = null; render() })
    actions.append(saveButton, importButton, cancel); box.append(actions); return box
  }

  async function importCurrent(): Promise<void> {
    const current = await readConnection(); if (!current || !draft) { notice = '未检测到 SillyTavern 运行时。'; return render() }
    draft.mainApi = current.mainApi as MainApi; draft.source = current.source; draft.url = current.url; draft.model = current.model; draft.settings = { ...current.settings }; draft.secretId = current.secretId
    if (current.key) draft.key = current.key
    draft.secretMode = current.secretMode
    notice = current.secretMode === 'read' ? '已完整导入当前连接和密钥。' : '已导入连接设置；当前版本无法回读密钥，已保留表单中的 Key。'
    render()
  }

  async function loadModels(value: ProfileDraft): Promise<void> {
    if (!normalizeUrl(value.url)) { notice = '请先填写接口地址。'; return render() }
    try {
      const models = await fetchModels({ ...value }); const selected = window.prompt(`可用模型：\n${models.join('\n')}\n\n请输入要使用的模型 ID：`, value.model || models[0])
      if (selected && draft) draft.model = selected
    } catch (error) { notice = `获取模型失败：${error instanceof Error ? error.message : String(error)}` }
    render()
  }

  function buildHelp(): HTMLElement {
    const box = section('兼容说明'); desc(box, 'Key 在本扩展档案中明文保存；连接时优先写入 SillyTavern 新版多密钥 secret-id，旧版会回退到对应单密钥槽位。')
    desc(box, '新档案只列常用渠道；其他兼容 OpenAI 的厂商使用“自定义”入口。历史档案中的旧渠道仍可查看和编辑。'); return box
  }

  return { open, close, isOpen: () => backdrop !== null }
}
