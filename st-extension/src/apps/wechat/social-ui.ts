import type { AppHost } from '../../../../core/phone-registry'
import { listContacts, loadContact } from './conversations'
import { groupContacts, isGroup, saveGroup, mentionToken } from './groups'
import { addMoment, DEFAULT_MOMENTS_PROMPT, latestContactState } from './moments'
import { contactPipeline } from './replies'
import { resolveWeChatAssetUrl } from './assets'
import type { Contact, Conversation, Group, WeChatAppData } from './types'

export function createSocialUI(container: HTMLElement, data: WeChatAppData, host: AppHost, options: {
  active: () => Conversation | undefined
  persist: () => void
  showDialog: (id: string, opener: HTMLElement) => void
  closeDialog: () => void
  openConversation: (key: string) => void
  avatar: (url?: string, name?: string) => HTMLElement
  beforeGroupEdit: (conv: Conversation) => void
  input: HTMLInputElement
}) {
  const el = <T extends HTMLElement = HTMLElement>(id: string) => container.querySelector<T>('#' + id)!
  let alive = true, generation = 0, editing: Group | undefined, momentController: AbortController | undefined
  const selected = new Set<string>()
  const catalogue = () => [...new Map([...Object.values(data.contacts ?? {}), ...listContacts(host)].map(item => [item.id, item])).values()]
  function members() {
    const list = el('wt-group-options'); list.replaceChildren()
    for (const item of catalogue()) {
      const label = document.createElement('label'); label.className = 'wt-member-choice'
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selected.has(item.id); check.value = item.id
      check.onchange = () => { if (check.checked) selected.add(item.id); else selected.delete(item.id) }
      label.append(check, options.avatar(item.avatar ?? item.card?.avatar), document.createTextNode(item.name)); list.append(label)
    }
    if (!list.childElementCount) list.textContent = '请先在酒馆导入角色卡。'
  }
  function openGroup(existing?: Group) {
    generation++; editing = existing; selected.clear()
    for (const id of existing?.memberIds ?? []) selected.add(id)
    el<HTMLInputElement>('wt-group-title').value = existing?.title ?? ''
    el('wt-group-feedback').textContent = ''
    el<HTMLButtonElement>('wt-save-group').disabled = false
    members(); options.showDialog('wt-group-modal', el(existing ? 'wt-group-edit' : 'wt-new-group'))
  }
  el('wt-new-group').onclick = () => openGroup()
  el('wt-group-edit').onclick = () => { const conv = options.active(); if (conv && isGroup(conv)) openGroup(conv) }
  el('wt-close-group').onclick = () => { generation++; options.closeDialog() }
  el('wt-save-group').onclick = async () => {
    const request = ++generation, existing = editing, title = el<HTMLInputElement>('wt-group-title').value
    const ids = [...selected], button = el<HTMLButtonElement>('wt-save-group'); button.disabled = true
    try {
      if (ids.length < 2) throw new Error('请选择至少两位群成员')
      const available = new Map(catalogue().map(item => [item.id, item]))
      const loaded = await Promise.all(ids.map(id => listContacts(host).some(item => item.id === id) ? loadContact(host, id) : Promise.resolve(available.get(id)!)))
      if (!alive || request !== generation || el('wt-group-modal').hidden) return
      if (existing) options.beforeGroupEdit(existing)
      const oldContacts = { ...data.contacts }, oldGroup = existing ? structuredClone(existing) : undefined
      const group = saveGroup(data, title, loaded, existing)
      try { options.persist() } catch (error) {
        data.contacts = oldContacts
        if (existing && oldGroup) Object.assign(existing, oldGroup)
        else delete data.conversations![group.scopeKey!]
        throw error
      }
      options.closeDialog(); options.openConversation(group.scopeKey!)
    } catch (error) { if (alive && request === generation) el('wt-group-feedback').textContent = (error as Error).message }
    finally { if (alive && request === generation) button.disabled = false }
  }
  el<HTMLSelectElement>('wt-mention').onchange = event => {
    const select = event.currentTarget as HTMLSelectElement, conv = options.active()
    if (!conv || !select.value) return
    const item = data.contacts?.[select.value]
    options.input.value += (options.input.value ? ' ' : '') + (item ? mentionToken(item) : '@所有人') + ' '
    conv.draft = options.input.value; options.persist(); select.value = ''; options.input.focus()
  }
  function renderMoments() {
    const feed = el('wt-moments-feed'); feed.replaceChildren()
    if (!data.moments?.length) feed.textContent = '还没有动态，选择一位角色看看 TA 的近况。'
    for (const moment of data.moments ?? []) {
      const article = document.createElement('article'); article.className = 'wt-moment'; article.dataset.moment = moment.id
      const header = document.createElement('div'); header.className = 'wt-moment-author'
      const name = document.createElement('strong'); name.textContent = moment.authorName
      header.append(options.avatar(moment.avatar, ''), name)
      const text = document.createElement('p'); text.textContent = moment.text
      const time = document.createElement('time'); time.dateTime = new Date(moment.createdAt).toISOString(); time.textContent = new Date(moment.createdAt).toLocaleString()
      article.append(header, text)
      if (moment.image) {
        const img = document.createElement('img'); img.className = 'wt-moment-image'; img.src = resolveWeChatAssetUrl(moment.image.file); img.alt = moment.image.description || moment.image.name; article.append(img)
      }
      const like = document.createElement('button'); like.type = 'button'
      const updateLike = () => {
        const label = moment.likedByPlayer ? '已赞' : '点赞'
        like.textContent = (moment.likedByPlayer ? '♥ ' : '♡ ') + label
        like.setAttribute('aria-pressed', String(moment.likedByPlayer))
        like.setAttribute('aria-label', like.textContent + '：' + moment.authorName + '的动态')
      }
      updateLike()
      like.onclick = () => {
        moment.likedByPlayer = !moment.likedByPlayer
        try { options.persist(); updateLike() }
        catch { moment.likedByPlayer = !moment.likedByPlayer; el('wt-moments-feedback').textContent = '点赞未保存，请重试。' }
      }
      article.append(time, like); feed.append(article)
    }
  }
  el('wt-moments').onclick = () => {
    const select = el<HTMLSelectElement>('wt-moments-author'); select.replaceChildren()
    for (const item of catalogue()) select.add(new Option(item.name, item.id))
    el('wt-moments-feedback').textContent = data.config.apiKey ? '' : '本地演示动态 · 连接 AI 后可生成角色近况'
    el<HTMLTextAreaElement>('wt-moments-prompt').value = data.config.momentsPrompt || DEFAULT_MOMENTS_PROMPT
    renderMoments(); options.showDialog('wt-moments-modal', el('wt-moments'))
  }
  function cancelMoment() {
    momentController?.abort(); momentController = undefined
    el<HTMLButtonElement>('wt-generate-moment').disabled = false; el('wt-cancel-moment').hidden = true
  }
  el('wt-cancel-moment').onclick = () => { cancelMoment(); el('wt-moments-feedback').textContent = '已取消，可重新生成。' }
  el('wt-close-moments').onclick = () => { cancelMoment(); options.closeDialog() }
  el('wt-reset-moments-prompt').onclick = () => { el<HTMLTextAreaElement>('wt-moments-prompt').value = DEFAULT_MOMENTS_PROMPT }
  el('wt-save-moments-prompt').onclick = () => {
    const prior = data.config.momentsPrompt
    data.config.momentsPrompt = el<HTMLTextAreaElement>('wt-moments-prompt').value.trim().slice(0, 8000)
    try { options.persist(); el('wt-moments-feedback').textContent = '动态提示词已保存。' }
    catch { data.config.momentsPrompt = prior; el('wt-moments-feedback').textContent = '提示词未保存，请重试。' }
  }
  el('wt-generate-moment').onclick = async () => {
    if (momentController) return
    const id = el<HTMLSelectElement>('wt-moments-author').value
    if (!id) { el('wt-moments-feedback').textContent = '请先添加联系人。'; return }
    const controller = new AbortController(); momentController = controller
    el<HTMLButtonElement>('wt-generate-moment').disabled = true; el('wt-cancel-moment').hidden = false
    el('wt-moments-feedback').textContent = '正在生成动态…'
    const timeout = setTimeout(() => { if (momentController === controller) { cancelMoment(); el('wt-moments-feedback').textContent = '生成超时，请重试。' } }, 60000)
    try {
      const item: Contact = listContacts(host).some(contact => contact.id === id) ? await loadContact(host, id) : data.contacts![id]
      if (!alive || controller.signal.aborted) return
      const { pipe } = contactPipeline(data, item)
      const state = { ...latestContactState(data, id) }
      const moment = await pipe.requestMoment(item, state, controller.signal)
      if (!alive || controller.signal.aborted || momentController !== controller) return
      const previous = data.moments
      addMoment(data, item, moment.text, moment.image, state)
      try { options.persist() } catch (error) { data.moments = previous; throw error }
      renderMoments(); el('wt-moments-feedback').textContent = '新动态已发布。'
    } catch (error) { if (alive && momentController === controller) el('wt-moments-feedback').textContent = (error as Error).message }
    finally { clearTimeout(timeout); if (momentController === controller) cancelMoment() }
  }
  return {
    dialogClosed(id: string) {
      if (id === 'wt-group-modal') generation++
      if (id === 'wt-moments-modal') cancelMoment()
    },
    sync() {
      const conv = options.active(), group = conv && isGroup(conv) ? conv : undefined
      el('wt-group-edit').hidden = !group
      const select = el<HTMLSelectElement>('wt-mention'); select.hidden = !group; select.replaceChildren(new Option('@ 提及成员', ''), new Option('所有人', '*'))
      if (group) for (const item of groupContacts(data, group)) select.add(new Option(item.name, item.id))
    },
    destroy() { alive = false; generation++; cancelMoment() },
  }
}
